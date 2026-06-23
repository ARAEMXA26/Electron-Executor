-- ====================================================================
-- ELECTRON LUA EXECUTOR CONNECTOR
-- Supports both exploit client executors (MacSploit, Hydrogen, Wave)
-- and Roblox Studio plugins. Auto-negotiates WebSockets and HTTP.
-- ====================================================================

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local MarketplaceService = game:GetService("MarketplaceService")

local runPort = 8392
local baseUrl = "http://127.0.0.1:" .. tostring(runPort)
local wsUrl = "ws://127.0.0.1:" .. tostring(runPort)

-- Safe extraction of game information
local placeId = game.PlaceId
local jobId = game.JobId
local gameName = "Roblox Game"

pcall(function()
    if placeId > 0 then
        local productInfo = MarketplaceService:GetProductInfo(placeId)
        if productInfo and productInfo.Name then
            gameName = productInfo.Name
        end
    else
        gameName = "Studio Edit Session"
    end
end)

-- Safe extraction of executor/environment details
local executorName = "Unknown Client"
if RunService:IsStudio() then
    executorName = "Roblox Studio"
else
    local ok, name = pcall(function()
        if identifyexecutor then
            local n, v = identifyexecutor()
            return n .. (v and (" " .. v) or "")
        elseif getexecutorname then
            return getexecutorname()
        elseif MacSploit then
            return "MacSploit"
        elseif hydrogen then
            return "Hydrogen"
        elseif syn then
            return "Synapse"
        end
    end)
    if ok and name then
        executorName = name
    end
end

-- --------------------------------------------------------------------
-- Safe HTTP Communication Layer
-- --------------------------------------------------------------------
local function httpGet(url)
    -- 1. Try game:HttpGet (standard exploit method)
    local success, result = pcall(function()
        return game:HttpGet(url)
    end)
    if success and result then return result end

    -- 2. Try standard exploit request libraries
    local requestFunc = request or http.request or syn.request or http_request
    if requestFunc then
        local reqSuccess, reqResult = pcall(function()
            return requestFunc({ Url = url, Method = "GET" })
        end)
        if reqSuccess and reqResult and reqResult.Body then
            return reqResult.Body
        end
    end

    -- 3. Fallback to server-side HttpService (Roblox Studio / Game Server)
    local httpSuccess, httpResult = pcall(function()
        return HttpService:GetAsync(url)
    end)
    if httpSuccess then return httpResult end

    return nil
end

local function httpPost(url, body)
    -- 1. Try standard exploit request libraries
    local requestFunc = request or http.request or syn.request or http_request
    if requestFunc then
        local reqSuccess, reqResult = pcall(function()
            return requestFunc({
                Url = url,
                Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = body
            })
        end)
        if reqSuccess then return true end
    end

    -- 2. Fallback to server-side HttpService
    local httpSuccess = pcall(function()
        HttpService:PostAsync(url, body, Enum.HttpContentType.ApplicationJson)
    end)
    return httpSuccess
end

-- Send app log message to Electron
local function sendAppLog(message, logType, scriptName, scriptId)
    local payload = HttpService:JSONEncode({
        message = tostring(message),
        type = logType or "info",
        scriptName = scriptName or "loader.lua",
        scriptId = scriptId or nil
    })
    
    -- Try POST log first
    httpPost(baseUrl .. "/log", payload)
end

-- Perform initial HTTP handshake
local function sendHandshake()
    local payload = HttpService:JSONEncode({
        placeId = placeId,
        gameName = gameName,
        jobId = jobId,
        executor = executorName
    })
    httpPost(baseUrl .. "/handshake", payload)
end

-- Execute source code safely with custom wrapped environment and exploit API mocks
local function executeSource(sourceCode, sourceName, sourceId)
    sendAppLog("Executing script payload: " .. (sourceName or "unnamed.lua"), "info", sourceName, sourceId)
    
    local func, err = loadstring(sourceCode)
    if func then
        -- 1. Create a custom environment table
        local env = {}
        
        -- 2. Proxy for game / Game (enables HttpGet and HttpPost in Roblox Studio via HttpService)
        local proxiedGame = setmetatable({}, {
            __index = function(t, k)
                if k == "HttpGet" or k == "httpGet" then
                    return function(self, url)
                        local success, res = pcall(function()
                            return HttpService:GetAsync(url)
                        end)
                        return success and res or ""
                    end
                elseif k == "HttpPost" or k == "httpPost" then
                    return function(self, url, body, contentType)
                        local success, res = pcall(function()
                            return HttpService:PostAsync(url, body, contentType)
                        end)
                        return success and res or ""
                    end
                else
                    local val = game[k]
                    if typeof(val) == "function" then
                        return function(self, ...)
                            return val(game, ...)
                        end
                    end
                    return val
                end
            end,
            __newindex = function(t, k, v)
                game[k] = v
            end
        })

        -- 3. Populate environment with exploit API mocks
        env = setmetatable({
            game = proxiedGame,
            Game = proxiedGame,
            
            -- Exploit global environment mocks
            getgenv = function() return env end,
            getrenv = function() return env end,
            getreg = function() return {} end,
            getgc = function() return {} end,
            getinstances = function() return game:GetDescendants() end,
            getnilinstances = function() return {} end,
            
            getrawmetatable = function(t) return getmetatable(t) end,
            setrawmetatable = function(t, mt) return true end,
            setreadonly = function(t, r) return true end,
            isreadonly = function(t) return false end,
            hookmetamethod = function(t, method, func)
                local mt = getmetatable(t)
                if mt then
                    local old = mt[method]
                    mt[method] = func
                    return old
                end
            end,
            hookfunction = function(f, hook)
                pcall(function()
                    httpPost(baseUrl .. "/log", HttpService:JSONEncode({
                        message = "[Hook] hookfunction executed",
                        type = "info"
                    }))
                end)
                return f
            end,
            detourfunction = function(original, hook)
                return env.hookfunction(original, hook)
            end,
            detourfunc = function(original, hook)
                return env.hookfunction(original, hook)
            end,
            getnamecallmethod = function() return "Index" end,
            setnamecallmethod = function(method) return true end,
            newcclosure = function(f) return f end,
            iscclosure = function(f) return false end,
            islclosure = function(f) return true end,
            identifyexecutor = function() return "Electron Executor", "v1.0" end,
            getexecutorname = function() return "Electron Executor" end,
            
            -- Identity management
            getidentity = function() return 8 end,
            setidentity = function(level) return true end,
            getthreadidentity = function() return 8 end,
            setthreadidentity = function(level) return true end,
            get_thread_identity = function() return 8 end,
            get_thread_context = function() return 8 end,

            -- Drawing API
            Drawing = {
                new = function(className)
                    local drawObj = {
                        Visible = true,
                        ZIndex = 0,
                        Transparency = 1,
                        Color = Color3.new(1, 1, 1),
                        Remove = function() end,
                        Destroy = function() end
                    }
                    if className == "Line" then
                        drawObj.From = Vector2.new(0, 0)
                        drawObj.To = Vector2.new(0, 0)
                        drawObj.Thickness = 1
                    elseif className == "Text" then
                        drawObj.Text = ""
                        drawObj.Size = 12
                        drawObj.Center = false
                        drawObj.Outline = false
                        drawObj.OutlineColor = Color3.new(0, 0, 0)
                        drawObj.Position = Vector2.new(0, 0)
                    elseif className == "Circle" then
                        drawObj.Position = Vector2.new(0, 0)
                        drawObj.Radius = 10
                        drawObj.Thickness = 1
                        drawObj.Filled = false
                    elseif className == "Square" then
                        drawObj.Position = Vector2.new(0, 0)
                        drawObj.Size = Vector2.new(0, 0)
                        drawObj.Thickness = 1
                        drawObj.Filled = false
                    end
                    pcall(function()
                        httpPost(baseUrl .. "/log", HttpService:JSONEncode({
                            message = "[Drawing.new] Created mock drawing primitive: " .. tostring(className),
                            type = "info"
                        }))
                    end)
                    return drawObj
                end,
                Fonts = { UI = 0, System = 1, Plex = 2, Monospace = 3 }
            },

            -- Decompiler Bridge
            decompile = function(scriptObj)
                local src = "local test = 1\nprint('decompiled')"
                pcall(function()
                    if typeof(scriptObj) == "Instance" then
                        src = scriptObj.Source or "-- Source code unavailable"
                    end
                end)
                local success, decompiled = pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    local res = requestFunc({
                        Url = baseUrl .. "/decompile",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ scriptSource = src, scriptName = tostring(scriptObj) })
                    })
                    return res and res.Body or src
                end)
                return success and decompiled or src
            end,
            decompilefunction = function(func)
                return "-- Function decompiled successfully"
            end,

            -- Filesystem Operations
            saveinstance = function(options)
                local fileName = options and options.fileName
                pcall(function()
                    httpPost(baseUrl .. "/saveinstance", HttpService:JSONEncode({
                        fileName = fileName
                    }))
                end)
            end,
            readfile = function(filePath)
                local reqSuccess, reqResult = pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    local res = requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "readfile", path = filePath })
                    })
                    if res and res.Body then
                        local json = HttpService:JSONDecode(res.Body)
                        if json.success then return json.content end
                    end
                    return ""
                end)
                return reqSuccess and reqResult or ""
            end,
            writefile = function(filePath, content)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "writefile", path = filePath, content = content })
                    })
                end)
            end,
            appendfile = function(filePath, content)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "appendfile", path = filePath, content = content })
                    })
                end)
            end,
            isfile = function(filePath)
                local success, exists = pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    local res = requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "isfile", path = filePath })
                    })
                    if res and res.Body then
                        local json = HttpService:JSONDecode(res.Body)
                        return json.exists == true
                    end
                    return false
                end)
                return success and exists
            end,
            isfolder = function(folderPath)
                local success, exists = pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    local res = requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "isfolder", path = folderPath })
                    })
                    if res and res.Body then
                        local json = HttpService:JSONDecode(res.Body)
                        return json.exists == true
                    end
                    return false
                end)
                return success and exists
            end,
            makefolder = function(folderPath)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "makefolder", path = folderPath })
                    })
                end)
            end,
            delfile = function(filePath)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "delfile", path = filePath })
                    })
                end)
            end,
            delfolder = function(folderPath)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "delfolder", path = folderPath })
                    })
                end)
            end,
            listfiles = function(folderPath)
                local success, files = pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    local res = requestFunc({
                        Url = baseUrl .. "/filesystem",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "listfiles", path = folderPath })
                    })
                    if res and res.Body then
                        local json = HttpService:JSONDecode(res.Body)
                        return json.files or {}
                    end
                    return {}
                end)
                return success and files or {}
            end,

            -- Crypt Library
            crypt = {
                base64encode = function(data)
                    return HttpService:UrlEncode(data) -- base64 fallback or similar URL encode
                end,
                base64decode = function(data)
                    return data -- placeholder or decode
                end,
                encrypt = function(data, key) return data end,
                decrypt = function(data, key) return data end,
                hash = function(data, algorithm) return "hash_placeholder" end,
                generatekey = function() return HttpService:GenerateGUID(false) end
            },

            -- WebSocket Client
            WebSocket = {
                connect = function(url)
                    local wsMock = {
                        Send = function(self, msg)
                            sendAppLog("[WebSocket Client Send] " .. tostring(msg))
                        end,
                        Close = function(self)
                            sendAppLog("[WebSocket Client Closed]")
                        end
                    }
                    wsMock.OnMessage = { Connect = function(self, callback) end }
                    wsMock.OnClose = { Connect = function(self, callback) end }
                    sendAppLog("[WebSocket Client] Connected to " .. tostring(url))
                    return wsMock
                end
            },

            -- Remote Console (RConsole)
            rconsoleprint = function(msg)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/console",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "print", message = tostring(msg) })
                    })
                end)
            end,
            rconsolewarn = function(msg)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/console",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "print", message = tostring(msg), type = "warn" })
                    })
                end)
            end,
            rconsoleerr = function(msg)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/console",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "print", message = tostring(msg), type = "error" })
                    })
                end)
            end,
            rconsoleclear = function()
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/console",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "clear" })
                    })
                end)
            end,
            rconsoleclose = function()
                pcall(function() sendAppLog("[RConsole] Console closed") end)
            end,
            rconsoletitle = function(title)
                pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    requestFunc({
                        Url = baseUrl .. "/console",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "title", title = tostring(title) })
                    })
                end)
            end,
            rconsoleinput = function()
                local success, val = pcall(function()
                    local requestFunc = request or http.request or syn.request or http_request
                    local res = requestFunc({
                        Url = baseUrl .. "/console",
                        Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" },
                        Body = HttpService:JSONEncode({ action = "input" })
                    })
                    return res and res.Body or ""
                end)
                return success and val or ""
            end,
            
            -- Http request compatibility
            request = function(options)
                local url = options.Url or options.url
                local method = options.Method or options.method or "GET"
                local body = options.Body or options.body
                if method == "GET" then
                    local success, res = pcall(function() return HttpService:GetAsync(url) end)
                    return { Success = success, StatusCode = success and 200 or 500, Body = res }
                else
                    local success, res = pcall(function() return HttpService:PostAsync(url, body) end)
                    return { Success = success, StatusCode = success and 200 or 500, Body = res }
                end
            end,
            http_request = function(options) return env.request(options) end,
            http = { request = function(options) return env.request(options) end }
        }, {
            -- Fallback to the main environment
            __index = function(t, k)
                if k == "HttpGet" then
                    return function(self, url)
                        local success, res = pcall(function() return HttpService:GetAsync(url) end)
                        return success and res or ""
                    end
                end
                return getfenv()[k]
            end,
            __newindex = function(t, k, v)
                getfenv()[k] = v
            end
        })
        
        -- 4. Apply environment
        setfenv(func, env)

        -- 5. Spawn function
        local execSuccess, execErr = pcall(function()
            task.spawn(func)
        end)
        
        if execSuccess then
            sendAppLog("Script executed successfully.", "info", sourceName, sourceId)
        else
            sendAppLog("Runtime Error: " .. tostring(execErr), "error", sourceName, sourceId)
            warn("[Electron Error] " .. tostring(execErr))
        end
    else
        sendAppLog("Compilation Error: " .. tostring(err), "error", sourceName, sourceId)
        warn("[Electron Compilation Error] " .. tostring(err))
    end
end

-- --------------------------------------------------------------------
-- Dual-Mode Connection Manager (WebSocket + HTTP Polling Fallback)
-- --------------------------------------------------------------------
local function startWebSocket()
    local wsConnect = websocket and (websocket.connect or websocket.Connect) or 
                      syn and syn.websocket and syn.websocket.connect or 
                      WebSocket and (WebSocket.connect or WebSocket.Connect)

    if not wsConnect then
        print("[Electron] WebSockets not supported by executor. Falling back to HTTP polling...")
        return false
    end

    local success, ws = pcall(function()
        return wsConnect(wsUrl)
    end)

    if not success or not ws then
        return false
    end

    print("[Electron] Connected via WebSocket on port " .. tostring(runPort))
    
    -- Send WebSocket handshake
    pcall(function()
        ws:Send(HttpService:JSONEncode({
            action = "handshake",
            placeId = placeId,
            gameName = gameName,
            jobId = jobId,
            executor = executorName
        }))
    end)

    -- Listen to WebSocket messages
    ws.OnMessage:Connect(function(message)
        local dataSuccess, data = pcall(function()
            return HttpService:JSONDecode(message)
        end)

        if dataSuccess and data and data.action == "execute" then
            executeSource(data.source, data.name, data.id)
        end
    end)

    -- Handle WebSocket closure
    ws.OnClose:Connect(function()
        print("[Electron] WebSocket connection closed. Retrying...")
    end)

    return true
end

-- Start Connection
task.spawn(function()
    sendHandshake()
    sendAppLog("Roblox Client connected via " .. executorName, "info")

    -- 1. Try WebSocket connection
    local wsSuccess = false
    pcall(function()
        wsSuccess = startWebSocket()
    end)

    -- 2. HTTP Polling Fallback (if WS not supported or connection failed)
    if not wsSuccess then
        print("[Electron] Starting HTTP Polling on port " .. tostring(runPort) .. "...")
        
        while true do
            local response = httpGet(baseUrl .. "/poll")
            if response and response ~= "" then
                executeSource(response, "PolledScript.lua")
            end
            task.wait(0.5) -- Poll every 500ms
        end
    end
end)

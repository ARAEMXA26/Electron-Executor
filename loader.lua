-- ====================================================================
-- ELECTRON LUA EXECUTOR CONNECTOR
-- Supports both exploit client executors (MacSploit, Hydrogen, Wave)
-- and Roblox Studio plugins. Auto-negotiates WebSockets and HTTP.
-- ====================================================================

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local MarketplaceService = game:GetService("MarketplaceService")

local runPort = 8392
local baseUrl = "http://localhost:" .. tostring(runPort)
local wsUrl = "ws://localhost:" .. tostring(runPort)

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

-- Execute source code safely
local function executeSource(sourceCode, sourceName, sourceId)
    sendAppLog("Executing script payload: " .. (sourceName or "unnamed.lua"), "info", sourceName, sourceId)
    
    local func, err = loadstring(sourceCode)
    if func then
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

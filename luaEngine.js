// ====================================================================
// BUILT-IN LUA ENGINE (PROXIED ROBLOX MOCK EDITION)
// Uses wasmoon (Lua 5.4 via WebAssembly) to run Lua scripts directly
// inside the Electron main process with full Roblox API mocks.
// ====================================================================

const { LuaFactory } = require('wasmoon');
const cp = require('child_process');

let factory = null;

// Initialize the Lua factory once (lazy)
async function getFactory() {
  if (!factory) {
    factory = new LuaFactory();
  }
  return factory;
}

// Synchronous HTTP GET helper using curl
function httpGetSync(url) {
  try {
    const result = cp.spawnSync('curl', [
      '-sL',
      '-m', '15',
      '-A', 'Roblox/WinInet',
      '-H', 'Accept: */*',
      url
    ], { encoding: 'utf-8' });

    if (result.status === 0) {
      return result.stdout;
    }
    console.error('httpGetSync error (code ' + result.status + '):', result.stderr);
    return '';
  } catch (err) {
    console.error('httpGetSync error:', err.message);
    return '';
  }
}

// Synchronous HTTP POST helper using curl
function httpPostSync(url, body, contentType) {
  try {
    const inputBody = typeof body === 'object' ? JSON.stringify(body) : (body || '');
    const result = cp.spawnSync('curl', [
      '-sL',
      '-m', '15',
      '-X', 'POST',
      '-A', 'Roblox/WinInet',
      '-H', `Content-Type: ${contentType || 'application/json'}`,
      '-H', 'Accept: */*',
      '-d', '@-',
      url
    ], {
      input: inputBody,
      encoding: 'utf-8'
    });

    if (result.status === 0) {
      return result.stdout;
    }
    console.error('httpPostSync error (code ' + result.status + '):', result.stderr);
    return '';
  } catch (err) {
    console.error('httpPostSync error:', err.message);
    return '';
  }
}

// Comprehensive list of common Roblox method/event-wait names
const METHOD_NAMES = new Set([
  // Core / Network
  'HttpGet', 'HttpPost', 'GetService', 'getService', 'IsLoaded', 'Wait', 'wait',
  'JSONEncode', 'JSONDecode', 'GenerateGUID', 'UrlEncode', 'GetAsync', 'PostAsync',
  
  // Instance methods
  'Clone', 'clone', 'Destroy', 'destroy', 'ClearAllChildren', 'Remove', 'remove',
  'GetChildren', 'getChildren', 'GetDescendants', 'getDescendants',
  'FindFirstChild', 'findFirstChild', 'WaitForChild', 'waitForChild',
  'FindFirstChildOfClass', 'FindFirstChildWhichIsA',
  'FindFirstAncestor', 'FindFirstAncestorOfClass', 'FindFirstAncestorWhichIsA',
  'IsA', 'isA', 'isa',
  
  // Players
  'Kick', 'kick', 'GetPlayers', 'getPlayers', 'GetNameFromUserIdAsync',
  
  // Input
  'GetMouseLocation', 'IsKeyDown',
  
  // Tweens
  'Create', 'Play', 'Cancel', 'Pause',
  
  // Events
  'Connect', 'connect', 'Disconnect', 'disconnect', 'Fire', 'fire',
  
  // RunService
  'IsStudio', 'IsClient', 'IsServer',
  
  // Marketplace
  'GetProductInfo',
  
  // CFrame / Vector / Pivot
  'PivotTo', 'GetPivot', 'SetPrimaryPartCFrame', 'GetPrimaryPartCFrame',
]);

// JS Proxy generator that mocks any un-implemented properties as sub-mocks, 
// and any un-implemented methods as callable functions that return new mocks.
function createSafeMock(name = 'mock', overrides = {}) {
  const target = { _mockName: name, ...overrides };

  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop in t) {
        return t[prop];
      }
      
      if (prop === 'then' || prop === 'constructor' || prop === 'prototype' || prop === 'toJSON' || typeof prop === 'symbol') {
        return undefined;
      }

      const propStr = String(prop);

      if (METHOD_NAMES.has(propStr)) {
        return function(...args) {
          return createSafeMock(`${name}:${propStr}()`);
        };
      }

      return createSafeMock(`${name}.${propStr}`);
    }
  });
}

/**
 * Execute a Lua script using the built-in engine.
 * 
 * @param {string} scriptContent - The Lua source code to execute
 * @param {string} scriptName - Name of the script (for logging)
 * @param {object} gameInfo - Active game metadata { placeId, gameName, jobId }
 * @param {function} logCallback - Function(message, type) to relay output to renderer
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function executeLua(scriptContent, scriptName, gameInfo, logCallback) {
  const log = (message, type = 'info') => {
    if (logCallback) logCallback(message, type);
  };

  log(`[Built-in Lua] Menjalankan script: ${scriptName || 'unnamed.lua'}`, 'info');

  let lua = null;
  try {
    const f = await getFactory();
    lua = await f.createEngine();

    // ---------------------------------------------------------------
    // Register global functions compatible with Roblox scripting
    // ---------------------------------------------------------------

    // print(...) → relay all arguments to console
    lua.global.set('print', (...args) => {
      const message = args.map(a => {
        if (a === null || a === undefined) return 'nil';
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
      }).join('\t');
      log(message, 'info');
    });

    // warn(...) → relay as warning
    lua.global.set('warn', (...args) => {
      const message = args.map(a => (a === null || a === undefined) ? 'nil' : String(a)).join('\t');
      log(message, 'warn');
    });

    // error() override for better reporting
    lua.global.set('error', (msg, level) => {
      log(`Error: ${msg || 'unknown error'}`, 'error');
      throw new Error(msg || 'Lua error');
    });

    // typeof helper
    lua.global.set('typeof', (value) => {
      if (value === null || value === undefined) return 'nil';
      return typeof value;
    });

    // Register JS-side async sleep/wait
    lua.global.set('__js_wait', async (seconds) => {
      const ms = Math.max(0, seconds || 0) * 1000;
      await new Promise(resolve => setTimeout(resolve, ms));
      return ms / 1000;
    });

    // Register JS-side async delay scheduler
    lua.global.set('__js_delay', (seconds, func, ...args) => {
      const ms = Math.max(0, seconds || 0) * 1000;
      setTimeout(async () => {
        try {
          if (typeof func === 'function') {
            await func(...args);
          }
        } catch (err) {
          log(`[task.delay] Error: ${err.message}`, 'error');
        }
      }, ms);
    });

    // Register JS-side fallback call handler for Proxy objects
    lua.global.set('__js_call_mock', (targetObj, ...args) => {
      const name = targetObj?._mockName || 'mock';
      return createSafeMock(`${name}()`);
    });

    // ---------------------------------------------------------------
    // Setup Roblox-specific Service Mocks
    // ---------------------------------------------------------------
    const httpServiceObject = createSafeMock('HttpService', {
      JSONEncode: (...args) => {
        const obj = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        try { return JSON.stringify(obj); } catch { return '{}'; }
      },
      JSONDecode: (...args) => {
        const str = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        try { return JSON.parse(str); } catch { return {}; }
      },
      GenerateGUID: (...args) => {
        const wrapInCurlyBraces = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        return wrapInCurlyBraces !== false ? `{${uuid}}` : uuid;
      },
      UrlEncode: (...args) => {
        const str = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        return encodeURIComponent(str || '');
      },
      GetAsync: (...args) => {
        const url = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        try { return httpGetSync(url); } catch (err) { log(`[HttpService] GetAsync Error: ${err.message}`, 'error'); return ''; }
      },
      PostAsync: (...args) => {
        const url = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        const data = (args.length > 1 && typeof args[0] === 'object') ? args[2] : args[1];
        const contentType = (args.length > 1 && typeof args[0] === 'object') ? args[3] : args[2];
        try { return httpPostSync(url, data, contentType); } catch (err) { log(`[HttpService] PostAsync Error: ${err.message}`, 'error'); return ''; }
      }
    });

    const playersMock = createSafeMock('Players', {
      LocalPlayer: createSafeMock('LocalPlayer', {
        Name: 'ElectronUser',
        DisplayName: 'ElectronUser',
        UserId: 0,
        Character: createSafeMock('Character', {
          Name: 'ElectronCharacter',
          PrimaryPart: createSafeMock('PrimaryPart'),
        }),
      }),
      GetPlayers: () => [],
      GetNameFromUserIdAsync: () => 'ElectronUser',
    });

    const workspaceMock = createSafeMock('Workspace', {
      CurrentCamera: createSafeMock('CurrentCamera'),
    });

    const runServiceMock = createSafeMock('RunService', {
      IsStudio: () => false,
      IsClient: () => true,
      IsServer: () => false,
      Heartbeat: createSafeMock('Heartbeat'),
      RenderStepped: createSafeMock('RenderStepped'),
    });

    const tweenServiceMock = createSafeMock('TweenService', {
      Create: () => createSafeMock('Tween', {
        Play: () => {},
        Cancel: () => {},
        Pause: () => {},
      })
    });

    const marketplaceServiceMock = createSafeMock('MarketplaceService', {
      GetProductInfo: (...args) => {
        const placeId = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        return {
          Name: gameInfo?.gameName || 'Roblox Game',
          Description: 'Mocked Marketplace Info',
          PriceInRobux: 0,
          Created: '',
          Updated: ''
        };
      }
    });

    const userInputServiceMock = createSafeMock('UserInputService', {
      GetMouseLocation: () => ({ X: 0, Y: 0 }),
      IsKeyDown: () => false,
    });

    const replicatedStorageMock = createSafeMock('ReplicatedStorage');
    const lightingMock = createSafeMock('Lighting');
    const starterGuiMock = createSafeMock('StarterGui');

    // Custom Game object mock
    const gameObject = createSafeMock('game', {
      PlaceId: gameInfo?.placeId ? parseInt(gameInfo.placeId) : 0,
      // If the current Place ID is Iron Soul Dungeon (117533937949084), 
      // fallback to lobby ID (9910245722) so routes resolve successfully
      GameId: gameInfo?.placeId ? (parseInt(gameInfo.placeId) === 117533937949084 ? 9910245722 : parseInt(gameInfo.placeId)) : 0,
      JobId: gameInfo?.jobId || '',
      Name: gameInfo?.gameName || 'Electron Executor',
      IsLoaded: () => true,
      Loaded: createSafeMock('game.Loaded', {
        Wait: () => {}
      }),

      // game:HttpGet(url)
      HttpGet: (...args) => {
        const url = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        try {
          return httpGetSync(url);
        } catch (err) {
          log(`[HttpGet] Error: ${err.message}`, 'error');
          return '';
        }
      },

      // game:HttpPost(url, body, contentType)
      HttpPost: (...args) => {
        const url = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        const body = (args.length > 1 && typeof args[0] === 'object') ? args[2] : args[1];
        const contentType = (args.length > 1 && typeof args[0] === 'object') ? args[3] : args[2];
        try {
          return httpPostSync(url, body, contentType);
        } catch (err) {
          log(`[HttpPost] Error: ${err.message}`, 'error');
          return '';
        }
      },

      // game:GetService(serviceName)
      GetService: (...args) => {
        const serviceName = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        const services = {
          HttpService: httpServiceObject,
          Players: playersMock,
          Workspace: workspaceMock,
          RunService: runServiceMock,
          TweenService: tweenServiceMock,
          MarketplaceService: marketplaceServiceMock,
          UserInputService: userInputServiceMock,
          ReplicatedStorage: replicatedStorageMock,
          Lighting: lightingMock,
          StarterGui: starterGuiMock,
        };
        return services[serviceName] || createSafeMock(serviceName);
      }
    });

    lua.global.set('game', gameObject);
    lua.global.set('Game', gameObject);
    lua.global.set('workspace', workspaceMock);
    lua.global.set('Workspace', workspaceMock);

    // tick() helper using JS Date for sub-millisecond precision
    lua.global.set('tick', () => Date.now() / 1000);

    // Clipboard handlers utilizing Electron or fallback memory
    const setClipboardHandler = (text) => {
      try {
        const { clipboard } = require('electron');
        if (clipboard && typeof clipboard.writeText === 'function') {
          clipboard.writeText(String(text));
          return true;
        }
      } catch (err) {
        log(`[Clipboard] Warning writing to clipboard: ${err.message}`, 'warn');
      }
      global.__mock_clipboard = String(text);
      return true;
    };

    const getClipboardHandler = () => {
      try {
        const { clipboard } = require('electron');
        if (clipboard && typeof clipboard.readText === 'function') {
          return clipboard.readText();
        }
      } catch (err) {
        // ignore
      }
      return global.__mock_clipboard || "";
    };

    lua.global.set('setclipboard', setClipboardHandler);
    lua.global.set('set_clipboard', setClipboardHandler);
    lua.global.set('writeclipboard', setClipboardHandler);
    lua.global.set('write_clipboard', setClipboardHandler);
    lua.global.set('toclipboard', setClipboardHandler);
    lua.global.set('getclipboard', getClipboardHandler);

    // ---------------------------------------------------------------
    // Setup standard exploit functions directly in JS environment
    // ---------------------------------------------------------------
    lua.global.set('identifyexecutor', () => ['Electron Executor Simulator', 'v1.0.0']);
    lua.global.set('getexecutorname', () => 'Electron Executor Simulator');
    
    // safe request library mock
    const requestHandler = (options) => {
      const url = options?.Url || options?.url;
      const method = options?.Method || options?.method || 'GET';
      const body = options?.Body || options?.body || '';
      const headers = options?.Headers || options?.headers || {};
      
      try {
        let responseText = '';
        if (method.toUpperCase() === 'POST') {
          responseText = httpPostSync(url, body, headers['Content-Type']);
        } else {
          responseText = httpGetSync(url);
        }
        return {
          StatusCode: 200,
          StatusMessage: 'OK',
          Headers: {},
          Body: responseText
        };
      } catch (err) {
        return {
          StatusCode: 500,
          StatusMessage: err.message,
          Headers: {},
          Body: ''
        };
      }
    };
    
    lua.global.set('request', requestHandler);
    lua.global.set('http_request', requestHandler);

    // ---------------------------------------------------------------
    // Inject Compatibility Layer in Lua Environment
    // ---------------------------------------------------------------
    await lua.doString(`
      loadstring = load
      
      -- Custom setfenv implementation for Lua 5.4 compatibility
      function setfenv(f, env)
        if type(f) == "function" then
          local i = 1
          while true do
            local name = debug.getupvalue(f, i)
            if not name then break end
            if name == "_ENV" then
              debug.setupvalue(f, i, env)
              break
            end
            i = i + 1
          end
        end
        return f
      end

      function getfenv(f)
        if type(f) == "function" then
          local i = 1
          while true do
            local name, val = debug.getupvalue(f, i)
            if not name then break end
            if name == "_ENV" then
              return val
            end
            i = i + 1
          end
        end
        return _G
      end

      -- Custom cloneref
      function cloneref(ref)
        return ref
      end

      -- Custom math.round
      math.round = function(x)
        if x >= 0 then
          return math.floor(x + 0.5)
        else
          return math.ceil(x - 0.5)
        end
      end

      -- Custom Instance mock
      local function luaSafeMock(name)
        local mock = {}
        setmetatable(mock, {
          __index = function(t, k)
            if k == "Parent" then return nil end
            if k == "Name" then return name end
            return luaSafeMock(name .. "." .. tostring(k))
          end,
          __newindex = function(t, k, v)
            -- ignore
          end,
          __call = function(t, ...)
            return luaSafeMock(name .. "()")
          end
        })
        return mock
      end

      Instance = {
        new = function(className, parent)
          return luaSafeMock(className)
        end
      }

      -- Roblox Enums Mock
      Enum = luaSafeMock("Enum")

      -- Roblox Datatypes Mocks
      Vector2 = {
        new = function(x, y)
          local v = luaSafeMock("Vector2")
          v.X = x or 0
          v.Y = y or 0
          return v
        end
      }

      Vector3 = {
        new = function(x, y, z)
          local v = luaSafeMock("Vector3")
          v.X = x or 0
          v.Y = y or 0
          v.Z = z or 0
          return v
        end
      }

      CFrame = {
        new = function(...)
          return luaSafeMock("CFrame")
        end
      }

      Color3 = {
        new = function(r, g, b)
          local c = luaSafeMock("Color3")
          c.R = r or 0
          c.G = g or 0
          c.B = b or 0
          return c
        end,
        fromRGB = function(r, g, b)
          return Color3.new((r or 0)/255, (g or 0)/255, (b or 0)/255)
        end,
        fromHex = function(hex)
          return Color3.new(0, 0, 0)
        end
      }

      UDim2 = {
        new = function(...)
          return luaSafeMock("UDim2")
        end,
        fromScale = function(...)
          return luaSafeMock("UDim2")
        end,
        fromOffset = function(...)
          return luaSafeMock("UDim2")
        end
      }

      UDim = {
        new = function(...)
          return luaSafeMock("UDim")
        end
      }

      TweenInfo = {
        new = function(...)
          return luaSafeMock("TweenInfo")
        end
      }

      -- Custom bit32 library for Lua 5.4 compatibility
      local bit32 = {}

      function bit32.band(a, b, ...)
        local res = a & b
        for _, v in ipairs({...}) do
          res = res & v
        end
        return res
      end

      function bit32.bor(a, b, ...)
        local res = a | b
        for _, v in ipairs({...}) do
          res = res | v
        end
        return res
      end

      function bit32.bxor(a, b, ...)
        local res = a ~ b
        for _, v in ipairs({...}) do
          res = res ~ v
        end
        return res
      end

      function bit32.bnot(a)
        return ~a
      end

      function bit32.lshift(a, b)
        return a << b
      end

      function bit32.rshift(a, b)
        local mask = 0xFFFFFFFF
        a = a & mask
        b = b & 31
        return (a >> b) & mask
      end

      function bit32.arshift(a, b)
        local mask = 0xFFFFFFFF
        a = a & mask
        b = b & 31
        if (a & 0x80000000) ~= 0 then
          return ((a >> b) | (0xFFFFFFFF << (32 - b))) & mask
        else
          return (a >> b) & mask
        end
      end

      function bit32.lrotate(x, disp)
        disp = disp & 31
        if disp == 0 then return x & 0xFFFFFFFF end
        x = x & 0xFFFFFFFF
        return ((x << disp) | (x >> (32 - disp))) & 0xFFFFFFFF
      end

      function bit32.rrotate(x, disp)
        disp = disp & 31
        if disp == 0 then return x & 0xFFFFFFFF end
        x = x & 0xFFFFFFFF
        return ((x >> disp) | (x << (32 - disp))) & 0xFFFFFFFF
      end

      function bit32.extract(x, field, width)
        width = width or 1
        local mask = (1 << width) - 1
        return (x >> field) & mask
      end

      function bit32.replace(x, v, field, width)
        width = width or 1
        local mask = ((1 << width) - 1) << field
        return (x & ~mask) | ((v << field) & mask)
      end

      function bit32.btest(a, b, ...)
        return bit32.band(a, b, ...) ~= 0
      end

      _G.bit32 = bit32

      -- Custom bit library
      local bit = {}
      for k, v in pairs(bit32) do
        bit[k] = v
      end
      bit.rol = bit32.lrotate
      bit.ror = bit32.rrotate
      function bit.tobit(x)
        x = x & 0xFFFFFFFF
        if x >= 0x80000000 then
          return x - 0x100000000
        end
        return x
      end
      function bit.tohex(x, n)
        n = n or 8
        local fmt
        if n < 0 then
          fmt = "%" .. string.format("%02X", -n) .. "x"
        else
          fmt = "%0" .. string.format("%d", n) .. "x"
        end
        return string.format(fmt, x & 0xFFFFFFFF)
      end
      function bit.bswap(x)
        x = x & 0xFFFFFFFF
        local b1 = x & 0xFF
        local b2 = (x >> 8) & 0xFF
        local b3 = (x >> 16) & 0xFF
        local b4 = (x >> 24) & 0xFF
        return (b1 << 24) | (b2 << 16) | (b3 << 8) | b4
      end

      _G.bit = bit

      -- Exploit environment mocks
      local env_storage = {}
      
      function getgenv()
        return _G
      end

      function getfenv(fn)
        return getfenv(fn)
      end

      function getrenv()
        return _G
      end
      
      function getreg()
        return env_storage
      end
      
      function getgc()
        return {}
      end
      
      function getinstances()
        return {}
      end
      
      function getnilinstances()
        return {}
      end
      
      -- Metatable/hook mocks
      local metatables = {}
      
      function getrawmetatable(tbl)
        if not metatables[tbl] then
          metatables[tbl] = {}
        end
        return metatables[tbl]
      end
      
      function setrawmetatable(tbl, mt)
        metatables[tbl] = mt
        return true
      end
      
      function setreadonly(tbl, readonly)
        return true
      end
      
      function isreadonly(tbl)
        return false
      end
      
      function hookmetamethod(tbl, method, new_func)
        return new_func
      end
      
      function hookfunction(old_func, new_func)
        return new_func
      end
      
      -- Http request libraries
      http = {
        request = request
      }
      
      syn = {
        request = request,
        toast_notification = function(options)
          print("[Notification] " .. tostring(options.Title) .. ": " .. tostring(options.Content))
        end
      }
      
      -- File system mocks
      local virtual_files = {}
      
      function readfile(filename)
        return virtual_files[filename] or ""
      end
      
      function writefile(filename, content)
        virtual_files[filename] = content
      end
      
      function appendfile(filename, content)
        virtual_files[filename] = (virtual_files[filename] or "") .. content
      end
      
      function isfile(filename)
        return virtual_files[filename] ~= nil
      end
      
      function listfiles()
        local files = {}
        for k, _ in pairs(virtual_files) do
          table.insert(files, k)
        end
        return files
      end
      
      function makefolder(foldername)
        return true
      end
      
      function delfolder(foldername)
        return true
      end
      
      function delfile(filename)
        virtual_files[filename] = nil
      end
      
      -- Execution & Wait Mocks
      function wait(seconds)
        return __js_wait(seconds):await()
      end
      
      task = {
        wait = function(seconds)
          return __js_wait(seconds):await()
        end,
        spawn = function(func, ...)
          if type(func) == "function" then
            func(...)
          end
        end,
        defer = function(func, ...)
          if type(func) == "function" then
            func(...)
          end
        end,
        delay = function(seconds, func, ...)
          __js_delay(seconds, func, ...)
        end
      }

      function spawn(func, ...)
        task.spawn(func, ...)
      end

      function delay(seconds, func, ...)
        task.delay(seconds, func, ...)
      end

      -- Override js_proxy __call metamethod to support calling arbitrary methods on mocked objects
      local registry = debug.getregistry()
      if registry and registry["js_proxy"] then
        registry["js_proxy"].__call = function(self, ...)
          return __js_call_mock(self, ...)
        end
      end
    `);

    // ---------------------------------------------------------------
    // Execute the script
    // ---------------------------------------------------------------
    await lua.doString(scriptContent);

    log(`[Built-in Lua] Script "${scriptName || 'unnamed.lua'}" berhasil dieksekusi.`, 'info');
    return { success: true };

  } catch (err) {
    console.error("JS Error Stack:", err.stack || err);
    const errorMsg = err.message || String(err);
    log(`[Built-in Lua] Error: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  } finally {
    // Clean up engine to free memory
    if (lua) {
      try { lua.global.close(); } catch { /* ignore cleanup errors */ }
    }
  }
}

module.exports = { executeLua };

// ====================================================================
// LUA WORKER THREAD
// Runs Lua scripts in a dedicated Worker Thread so the Electron main
// process never blocks (prevents "Not Responding" / app freeze).
// ====================================================================

const { parentPort, workerData } = require('worker_threads');
const { LuaFactory } = require('wasmoon');
const cp = require('child_process');

const { scriptContent, scriptName, gameInfo } = workerData;

// Send log messages back to the main thread
function log(message, type = 'info') {
  parentPort.postMessage({ type: 'log', message, logType: type });
}

// Asynchronous HTTP GET helper using child_process.exec (non-blocking within worker)
function httpGet(url) {
  try {
    const result = cp.spawnSync('curl', [
      '-sL',
      '-m', '10',
      '-A', 'Roblox/WinInet',
      '-H', 'Accept: */*',
      url
    ], { encoding: 'utf-8', timeout: 12000 });

    if (result.status === 0) {
      return result.stdout;
    }
    return '';
  } catch (err) {
    return '';
  }
}

// Synchronous HTTP POST helper
function httpPost(url, body, contentType) {
  try {
    const inputBody = typeof body === 'object' ? JSON.stringify(body) : (body || '');
    const result = cp.spawnSync('curl', [
      '-sL',
      '-m', '10',
      '-X', 'POST',
      '-A', 'Roblox/WinInet',
      '-H', `Content-Type: ${contentType || 'application/json'}`,
      '-H', 'Accept: */*',
      '-d', '@-',
      url
    ], {
      input: inputBody,
      encoding: 'utf-8',
      timeout: 12000
    });

    if (result.status === 0) {
      return result.stdout;
    }
    return '';
  } catch (err) {
    return '';
  }
}

// Comprehensive list of common Roblox method/event-wait names
const METHOD_NAMES = new Set([
  'HttpGet', 'HttpPost', 'GetService', 'getService', 'IsLoaded', 'Wait', 'wait',
  'JSONEncode', 'JSONDecode', 'GenerateGUID', 'UrlEncode', 'GetAsync', 'PostAsync',
  'Clone', 'clone', 'Destroy', 'destroy', 'ClearAllChildren', 'Remove', 'remove',
  'GetChildren', 'getChildren', 'GetDescendants', 'getDescendants',
  'FindFirstChild', 'findFirstChild', 'WaitForChild', 'waitForChild',
  'FindFirstChildOfClass', 'FindFirstChildWhichIsA',
  'FindFirstAncestor', 'FindFirstAncestorOfClass', 'FindFirstAncestorWhichIsA',
  'IsA', 'isA', 'isa',
  'Kick', 'kick', 'GetPlayers', 'getPlayers', 'GetNameFromUserIdAsync',
  'GetMouseLocation', 'IsKeyDown',
  'Create', 'Play', 'Cancel', 'Pause',
  'Connect', 'connect', 'Disconnect', 'disconnect', 'Fire', 'fire',
  'IsStudio', 'IsClient', 'IsServer',
  'GetProductInfo',
  'PivotTo', 'GetPivot', 'SetPrimaryPartCFrame', 'GetPrimaryPartCFrame',
]);

function createSafeMock(name = 'mock', overrides = {}) {
  const target = { _mockName: name, ...overrides };

  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop in t) return t[prop];
      if (prop === 'then' || prop === 'constructor' || prop === 'prototype' || prop === 'toJSON' || typeof prop === 'symbol') {
        return undefined;
      }
      const propStr = String(prop);
      if (METHOD_NAMES.has(propStr)) {
        return function (...args) {
          return createSafeMock(`${name}:${propStr}()`);
        };
      }
      return createSafeMock(`${name}.${propStr}`);
    }
  });
}

// ── Main execution ─────────────────────────────────────────────────
async function run() {
  let lua = null;
  try {
    log(`[Built-in Lua] Menjalankan script: ${scriptName || 'unnamed.lua'}`, 'info');

    const factory = new LuaFactory();
    lua = await factory.createEngine();

    // ── Register global functions ────────────────────────────────
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

    lua.global.set('warn', (...args) => {
      const message = args.map(a => (a === null || a === undefined) ? 'nil' : String(a)).join('\t');
      log(message, 'warn');
    });

    lua.global.set('error', (msg, level) => {
      log(`Error: ${msg || 'unknown error'}`, 'error');
      throw new Error(msg || 'Lua error');
    });

    lua.global.set('typeof', (value) => {
      if (value === null || value === undefined) return 'nil';
      return typeof value;
    });

    lua.global.set('__js_wait', async (seconds) => {
      const ms = Math.max(0, seconds || 0) * 1000;
      await new Promise(resolve => setTimeout(resolve, ms));
      return ms / 1000;
    });

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

    lua.global.set('__js_call_mock', (targetObj, ...args) => {
      const name = targetObj?._mockName || 'mock';
      return createSafeMock(`${name}()`);
    });

    // ── Roblox Service Mocks ─────────────────────────────────────
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
        try { return httpGet(url); } catch (err) { log(`[HttpService] GetAsync Error: ${err.message}`, 'error'); return ''; }
      },
      PostAsync: (...args) => {
        const url = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        const data = (args.length > 1 && typeof args[0] === 'object') ? args[2] : args[1];
        const contentType = (args.length > 1 && typeof args[0] === 'object') ? args[3] : args[2];
        try { return httpPost(url, data, contentType); } catch (err) { log(`[HttpService] PostAsync Error: ${err.message}`, 'error'); return ''; }
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

    const gameObject = createSafeMock('game', {
      PlaceId: gameInfo?.placeId ? parseInt(gameInfo.placeId) : 0,
      GameId: gameInfo?.placeId ? (parseInt(gameInfo.placeId) === 117533937949084 ? 9910245722 : parseInt(gameInfo.placeId)) : 0,
      JobId: gameInfo?.jobId || '',
      Name: gameInfo?.gameName || 'Electron Executor',
      IsLoaded: () => true,
      Loaded: createSafeMock('game.Loaded', {
        Wait: () => {}
      }),

      HttpGet: (...args) => {
        const url = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        try { return httpGet(url); } catch (err) { log(`[HttpGet] Error: ${err.message}`, 'error'); return ''; }
      },

      HttpPost: (...args) => {
        const url = (args.length > 1 && typeof args[0] === 'object') ? args[1] : args[0];
        const body = (args.length > 1 && typeof args[0] === 'object') ? args[2] : args[1];
        const contentType = (args.length > 1 && typeof args[0] === 'object') ? args[3] : args[2];
        try { return httpPost(url, body, contentType); } catch (err) { log(`[HttpPost] Error: ${err.message}`, 'error'); return ''; }
      },

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
    lua.global.set('tick', () => Date.now() / 1000);

    // Clipboard (memory-only in worker since no Electron clipboard access)
    let clipboardMem = '';
    const setClipboardHandler = (text) => { clipboardMem = String(text); return true; };
    const getClipboardHandler = () => clipboardMem;

    lua.global.set('setclipboard', setClipboardHandler);
    lua.global.set('set_clipboard', setClipboardHandler);
    lua.global.set('writeclipboard', setClipboardHandler);
    lua.global.set('write_clipboard', setClipboardHandler);
    lua.global.set('toclipboard', setClipboardHandler);
    lua.global.set('getclipboard', getClipboardHandler);

    lua.global.set('identifyexecutor', () => ['Electron Executor Simulator', 'v1.0.0']);
    lua.global.set('getexecutorname', () => 'Electron Executor Simulator');

    const requestHandler = (options) => {
      const url = options?.Url || options?.url;
      const method = options?.Method || options?.method || 'GET';
      const body = options?.Body || options?.body || '';
      const headers = options?.Headers || options?.headers || {};

      try {
        let responseText = '';
        if (method.toUpperCase() === 'POST') {
          responseText = httpPost(url, body, headers['Content-Type']);
        } else {
          responseText = httpGet(url);
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

    // ── Lua compatibility layer ──────────────────────────────────
    await lua.doString(`
      loadstring = load
      
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

      function cloneref(ref)
        return ref
      end

      math.round = function(x)
        if x >= 0 then
          return math.floor(x + 0.5)
        else
          return math.ceil(x - 0.5)
        end
      end

      local function luaSafeMock(name)
        local mock = {}
        setmetatable(mock, {
          __index = function(t, k)
            if k == "Parent" then return nil end
            if k == "Name" then return name end
            return luaSafeMock(name .. "." .. tostring(k))
          end,
          __newindex = function(t, k, v)
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

      Enum = luaSafeMock("Enum")

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

      local env_storage = {}
      
      function getgenv()
        return _G
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
      
      function gethui()
        return luaSafeMock("HUI")
      end
      
      function getinstances()
        return {}
      end
      
      function hookmetamethod(tbl, method, new_func)
        local mt = getrawmetatable(tbl)
        if mt then
          local old = mt[method]
          mt[method] = new_func
          return old
        end
        return new_func
      end
      
      function getnilinstances()
        return {}
      end
      
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
      
      function hookfunction(old_func, new_func)
        return new_func
      end
      
      http = {
        request = request
      }
      
      syn = {
        request = request,
        toast_notification = function(options)
          print("[Notification] " .. tostring(options.Title) .. ": " .. tostring(options.Content))
        end
      }
      
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

      local registry = debug.getregistry()
      if registry and registry["js_proxy"] then
        registry["js_proxy"].__call = function(self, ...)
          return __js_call_mock(self, ...)
        end
      end
    `);

    // ── Execute the user script ──────────────────────────────────
    await lua.doString(scriptContent);

    log(`[Built-in Lua] Script "${scriptName || 'unnamed.lua'}" berhasil dieksekusi.`, 'info');
    parentPort.postMessage({ type: 'result', success: true });

  } catch (err) {
    const errorMsg = err.message || String(err);
    log(`[Built-in Lua] Error: ${errorMsg}`, 'error');
    parentPort.postMessage({ type: 'result', success: false, error: errorMsg });
  } finally {
    if (lua) {
      try { lua.global.close(); } catch { /* ignore cleanup errors */ }
    }
  }
}

run();

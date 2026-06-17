const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { startServer, hasConnectedClients, getActiveGameInfo } = require('./server');
const db = require('./db');
const emailService = require('./emailService');
const luaEngine = require('./luaEngine');

let mainWindow = null;
let serverInstance = null;
const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';

// Function to copy loader.lua automatically to Roblox plugin folders
function installRobloxHook() {
  try {
    const homeDir = os.homedir();
    const loaderPath = path.join(__dirname, 'loader.lua');
    if (!fs.existsSync(loaderPath)) {
      console.log('[Hook] loader.lua not found, skipping hook install');
      return;
    }

    const loaderContent = fs.readFileSync(loaderPath, 'utf8');

    // 1. Roblox Studio Plugins Folder
    const studioPluginsDir = path.join(homeDir, 'Library', 'Application Support', 'Roblox', 'Plugins');
    fs.mkdirSync(studioPluginsDir, { recursive: true });
    fs.writeFileSync(path.join(studioPluginsDir, 'ElectronLoader.lua'), loaderContent);
    console.log('[Hook] Successfully copied loader.lua to Roblox Studio Plugins');

    // 2. Typical exploit autoexec folders (MacSploit, Hydrogen, Wave)
    const exploitPaths = [
      path.join(homeDir, 'Library', 'Application Support', 'MacSploit', 'autoexec'),
      path.join(homeDir, 'Library', 'Application Support', 'Hydrogen', 'autoexec'),
      path.join(homeDir, 'Library', 'Application Support', 'Wave', 'autoexec')
    ];

    exploitPaths.forEach(dir => {
      // Check if parent directory exists (which means the exploit is installed)
      if (fs.existsSync(path.dirname(dir))) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'ElectronLoader.lua'), loaderContent);
        console.log(`[Hook] Successfully copied loader.lua to autoexec: ${dir}`);
      }
    });
  } catch (err) {
    console.error('[Hook Error] Failed to install Roblox hooks:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 800,
    minHeight: 500,
    icon: path.join(__dirname, 'public', 'logo.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0b0f17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'out', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Active game detection cache
let lastParsedLogFile = null;
let lastParsedLogSize = 0;
let currentDetectedPlaceId = null;
let currentDetectedGameName = null;

function getRobloxLogsDir() {
  const homeDir = os.homedir();
  if (process.platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Local', 'Roblox', 'logs');
  } else {
    return path.join(homeDir, 'Library', 'Logs', 'Roblox');
  }
}

function fetchGameNameFromPlaceId(placeId) {
  return new Promise((resolve) => {
    const https = require('https');
    const universeUrl = `https://apis.roblox.com/universes/v1/places/${placeId}/universe`;
    
    https.get(universeUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const universeId = json.universeId;
          if (!universeId) {
            resolve('Roblox Game');
            return;
          }
          
          const gamesUrl = `https://games.roblox.com/v1/games?universeIds=${universeId}`;
          https.get(gamesUrl, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
              try {
                const json2 = JSON.parse(data2);
                if (json2.data && json2.data.length > 0) {
                  resolve(json2.data[0].name || 'Roblox Game');
                } else {
                  resolve('Roblox Game');
                }
              } catch (e) {
                resolve('Roblox Game');
              }
            });
          }).on('error', () => resolve('Roblox Game'));
        } catch (e) {
          resolve('Roblox Game');
        }
      });
    }).on('error', () => resolve('Roblox Game'));
  });
}

async function checkRobloxActiveGame() {
  try {
    const logsDir = getRobloxLogsDir();
    if (!fs.existsSync(logsDir)) return;

    const files = fs.readdirSync(logsDir)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const filePath = path.join(logsDir, f);
        return {
          name: f,
          path: filePath,
          mtime: fs.statSync(filePath).mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) return;

    const latestLog = files[0];
    const stat = fs.statSync(latestLog.path);
    
    if (latestLog.path !== lastParsedLogFile || stat.size !== lastParsedLogSize) {
      lastParsedLogFile = latestLog.path;
      lastParsedLogSize = stat.size;

      const content = fs.readFileSync(latestLog.path, 'utf8');
      
      let lastJoinIndex = -1;
      let detectedId = null;

      const joiningMatches = [...content.matchAll(/Joining game '.*?' place (\d+)/gi)];
      if (joiningMatches.length > 0) {
        const lastMatch = joiningMatches[joiningMatches.length - 1];
        lastJoinIndex = lastMatch.index;
        detectedId = lastMatch[1];
      }

      const placeIdMatches = [...content.matchAll(/placeid:(\d+)/gi)];
      if (placeIdMatches.length > 0) {
        const lastMatch = placeIdMatches[placeIdMatches.length - 1];
        if (lastMatch.index > lastJoinIndex) {
          lastJoinIndex = lastMatch.index;
          detectedId = lastMatch[1];
        }
      }

      const jsonPlaceIdMatches = [...content.matchAll(/"PlaceId"\s*:\s*(\d+)/gi)];
      if (jsonPlaceIdMatches.length > 0) {
        const lastMatch = jsonPlaceIdMatches[jsonPlaceIdMatches.length - 1];
        if (lastMatch.index > lastJoinIndex) {
          lastJoinIndex = lastMatch.index;
          detectedId = lastMatch[1];
        }
      }

      // Check for disconnections in the logs
      let lastDisconnectIndex = -1;
      const disconnectPatterns = [
        /Client:Disconnect/gi,
        /Disconnected from server/gi,
        /Sending disconnect/gi,
        /MegaReplicatorLogDisconnectCleanUpLog/gi
      ];

      for (const pattern of disconnectPatterns) {
        const matches = [...content.matchAll(pattern)];
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          if (lastMatch.index > lastDisconnectIndex) {
            lastDisconnectIndex = lastMatch.index;
          }
        }
      }

      const finalPlaceId = (lastDisconnectIndex > lastJoinIndex) ? null : detectedId;

      if (finalPlaceId !== currentDetectedPlaceId) {
        currentDetectedPlaceId = finalPlaceId;
        console.log(`[Logs Parser] Active Place ID changed to: ${finalPlaceId}`);
        
        let gameName = null;
        if (finalPlaceId) {
          gameName = await fetchGameNameFromPlaceId(finalPlaceId);
          currentDetectedGameName = gameName;
          console.log(`[Logs Parser] Game name resolved: ${gameName}`);
        } else {
          currentDetectedGameName = null;
        }

        const gameInfoPayload = {
          placeId: finalPlaceId,
          gameName: currentDetectedGameName,
          jobId: null,
          executor: 'AutoDetect'
        };

        // Update active game info in the server module as well
        const { setActiveGameInfo } = require('./server');
        setActiveGameInfo(gameInfoPayload);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('roblox-handshake', gameInfoPayload);
        }
      }
    }
  } catch (err) {
    console.error('[Logs Parser Error] Failed to parse Roblox logs:', err);
  }
}

app.whenReady().then(() => {
  // Set custom macOS Dock icon
  if (process.platform === 'darwin') {
    try {
      const iconPath = path.join(__dirname, 'public', 'logo.png');
      if (fs.existsSync(iconPath)) {
        const image = nativeImage.createFromPath(iconPath);
        app.dock.setIcon(image);
        console.log('[Dock] Successfully set custom macOS Dock icon');
      }
    } catch (err) {
      console.error('[Dock Error] Failed to set macOS Dock icon:', err);
    }
  }

  // 1. Run automatic script hook copy on startup
  installRobloxHook();

  // 2. Start local express/websocket server
  serverInstance = startServer(8392, (type, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (type === 'log') {
        mainWindow.webContents.send('server-log', data);
      } else if (type === 'roblox-log') {
        mainWindow.webContents.send('roblox-log', data);
      } else if (type === 'status') {
        mainWindow.webContents.send('client-status', data);
      } else if (type === 'roblox-handshake') {
        mainWindow.webContents.send('roblox-handshake', data);
      }
    }
  });

  // 3. Initialize Database from saved configuration
  db.initDb().then((res) => {
    if (res.success) {
      console.log('[DB] Automatic database initialization succeeded.');
    }
  });

  // 4. Background polling to auto-detect if Roblox Player is running (macOS and Windows cross-platform support)
  let robloxRunningState = { running: false, type: null };
  setInterval(() => {
    if (process.platform === 'win32') {
      // Windows process detection via tasklist
      exec('tasklist', (err, stdout) => {
        if (err) {
          console.error('[Process] Failed to query tasklist:', err.message);
          return;
        }
        const lowerOut = stdout.toLowerCase();
        const isClientRunning = lowerOut.includes('robloxplayerbeta.exe') || lowerOut.includes('robloxplayer.exe');
        
        if (isClientRunning) {
          updateRunningState(true, 'Roblox Client');
          checkRobloxActiveGame();
        } else {
          updateRunningState(false, null);
        }
      });
    } else {
      // macOS process detection via pgrep
      exec('pgrep -x "RobloxPlayer"', (err, stdout) => {
        const isRunning = !!stdout.trim();
        if (isRunning) {
          updateRunningState(true, 'Roblox Client');
          checkRobloxActiveGame();
        } else {
          updateRunningState(false, null);
        }
      });
    }
  }, 3000);

  function updateRunningState(running, type) {
    if (robloxRunningState.running !== running || robloxRunningState.type !== type) {
      robloxRunningState = { running, type };
      console.log(`[Process] Roblox running status changed: ${running} (${type})`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('roblox-process-status', robloxRunningState);
      }
      if (!running) {
        lastParsedLogFile = null;
        lastParsedLogSize = 0;
        currentDetectedPlaceId = null;
        currentDetectedGameName = null;
        const { setActiveGameInfo } = require('./server');
        setActiveGameInfo(null);
      }
    }
  }

  // Allow getting current process status
  ipcMain.handle('get-roblox-process', () => {
    return robloxRunningState;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler to execute scripts — dual-mode: external server OR built-in Lua engine
ipcMain.on('execute-script', async (event, { scriptContent, scriptName }) => {
  // Check if there are any external WebSocket clients connected (exploit/Studio)
  if (hasConnectedClients()) {
    // Mode 1: Forward to local Express server (external executor connected)
    const http = require('http');
    const postData = JSON.stringify({ scriptContent, scriptName });

    const req = http.request({
      hostname: 'localhost',
      port: 8392,
      path: '/execute',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`[Execute] Server response: ${body}`);
      });
    });

    req.on('error', (err) => {
      console.error('[Execute] Failed to send script to server:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-log', `Execute error: ${err.message}`);
      }
    });

    req.write(postData);
    req.end();
  } else {
    // Mode 2: Run via built-in Lua engine (no external executor)
    console.log(`[Execute] No external clients connected. Using built-in Lua engine for: ${scriptName}`);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-log', `[Built-in Simulator] Menjalankan: ${scriptName} (Catatan: Berjalan di Simulator karena tidak ada klien Roblox yang terhubung)`);
    }

    const gameInfo = getActiveGameInfo();
    const result = await luaEngine.executeLua(scriptContent, scriptName, gameInfo, (message, type) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lua-output', { message, type });
      }
    });

    if (result.success) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-log', `[Built-in Simulator] Selesai: ${scriptName}`);
      }
    } else {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-log', `[Built-in Simulator] Gagal: ${result.error}`);
      }
    }
  }
});

// IPC Handler to open local files
ipcMain.handle('open-file', async () => {
  if (!mainWindow) return null;
  
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Lua Script',
    properties: ['openFile'],
    filters: [
      { name: 'Lua Scripts', extensions: ['lua', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!canceled && filePaths.length > 0) {
    try {
      const content = fs.readFileSync(filePaths[0], 'utf8');
      return {
        name: path.basename(filePaths[0]),
        content: content,
        path: filePaths[0]
      };
    } catch (err) {
      console.error('Failed to read file:', err);
      return null;
    }
  }
  return null;
});

// Roblox Detection & Launcher handlers
ipcMain.handle('detect-roblox', () => {
  const homeDir = os.homedir();
  const robloxExists = fs.existsSync('/Applications/Roblox.app') || fs.existsSync(path.join(homeDir, 'Applications', 'Roblox.app'));
  const studioExists = fs.existsSync('/Applications/RobloxStudio.app') || fs.existsSync(path.join(homeDir, 'Applications', 'RobloxStudio.app'));
  
  return {
    roblox: robloxExists,
    studio: studioExists
  };
});

ipcMain.handle('launch-roblox', async () => {
  const homeDir = os.homedir();
  const robloxExists = fs.existsSync('/Applications/Roblox.app') || fs.existsSync(path.join(homeDir, 'Applications', 'Roblox.app'));
  const studioExists = fs.existsSync('/Applications/RobloxStudio.app') || fs.existsSync(path.join(homeDir, 'Applications', 'RobloxStudio.app'));

  if (robloxExists) {
    exec('open -a Roblox');
    return { success: true, app: 'Roblox Client' };
  } else if (studioExists) {
    exec('open -a RobloxStudio');
    return { success: true, app: 'Roblox Studio' };
  } else {
    return { success: false, error: 'Neither Roblox nor Roblox Studio was found on this Mac.' };
  }
});

// IPC handlers for custom window controls
ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

// Database-related IPC handlers
ipcMain.handle('db-init', async (event, config) => {
  if (config) {
    db.saveConfig(config);
  }
  return await db.initDb(config);
});

ipcMain.handle('db-load-config', () => {
  return db.loadConfig();
});

// In-memory OTP session cache: email -> { username, otp, expiresAt, verified }
const activeOtpSessions = new Map();

ipcMain.handle('auth-request-otp', async (event, { username, email }) => {
  // Check if connected
  if (!db.isDbConnected()) return { success: false, error: 'Database disconnected' };
  
  // Verify if username or email already taken
  const checkRes = await db.checkAvailability(username, email);
  if (checkRes.usernameTaken) return { success: false, error: 'Username already taken' };
  if (checkRes.emailTaken) return { success: false, error: 'Email already taken' };

  // Generate 6-digit numeric OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiration in 5 minutes (as requested by user)
  const expiresAt = Date.now() + 5 * 60 * 1000;
  
  activeOtpSessions.set(email, {
    username,
    otpCode,
    expiresAt,
    verified: false
  });

  try {
    // Dispatch OTP privately via email
    const mailRes = await emailService.sendOtp(email, otpCode);
    
    // If using Ethereal fallback, notify the renderer process so developers can view/test OTP inside the app console
    if (mailRes && mailRes.type === 'ethereal') {
      event.sender.send('developer-otp-notification', {
        email,
        otpCode,
        previewUrl: mailRes.previewUrl
      });
    }
    return { success: true };
  } catch (err) {
    console.error(`[AUTH] Failed to send OTP email to ${email}:`, err.message);
    activeOtpSessions.delete(email); // Clean up session on failure
    return { success: false, error: `Failed to send email: ${err.message}` };
  }
});

ipcMain.handle('auth-verify-otp', (event, { email, otp }) => {
  const session = activeOtpSessions.get(email);
  if (!session) return { success: false, error: 'OTP session not found' };
  
  if (Date.now() > session.expiresAt) {
    activeOtpSessions.delete(email);
    return { success: false, error: 'OTP has expired' };
  }

  // Check if OTP was already used
  if (!session.otpCode) {
    return { success: false, error: 'This verification code has already been verified and used' };
  }

  if (session.otpCode !== otp.trim()) {
    return { success: false, error: 'Invalid verification code' };
  }

  // Mark as verified & consume the OTP code (making it single-use)
  session.verified = true;
  session.otpCode = null;
  activeOtpSessions.set(email, session);
  return { success: true };
});

ipcMain.handle('auth-register', async (event, { email, password }) => {
  const session = activeOtpSessions.get(email);
  if (!session) return { success: false, error: 'Registration session expired' };
  if (!session.verified) return { success: false, error: 'OTP has not been verified yet' };

  const res = await db.registerUser(session.username, email, password);
  if (res.success) {
    activeOtpSessions.delete(email);
  }
  return res;
});

ipcMain.handle('auth-login', async (event, { identifier, password }) => {
  return await db.loginUser(identifier, password);
});

ipcMain.handle('db-save-script', async (event, { userId, title, content, gameName, placeIds, isFavorite, scriptId }) => {
  return await db.saveScript(userId, title, content, gameName, placeIds, isFavorite, scriptId);
});

ipcMain.handle('db-get-scripts', async (event, userId) => {
  return await db.getScripts(userId);
});

ipcMain.handle('db-get-stats', async () => {
  return await db.getDeviceStats();
});

ipcMain.handle('db-get-device-id', () => {
  return db.getDeviceId();
});

ipcMain.handle('db-status', () => {
  return db.isDbConnected();
});

// Local scripts directory path: Documents/ElectronExecutor/scripts
function getLocalScriptsDir() {
  const documentsDir = app.getPath('documents');
  const baseDir = path.join(documentsDir, 'ElectronExecutor');
  const scriptsDir = path.join(baseDir, 'scripts');
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }
  return scriptsDir;
}

function getLocalScripts() {
  const dir = getLocalScriptsDir();
  try {
    let files = fs.readdirSync(dir).filter(f => f.endsWith('.lua') || f.endsWith('.txt'));
    
    // If empty (new install), create default Untitled-1.lua
    if (files.length === 0) {
      const defaultFileName = 'Untitled-1.lua';
      const defaultPath = path.join(dir, defaultFileName);
      fs.writeFileSync(defaultPath, '-- Untitled 1\n', 'utf8');
      files = [defaultFileName];
    }
    
    const scripts = [];
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        const content = fs.readFileSync(filePath, 'utf8');
        scripts.push({
          name: file,
          content: content,
          path: filePath
        });
      }
    });
    return scripts;
  } catch (err) {
    console.error('[Scripts] Failed to read local scripts:', err);
    return [];
  }
}

function saveLocalScript(fileName, content) {
  const dir = getLocalScriptsDir();
  const filePath = path.join(dir, fileName);
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true, path: filePath };
  } catch (err) {
    console.error('[Scripts] Failed to save script:', err);
    return { success: false, error: err.message };
  }
}

function renameLocalScript(oldName, newName) {
  const dir = getLocalScriptsDir();
  const oldPath = path.join(dir, oldName);
  const newPath = path.join(dir, newName);
  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      return { success: true, path: newPath };
    }
    return { success: false, error: 'Original file not found' };
  } catch (err) {
    console.error('[Scripts] Failed to rename script:', err);
    return { success: false, error: err.message };
  }
}

function deleteLocalScript(fileName) {
  const dir = getLocalScriptsDir();
  const filePath = path.join(dir, fileName);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (err) {
    console.error('[Scripts] Failed to delete script:', err);
    return { success: false, error: err.message };
  }
}

// Register local script IPC handlers
ipcMain.handle('get-local-scripts', () => {
  return getLocalScripts();
});

ipcMain.handle('save-local-script', (event, { fileName, content }) => {
  return saveLocalScript(fileName, content);
});

ipcMain.handle('rename-local-script', (event, { oldName, newName }) => {
  return renameLocalScript(oldName, newName);
});

ipcMain.handle('delete-local-script', (event, { fileName }) => {
  return deleteLocalScript(fileName);
});

ipcMain.handle('db-get-linked-user', async () => {
  const deviceId = db.getDeviceId();
  return await db.getLinkedUser(deviceId);
});

ipcMain.handle('db-unlink-device', async () => {
  const deviceId = db.getDeviceId();
  return await db.unlinkDevice(deviceId);
});

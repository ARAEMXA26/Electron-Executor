const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  executeScript: (scriptContent, scriptName) => ipcRenderer.send('execute-script', { scriptContent, scriptName }),
  openFile: () => ipcRenderer.invoke('open-file'),
  onServerLog: (callback) => ipcRenderer.on('server-log', (event, value) => callback(value)),
  onRobloxLog: (callback) => ipcRenderer.on('roblox-log', (event, value) => callback(value)),
  onClientStatus: (callback) => ipcRenderer.on('client-status', (event, value) => callback(value)),
  
  // Roblox Detection and Launching
  detectRoblox: () => ipcRenderer.invoke('detect-roblox'),
  launchRoblox: () => ipcRenderer.invoke('launch-roblox'),
  attachExecutor: () => ipcRenderer.invoke('attach-executor'),
  getRobloxProcess: () => ipcRenderer.invoke('get-roblox-process'),
  onRobloxProcessStatus: (callback) => ipcRenderer.on('roblox-process-status', (event, value) => callback(value)),
  onRobloxHandshake: (callback) => ipcRenderer.on('roblox-handshake', (event, value) => callback(value)),
  onLuaOutput: (callback) => ipcRenderer.on('lua-output', (event, value) => callback(value)),
  
  // Database handlers
  dbInit: (config) => ipcRenderer.invoke('db-init', config),
  dbLoadConfig: () => ipcRenderer.invoke('db-load-config'),
  dbSaveScript: (params) => ipcRenderer.invoke('db-save-script', params),
  dbGetScripts: (userId) => ipcRenderer.invoke('db-get-scripts', userId),
  dbGetStats: (userId) => ipcRenderer.invoke('db-get-stats', userId),
  dbGetDeviceId: () => ipcRenderer.invoke('db-get-device-id'),
  dbStatus: () => ipcRenderer.invoke('db-status'),
  dbGetLinkedUser: () => ipcRenderer.invoke('db-get-linked-user'),
  dbUnlinkDevice: () => ipcRenderer.invoke('db-unlink-device'),
  
  // Local script storage handlers
  getLocalScripts: () => ipcRenderer.invoke('get-local-scripts'),
  saveLocalScript: (fileName, content) => ipcRenderer.invoke('save-local-script', { fileName, content }),
  renameLocalScript: (oldName, newName) => ipcRenderer.invoke('rename-local-script', { oldName, newName }),
  deleteLocalScript: (fileName) => ipcRenderer.invoke('delete-local-script', { fileName }),
  
  // Auth flows (Login & OTP Register)
  authLogin: (identifier, password) => ipcRenderer.invoke('auth-login', { identifier, password }),
  authRequestOtp: (username, email) => ipcRenderer.invoke('auth-request-otp', { username, email }),
  authVerifyOtp: (email, otp) => ipcRenderer.invoke('auth-verify-otp', { email, otp }),
  authRegister: (email, password) => ipcRenderer.invoke('auth-register', { email, password }),
  onDeveloperOtp: (callback) => ipcRenderer.on('developer-otp-notification', (event, value) => callback(value)),
  
  // Custom Window Controls
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize')
});

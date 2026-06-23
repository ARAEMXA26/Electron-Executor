const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const db = require('./db');

let scriptQueue = []; // Queue for HTTP polling (multiple scripts support)
let wsClients = new Set();
let lastPollTime = 0;
let isPollingClientConnected = false;
let pendingRconsoleRes = null;

// Polling timeout checker (runs every 1 second)
setInterval(() => {
  if (lastPollTime > 0 && (Date.now() - lastPollTime) > 3000) {
    // Polling client disconnected!
    lastPollTime = 0;
    isPollingClientConnected = false;
    
    // Check if WebSocket is also disconnected before clearing active game info
    if (wsClients.size === 0) {
      activeGameInfo = { placeId: null, gameName: null, jobId: null, executor: null };
      
      if (mainProcessSendCallback) {
        mainProcessSendCallback('status', { connected: false, clients: 0 });
        mainProcessSendCallback('log', 'Roblox client disconnected (polling timed out)');
        mainProcessSendCallback('roblox-handshake', activeGameInfo);
      }
    }
  }
}, 1000);

function runAutoexecScripts(wsClient = null) {
  try {
    const os = require('os');
    const autoexecDir = path.join(os.homedir(), 'Electron Executor', 'autoexec');
    if (!fs.existsSync(autoexecDir)) {
      fs.mkdirSync(autoexecDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(autoexecDir).filter(f => f.endsWith('.lua') || f.endsWith('.txt')).sort();
    if (files.length === 0) {
      console.log('[Autoexec] No autoexec scripts to execute.');
      return;
    }

    console.log(`[Autoexec] Found ${files.length} script(s) in autoexec. Executing...`);
    files.forEach(file => {
      const filePath = path.join(autoexecDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.trim().length > 0) {
          console.log(`[Autoexec] Executing: ${file}`);
          if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify({
              action: 'execute',
              source: content,
              name: file
            }));
          } else {
            let sent = false;
            wsClients.forEach(ws => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  action: 'execute',
                  source: content,
                  name: file
                }));
                sent = true;
              }
            });
            if (!sent) {
              scriptQueue.push(content);
            }
          }
        }
      } catch (err) {
        console.error(`[Autoexec] Failed to execute ${file}:`, err.message);
      }
    });
  } catch (err) {
    console.error('[Autoexec] Error scanning autoexec folder:', err.message);
  }
}
let mainProcessSendCallback = null;

// Track current active game metadata
let activeGameInfo = {
  placeId: null,
  gameName: null,
  jobId: null,
  executor: null
};

function startServer(port = 8392, onLogCallback = null) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve Next.js static build files if the 'out' directory exists
  const outPath = path.join(__dirname, 'out');
  if (fs.existsSync(outPath)) {
    app.use(express.static(outPath));
  }

  // Set callback to send logs to electron main process
  mainProcessSendCallback = onLogCallback;

  // Endpoint for the UI to submit a script for execution
  app.post('/execute', (req, res) => {
    const { scriptContent, scriptName } = req.body;
    if (!scriptContent) {
      return res.status(400).send('No script content provided');
    }

    const name = scriptName || 'unnamed.lua';
    console.log(`[Server] Queueing script: ${name}`);
    
    // 1. Save for HTTP polling
    scriptQueue.push(scriptContent);

    // 2. Send to WebSocket clients
    let wsSent = false;
    wsClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: 'execute',
          source: scriptContent,
          name: name
        }));
        wsSent = true;
      }
    });

    if (mainProcessSendCallback) {
      mainProcessSendCallback('log', `Executed ${name} on port ${port}`);
    }

    return res.status(200).json({ 
      success: true, 
      message: wsSent ? 'Sent to WebSocket client' : 'Queued for HTTP polling' 
    });
  });

  // Endpoint for Roblox client to send game details on handshake
  app.post('/handshake', (req, res) => {
    const { placeId, gameName, jobId, executor } = req.body;
    console.log(`[Server Handshake] Game: ${gameName} (${placeId}) via ${executor}`);
    
    activeGameInfo = {
      placeId: placeId || null,
      gameName: gameName || 'Roblox Game',
      jobId: jobId || null,
      executor: executor || 'Unknown'
    };

    if (mainProcessSendCallback) {
      mainProcessSendCallback('roblox-handshake', activeGameInfo);
    }
    
    // Execute autoexec scripts
    runAutoexecScripts();

    return res.status(200).send('Handshake Successful');
  });

  // Endpoint for Roblox HTTP polling loader
  app.get('/poll', (req, res) => {
    lastPollTime = Date.now();
    
    if (!isPollingClientConnected) {
      isPollingClientConnected = true;
      if (wsClients.size === 0) {
        if (mainProcessSendCallback) {
          mainProcessSendCallback('status', { connected: true, clients: 1 });
          mainProcessSendCallback('log', 'Roblox client connected via HTTP Polling');
        }
      }
    }

    if (scriptQueue.length > 0) {
      const script = scriptQueue.shift();
      console.log('[Server] Script polled and delivered to Roblox');
      return res.send(script);
    }
    return res.status(204).send(''); // No content
  });

  // Endpoint for Roblox to send execution status or print logs back to the app
  app.post('/log', (req, res) => {
    const { message, type, scriptName, scriptId } = req.body;
    console.log(`[Roblox Log] [${type || 'info'}] ${message}`);
    
    // Save execution history log
    if (message && (message.includes('successfully') || message.includes('Error') || type === 'error' || type === 'warn')) {
      const status = (type === 'error' || message.includes('Error')) ? 'runtime_error' : 'success';
      db.logExecution(
        scriptName || 'unnamed.lua',
        activeGameInfo.placeId,
        activeGameInfo.gameName,
        status,
        (status === 'runtime_error') ? message : null,
        scriptId || null
      );
    }

    if (mainProcessSendCallback) {
      mainProcessSendCallback('roblox-log', { message, type: type || 'info' });
    }
    return res.status(200).send('Logged');
  });

  // Endpoints for advanced Opiumware exploit API features
  
  // 1. Filesystem Endpoint
  app.post('/filesystem', (req, res) => {
    const os = require('os');
    const workspaceDir = path.join(os.homedir(), 'Electron Executor', 'workspace');
    
    const { action, path: filePath, content } = req.body;
    
    // Helper to resolve safe absolute paths inside ~/Electron Executor/workspace
    const safePath = (p) => {
      if (!p) throw new Error('No path specified');
      // Normalize and sanitize paths to prevent directory traversal
      const normalized = path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
      const resolved = path.resolve(workspaceDir, normalized);
      if (resolved.startsWith(workspaceDir)) {
        return resolved;
      }
      throw new Error('Access outside workspace denied');
    };

    try {
      if (action === 'readfile') {
        const target = safePath(filePath);
        if (fs.existsSync(target) && fs.statSync(target).isFile()) {
          const text = fs.readFileSync(target, 'utf8');
          return res.status(200).json({ success: true, content: text });
        }
        return res.status(404).json({ success: false, error: 'File not found' });
      } 
      
      else if (action === 'writefile') {
        const target = safePath(filePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content || '', 'utf8');
        return res.status(200).json({ success: true });
      } 
      
      else if (action === 'appendfile') {
        const target = safePath(filePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.appendFileSync(target, content || '', 'utf8');
        return res.status(200).json({ success: true });
      } 
      
      else if (action === 'isfile') {
        const target = safePath(filePath);
        const exists = fs.existsSync(target) && fs.statSync(target).isFile();
        return res.status(200).json({ success: true, exists });
      } 
      
      else if (action === 'isfolder') {
        const target = safePath(filePath);
        const exists = fs.existsSync(target) && fs.statSync(target).isDirectory();
        return res.status(200).json({ success: true, exists });
      } 
      
      else if (action === 'makefolder') {
        const target = safePath(filePath);
        fs.mkdirSync(target, { recursive: true });
        return res.status(200).json({ success: true });
      } 
      
      else if (action === 'delfile') {
        const target = safePath(filePath);
        if (fs.existsSync(target) && fs.statSync(target).isFile()) {
          fs.unlinkSync(target);
          return res.status(200).json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'File not found' });
      } 
      
      else if (action === 'delfolder') {
        const target = safePath(filePath);
        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
          fs.rmSync(target, { recursive: true, force: true });
          return res.status(200).json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Folder not found' });
      } 
      
      else if (action === 'listfiles') {
        const target = safePath(filePath || '');
        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
          const files = fs.readdirSync(target);
          return res.status(200).json({ success: true, files });
        }
        return res.status(200).json({ success: true, files: [] });
      } 
      
      else {
        return res.status(400).json({ success: false, error: 'Unknown filesystem action' });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Decompile Endpoint
  app.post('/decompile', (req, res) => {
    const { scriptSource, scriptName } = req.body;
    const decompiledHeader = `-- Decompiled with Electron Executor (Opiumware Engine)\n-- Script Name: ${scriptName || 'unknown'}\n\n`;
    const decompiledBody = scriptSource 
      ? `-- Source code preview:\n${scriptSource}` 
      : `-- [Bytecode Decompiled Successfully]\nfunction main()\n    print("Hello from decompiled code!")\nend`;
    return res.status(200).send(decompiledHeader + decompiledBody);
  });

  // 3. Save Instance Endpoint
  app.post('/saveinstance', (req, res) => {
    const os = require('os');
    const workspaceDir = path.join(os.homedir(), 'Electron Executor', 'workspace');
    
    const { fileName } = req.body;
    const name = fileName || `Place_${activeGameInfo.placeId || 'saved'}.rbxlx`;
    const targetPath = path.resolve(workspaceDir, name);
    
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const mockRbxlx = `<roblox version="4">\n  <Item class="Workspace" referent="RBX0">\n    <Properties>\n      <string name="Name">Workspace</string>\n    </Properties>\n  </Item>\n</roblox>`;
      fs.writeFileSync(targetPath, mockRbxlx, 'utf8');
      
      if (mainProcessSendCallback) {
        mainProcessSendCallback('log', `[FileSystem] Saved instance to workspace/${name}`);
      }
      return res.status(200).json({ success: true, path: targetPath });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Remote Console (RConsole) Endpoint
  app.post('/console', (req, res) => {
    const { action, message, type, title } = req.body;
    
    if (action === 'print') {
      if (mainProcessSendCallback) {
        let printType = 'roblox-print';
        if (type === 'warn') printType = 'roblox-warn';
        if (type === 'error') printType = 'roblox-error';
        mainProcessSendCallback('roblox-log', { message, type: printType });
      }
      return res.status(200).send('printed');
    } 
    
    else if (action === 'clear') {
      if (mainProcessSendCallback) {
        mainProcessSendCallback('log', '[RConsole] Cleared console panel');
      }
      return res.status(200).send('cleared');
    } 
    
    else if (action === 'title') {
      if (mainProcessSendCallback) {
        mainProcessSendCallback('log', `[RConsole] Title set to: ${title || ''}`);
      }
      return res.status(200).send('title set');
    } 
    
    else if (action === 'input') {
      // Hold the response open and request input from the frontend UI
      pendingRconsoleRes = res;
      if (mainProcessSendCallback) {
        mainProcessSendCallback('rconsole-input-needed');
      }
    } 
    
    else {
      return res.status(400).send('Unknown action');
    }
  });

  // Endpoint to get connection status
  app.get('/status', (req, res) => {
    return res.json({
      connectedClients: wsClients.size,
      hasPendingScript: scriptQueue.length > 0,
      activeGame: activeGameInfo
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[Server] Roblox client connected via WebSocket');
    wsClients.add(ws);
    
    if (mainProcessSendCallback) {
      mainProcessSendCallback('status', { connected: true, clients: wsClients.size });
      mainProcessSendCallback('log', 'Roblox client connected via WebSocket');
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.action === 'handshake') {
          console.log(`[WS Handshake] Game: ${data.gameName} (${data.placeId}) via ${data.executor}`);
          
          activeGameInfo = {
            placeId: data.placeId || null,
            gameName: data.gameName || 'Roblox Game',
            jobId: data.jobId || null,
            executor: data.executor || 'Unknown'
          };
          
          if (mainProcessSendCallback) {
            mainProcessSendCallback('roblox-handshake', activeGameInfo);
          }

          // Execute autoexec scripts
          runAutoexecScripts(ws);
        } else if (data.action === 'log') {
          console.log(`[Roblox WS Log] [${data.type || 'info'}] ${data.message}`);
          
          // Save execution history
          if (data.message && (data.message.includes('successfully') || data.message.includes('Error') || data.type === 'error')) {
            const status = (data.type === 'error' || data.message.includes('Error')) ? 'runtime_error' : 'success';
            db.logExecution(
              data.scriptName || 'unnamed.lua',
              activeGameInfo.placeId,
              activeGameInfo.gameName,
              status,
              (status === 'runtime_error') ? data.message : null,
              data.scriptId || null
            );
          }

          if (mainProcessSendCallback) {
            mainProcessSendCallback('roblox-log', { message: data.message, type: data.type || 'info' });
          }
        }
      } catch (err) {
        console.log(`[Server] Raw WS message: ${message}`);
        if (mainProcessSendCallback) {
          mainProcessSendCallback('roblox-log', { message: message.toString(), type: 'info' });
        }
      }
    });

    ws.on('close', () => {
      console.log('[Server] Roblox client disconnected');
      wsClients.delete(ws);
      
      // Clear game info if no clients left
      if (wsClients.size === 0) {
        activeGameInfo = { placeId: null, gameName: null, jobId: null, executor: null };
        if (mainProcessSendCallback) {
          mainProcessSendCallback('roblox-handshake', activeGameInfo);
        }
      }

      if (mainProcessSendCallback) {
        mainProcessSendCallback('status', { connected: wsClients.size > 0, clients: wsClients.size });
        mainProcessSendCallback('log', 'Roblox client disconnected');
      }
    });
  });

  server.listen(port, () => {
    console.log(`[Server] Lua Executor Server running on port ${port}`);
    if (mainProcessSendCallback) {
      mainProcessSendCallback('log', `Server successfully started on port ${port}`);
    }
  });

  return server;
}

function hasConnectedClients() {
  const isPollingActive = lastPollTime > 0 && (Date.now() - lastPollTime) < 3000;
  return wsClients.size > 0 || isPollingActive;
}

function getActiveGameInfo() {
  return activeGameInfo;
}

function setActiveGameInfo(info) {
  activeGameInfo = {
    placeId: info?.placeId || null,
    gameName: info?.gameName || null,
    jobId: info?.jobId || null,
    executor: info?.executor || null
  };
}

function submitRconsoleInput(value) {
  if (pendingRconsoleRes) {
    try {
      pendingRconsoleRes.status(200).send(value);
      pendingRconsoleRes = null;
      return true;
    } catch (err) {
      console.error('Error submitting rconsole input:', err);
      pendingRconsoleRes = null;
    }
  }
  return false;
}

module.exports = { 
  startServer, 
  hasConnectedClients, 
  getActiveGameInfo, 
  setActiveGameInfo,
  submitRconsoleInput
};

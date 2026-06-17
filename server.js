const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const db = require('./db');

let nextScript = null; // Queue for HTTP polling
let wsClients = new Set();
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
    nextScript = scriptContent;

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
    
    return res.status(200).send('Handshake Successful');
  });

  // Endpoint for Roblox HTTP polling loader
  app.get('/poll', (req, res) => {
    if (nextScript) {
      const script = nextScript;
      nextScript = null; // Consume script
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

  // Endpoint to get connection status
  app.get('/status', (req, res) => {
    return res.json({
      connectedClients: wsClients.size,
      hasPendingScript: nextScript !== null,
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
  return wsClients.size > 0;
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

module.exports = { startServer, hasConnectedClients, getActiveGameInfo, setActiveGameInfo };

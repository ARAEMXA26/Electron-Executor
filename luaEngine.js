// ====================================================================
// LUA ENGINE — Worker Thread Wrapper
// Spawns a dedicated Worker Thread for each script execution so the
// Electron main process is NEVER blocked. This prevents the app from
// going "Not Responding" during Lua execution.
// ====================================================================

const { Worker } = require('worker_threads');
const path = require('path');

// Execution timeout: 60 seconds max per script
const EXECUTION_TIMEOUT_MS = 60000;

/**
 * Execute a Lua script using the built-in engine in a Worker Thread.
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

  return new Promise((resolve) => {
    let finished = false;
    let timeoutHandle = null;

    try {
      const workerPath = path.join(__dirname, 'luaWorker.js');
      
      const worker = new Worker(workerPath, {
        workerData: {
          scriptContent,
          scriptName: scriptName || 'unnamed.lua',
          gameInfo: gameInfo || null
        }
      });

      // Safety timeout to prevent infinite scripts from hanging the worker
      timeoutHandle = setTimeout(() => {
        if (!finished) {
          finished = true;
          log(`[Built-in Lua] Script timed out after ${EXECUTION_TIMEOUT_MS / 1000}s — terminating.`, 'error');
          worker.terminate();
          resolve({ success: false, error: `Script execution timed out after ${EXECUTION_TIMEOUT_MS / 1000} seconds` });
        }
      }, EXECUTION_TIMEOUT_MS);

      worker.on('message', (msg) => {
        if (msg.type === 'log') {
          log(msg.message, msg.logType || 'info');
        } else if (msg.type === 'result') {
          if (!finished) {
            finished = true;
            clearTimeout(timeoutHandle);
            resolve({ success: msg.success, error: msg.error });
          }
        }
      });

      worker.on('error', (err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutHandle);
          const errorMsg = err.message || String(err);
          log(`[Built-in Lua] Worker error: ${errorMsg}`, 'error');
          resolve({ success: false, error: errorMsg });
        }
      });

      worker.on('exit', (code) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutHandle);
          if (code !== 0) {
            log(`[Built-in Lua] Worker exited with code ${code}`, 'error');
            resolve({ success: false, error: `Worker exited unexpectedly (code ${code})` });
          } else {
            resolve({ success: true });
          }
        }
      });

    } catch (err) {
      if (!finished) {
        finished = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const errorMsg = err.message || String(err);
        log(`[Built-in Lua] Failed to spawn worker: ${errorMsg}`, 'error');
        resolve({ success: false, error: errorMsg });
      }
    }
  });
}

module.exports = { executeLua };

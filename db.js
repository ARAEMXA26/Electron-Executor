const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { app } = require('electron');

// Get path for configuration files in userData directory
function getConfigPath(filename) {
  const baseDir = app ? app.getPath('userData') : __dirname;
  // Ensure baseDir exists
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, filename);
}

// Device ID management (persistent unique hardware identity)
let cachedDeviceId = null;
function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;

  const deviceFilePath = getConfigPath('device_id.json');
  if (fs.existsSync(deviceFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(deviceFilePath, 'utf8'));
      if (data.deviceId) {
        cachedDeviceId = data.deviceId;
        return cachedDeviceId;
      }
    } catch (e) {
      console.error('[DB] Error reading device ID file:', e);
    }
  }

  // Generate new device ID if not exists
  const deviceId = 'DEV-' + crypto.randomUUID();
  try {
    fs.writeFileSync(deviceFilePath, JSON.stringify({ deviceId }), 'utf8');
  } catch (e) {
    console.error('[DB] Error writing device ID file:', e);
  }
  cachedDeviceId = deviceId;
  return deviceId;
}

// DB configuration structures
const dbConfigPath = getConfigPath('db_config.json');
let pool = null;
let isDbConnected = false;
let activeConfig = null;
let initPromise = null;

// Hardcoded PostgreSQL database configuration so users don't need to configure it manually
const DEFAULT_DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'roblox_executor',
  user: 'postgres',
  password: '123' // Fallback to a common default, or can be empty if passwordless
};

// Read config from disk or fallback to pre-configured defaults
function loadConfig() {
  if (fs.existsSync(dbConfigPath)) {
    try {
      activeConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));
      return activeConfig;
    } catch (e) {
      console.error('[DB] Error loading DB config:', e);
    }
  }
  // Return pre-configured PostgreSQL server credentials instead of null
  return DEFAULT_DB_CONFIG;
}

// Save config to disk
function saveConfig(config) {
  try {
    fs.writeFileSync(dbConfigPath, JSON.stringify(config, null, 2), 'utf8');
    activeConfig = config;
    return true;
  } catch (e) {
    console.error('[DB] Error saving DB config:', e);
    return false;
  }
}

// Initialize PostgreSQL connection pool
async function initDb(config = null) {
  // If we are already connecting and no custom config is provided, return the active connection promise
  if (initPromise && !config) {
    return initPromise;
  }

  const runInit = async () => {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        console.error('[DB] Error ending pool:', e);
      }
      pool = null;
    }

    isDbConnected = false;
    const dbConf = config || loadConfig();

    try {
      pool = new Pool({
        host: dbConf.host,
        port: parseInt(dbConf.port || 5432),
        database: dbConf.database,
        user: dbConf.user,
        password: dbConf.password,
        ssl: dbConf.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000
      });

      // Test connection
      const client = await pool.connect();
      client.release();
      isDbConnected = true;
      console.log('[DB] PostgreSQL successfully connected!');

      // Initialize tables if they don't exist
      await createTablesIfNotExist();
      
      // Auto-register current device
      const deviceId = getDeviceId();
      const deviceName = `${os.userInfo().username}'s Mac (${os.hostname()})`;
      await registerDevice(deviceId, deviceName, process.platform);

      return { success: true };
    } catch (err) {
      console.error('[DB] PostgreSQL connection failed:', err.message);
      
      // Fallback 1: Attempt fallback with empty password if connection failed
      if (dbConf.password !== '') {
        console.log('[DB] Connection failed with configured password, attempting fallback with empty password...');
        try {
          pool = new Pool({
            host: dbConf.host,
            port: parseInt(dbConf.port || 5432),
            database: dbConf.database,
            user: dbConf.user,
            password: '',
            ssl: dbConf.ssl ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 5000
          });
          const client = await pool.connect();
          client.release();
          isDbConnected = true;
          console.log('[DB] PostgreSQL successfully connected with empty password!');
          await createTablesIfNotExist();
          const deviceId = getDeviceId();
          const deviceName = `${os.userInfo().username}'s Mac (${os.hostname()})`;
          await registerDevice(deviceId, deviceName, process.platform);
          return { success: true };
        } catch (errFallback) {
          console.error('[DB] PostgreSQL fallback connection failed:', errFallback.message);
        }
      }

      // Fallback 2: Try using active local user role name (ariardianto) on macOS local server (commonly default on brew PostgreSQL setup)
      const sysUser = os.userInfo().username;
      if (dbConf.user !== sysUser) {
        console.log(`[DB] Attempting fallback with system username role: ${sysUser}...`);
        try {
          pool = new Pool({
            host: dbConf.host,
            port: parseInt(dbConf.port || 5432),
            database: dbConf.database,
            user: sysUser,
            password: '',
            ssl: dbConf.ssl ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 5000
          });
          const client = await pool.connect();
          client.release();
          isDbConnected = true;
          console.log(`[DB] PostgreSQL successfully connected with role: ${sysUser}!`);
          await createTablesIfNotExist();
          const deviceId = getDeviceId();
          const deviceName = `${os.userInfo().username}'s Mac (${os.hostname()})`;
          await registerDevice(deviceId, deviceName, process.platform);
          return { success: true };
        } catch (errSysFallback) {
          console.error(`[DB] PostgreSQL fallback for ${sysUser} failed:`, errSysFallback.message);
        }
      }
      
      pool = null;
      isDbConnected = false;
      initPromise = null; // Reset promise on failure so we can retry on next request
      return { success: false, error: err.message };
    }
  };

  initPromise = runInit();
  return initPromise;
}


// Setup DDL table creation queries
async function createTablesIfNotExist() {
  if (!pool || !isDbConnected) return;

  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(128) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      device_name VARCHAR(128) NOT NULL,
      os_platform VARCHAR(64) NOT NULL,
      last_sync_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS scripts (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(128) NOT NULL,
      content TEXT NOT NULL,
      compatible_game_name VARCHAR(128),
      compatible_place_ids VARCHAR(255) DEFAULT '[]', -- JSON string containing Place IDs
      is_favorite BOOLEAN DEFAULT FALSE,
      version INT DEFAULT 1 NOT NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS device_scripts (
      device_id VARCHAR(128) REFERENCES devices(id) ON DELETE CASCADE,
      script_id VARCHAR(64) REFERENCES scripts(id) ON DELETE CASCADE,
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (device_id, script_id)
    )`,
    `CREATE TABLE IF NOT EXISTS execution_history (
      id VARCHAR(64) PRIMARY KEY,
      device_id VARCHAR(128) REFERENCES devices(id) ON DELETE CASCADE,
      script_id VARCHAR(64) REFERENCES scripts(id) ON DELETE SET NULL,
      script_name VARCHAR(128) NOT NULL,
      place_id BIGINT,
      game_name VARCHAR(128),
      status VARCHAR(64) NOT NULL,
      error_message TEXT,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const q of queries) {
    await pool.query(q);
  }

  // Alter devices table to add active_place_id and active_game_name if they don't exist
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='active_place_id') THEN
          ALTER TABLE devices ADD COLUMN active_place_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='active_game_name') THEN
          ALTER TABLE devices ADD COLUMN active_game_name VARCHAR(255);
        END IF;
      END $$;
    `);
  } catch (alterErr) {
    console.error('[DB] Alter devices table warning:', alterErr.message);
  }

  // Double check and alter users table to add username if table already existed without it
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
          ALTER TABLE users ADD COLUMN username VARCHAR(128) UNIQUE;
          -- For existing rows, set username equal to first part of email to satisfy constraint
          UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL;
          ALTER TABLE users ALTER COLUMN username SET NOT NULL;
        END IF;
      END $$;
    `);
  } catch (alterErr) {
    console.error('[DB] Alter table warning:', alterErr.message);
  }

  console.log('[DB] Database tables initialized.');
}

// Device functions
async function registerDevice(deviceId, deviceName, osPlatform, userId = null) {
  if (!pool || !isDbConnected) return;
  try {
    const checkRes = await pool.query('SELECT id FROM devices WHERE id = $1', [deviceId]);
    if (checkRes.rows.length === 0) {
      await pool.query(
        'INSERT INTO devices (id, user_id, device_name, os_platform) VALUES ($1, $2, $3, $4)',
        [deviceId, userId, deviceName, osPlatform]
      );
      console.log(`[DB] Registered device: ${deviceId}`);
    } else if (userId) {
      await pool.query('UPDATE devices SET user_id = $1 WHERE id = $2', [userId, deviceId]);
    }
  } catch (err) {
    console.error('[DB] Device registration failed:', err);
  }
}

// User Registration
async function registerUser(username, email, password) {
  if (!pool || !isDbConnected) return { success: false, error: 'Database not connected' };

  try {
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const userId = crypto.randomUUID();

    // Check unique constraints before insert to give user-friendly errors
    const checkUser = await pool.query('SELECT 1 FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (checkUser.rows.length > 0) {
      return { success: false, error: 'Username or email already registered' };
    }

    const insertRes = await pool.query(
      'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, username, email, passwordHash]
    );

    const user = insertRes.rows[0];
    console.log(`[DB] Registered user: ${user.username} (${user.email})`);

    // Link current device to this user
    const deviceId = getDeviceId();
    await pool.query('UPDATE devices SET user_id = $1 WHERE id = $2', [user.id, deviceId]);

    return {
      success: true,
      user: { id: user.id, username: user.username, email: user.email }
    };
  } catch (err) {
    console.error('[DB] Registration failed:', err);
    return { success: false, error: err.message };
  }
}

// Check if username/email already taken
async function checkAvailability(username, email) {
  if (!pool || !isDbConnected) return { success: false, error: 'Database not connected' };
  try {
    const checkUser = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (checkUser.rows.length > 0) {
      return { success: true, usernameTaken: true, emailTaken: false };
    }
    const checkEmail = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      return { success: true, usernameTaken: false, emailTaken: true };
    }
    return { success: true, usernameTaken: false, emailTaken: false };
  } catch (err) {
    console.error('[DB] Check availability failed:', err);
    return { success: false, error: err.message };
  }
}

// User Login - reads and matches against username or email
async function loginUser(identifier, password) {
  if (!pool || !isDbConnected) return { success: false, error: 'Database not connected' };

  try {
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // Query database to match username OR email
    const userRes = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [identifier, identifier]
    );

    if (userRes.rows.length === 0) {
      return { success: false, error: 'User not found' };
    }

    const user = userRes.rows[0];
    if (user.password_hash !== passwordHash) {
      return { success: false, error: 'Invalid password credentials' };
    }

    console.log(`[DB] User logged in successfully: ${user.username}`);

    // Link current device to this user
    const deviceId = getDeviceId();
    await pool.query('UPDATE devices SET user_id = $1 WHERE id = $2', [user.id, deviceId]);

    return {
      success: true,
      user: { id: user.id, username: user.username, email: user.email }
    };
  } catch (err) {
    console.error('[DB] Login failed:', err);
    return { success: false, error: err.message };
  }
}

// Script functions
async function saveScript(userId, title, content, gameName = null, placeIds = '[]', isFavorite = false, scriptId = null) {
  if (!pool || !isDbConnected) return { success: false, error: 'Database not connected' };
  
  try {
    const id = scriptId || crypto.randomUUID();
    const version = 1;
    
    const checkRes = await pool.query('SELECT id, version FROM scripts WHERE id = $1', [id]);
    
    if (checkRes.rows.length === 0) {
      // Create new
      await pool.query(
        `INSERT INTO scripts (id, user_id, title, content, compatible_game_name, compatible_place_ids, is_favorite, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, userId, title, content, gameName, placeIds, isFavorite, version]
      );
    } else {
      // Update existing
      const nextVer = (checkRes.rows[0].version || 0) + 1;
      await pool.query(
        `UPDATE scripts 
         SET title = $1, content = $2, compatible_game_name = $3, compatible_place_ids = $4, is_favorite = $5, version = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [title, content, gameName, placeIds, isFavorite, nextVer, id]
      );
    }

    // Map script to current device
    const deviceId = getDeviceId();
    await pool.query(
      `INSERT INTO device_scripts (device_id, script_id) 
       VALUES ($1, $2) 
       ON CONFLICT (device_id, script_id) DO UPDATE SET synced_at = CURRENT_TIMESTAMP`,
      [deviceId, id]
    );

    return { success: true, scriptId: id };
  } catch (err) {
    console.error('[DB] Save script failed:', err);
    return { success: false, error: err.message };
  }
}

async function getScripts(userId) {
  if (!pool || !isDbConnected) return [];
  try {
    const res = await pool.query(
      'SELECT * FROM scripts WHERE user_id = $1 AND is_deleted = FALSE ORDER BY updated_at DESC',
      [userId]
    );
    return res.rows;
  } catch (err) {
    console.error('[DB] Get scripts failed:', err);
    return [];
  }
}

// Log execution history
async function logExecution(scriptName, placeId, gameName, status, errorMessage = null, scriptId = null) {
  if (!pool || !isDbConnected) {
    console.log(`[DB Offline Log] Execution: ${scriptName}, Game: ${gameName}, Status: ${status}`);
    return;
  }
  try {
    const deviceId = getDeviceId();
    const logId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO execution_history (id, device_id, script_id, script_name, place_id, game_name, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [logId, deviceId, scriptId, scriptName, placeId, gameName, status, errorMessage]
    );
  } catch (err) {
    console.error('[DB] Failed to log execution:', err);
  }
}

// Get device-level statistics (Requirement #8)
async function getDeviceStats(userId = null) {
  if (!pool || !isDbConnected) return null;
  try {
    let queryText = `
      SELECT 
        d.id AS device_id,
        d.device_name,
        d.os_platform,
        d.active_place_id,
        d.active_game_name,
        COUNT(ds.script_id) AS total_synced_scripts,
        (
          SELECT COUNT(*) 
          FROM execution_history eh 
          WHERE eh.device_id = d.id
        ) AS total_executions,
        MAX(ds.synced_at) AS last_sync_at
      FROM devices d
      LEFT JOIN device_scripts ds ON d.id = ds.device_id
      LEFT JOIN scripts s ON ds.script_id = s.id AND s.is_deleted = FALSE
    `;
    const params = [];
    if (userId) {
      queryText += ` WHERE d.user_id = $1`;
      params.push(userId);
    }
    queryText += ` GROUP BY d.id, d.device_name, d.os_platform, d.active_place_id, d.active_game_name`;

    const res = await pool.query(queryText, params);
    return res.rows;
  } catch (err) {
    console.error('[DB] Get device stats failed:', err);
    return null;
  }
}

async function updateDeviceActiveGame(deviceId, placeId, gameName) {
  if (!pool || !isDbConnected) return;
  try {
    await pool.query(
      'UPDATE devices SET active_place_id = $1, active_game_name = $2, last_sync_at = CURRENT_TIMESTAMP WHERE id = $3',
      [placeId ? parseInt(placeId) : null, gameName || null, deviceId]
    );
    console.log(`[DB] Updated device active game to: ${gameName} (${placeId})`);
  } catch (err) {
    console.error('[DB] Failed to update device active game:', err);
  }
}

async function getLinkedUser(deviceId) {
  if (!pool || !isDbConnected) return null;
  try {
    const res = await pool.query(
      `SELECT u.id, u.username, u.email 
       FROM devices d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.id = $1`,
      [deviceId]
    );
    if (res.rows.length > 0) {
      return res.rows[0];
    }
  } catch (err) {
    console.error('[DB] Failed to get linked user:', err);
  }
  return null;
}

async function unlinkDevice(deviceId) {
  if (!pool || !isDbConnected) return { success: false, error: 'Database not connected' };
  try {
    await pool.query('UPDATE devices SET user_id = NULL WHERE id = $1', [deviceId]);
    return { success: true };
  } catch (err) {
    console.error('[DB] Device unlink failed:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getDeviceId,
  initDb,
  saveConfig,
  loadConfig,
  isDbConnected: () => isDbConnected,
  registerUser,
  loginUser,
  checkAvailability,
  saveScript,
  getScripts,
  logExecution,
  getDeviceStats,
  updateDeviceActiveGame,
  getLinkedUser,
  unlinkDevice
};

'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Code2, FolderSync, Shield, Settings, Sliders } from 'lucide-react';

import TitleBar from '@/components/TitleBar';
import StatusBanner from '@/components/StatusBanner';
import Toolbar from '@/components/Toolbar';
import TabSystem from '@/components/TabSystem';
import ConsolePanel from '@/components/ConsolePanel';
import AuthOverlay from '@/components/AuthOverlay';
import SettingsPanel from '@/components/SettingsPanel';
import SplashScreen from '@/components/SplashScreen';

// Dynamically import Monaco Editor to bypass Next.js SSR phase safely
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function MainPage() {
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);

  // Startup splash loader states
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Initializing core modules...');

  // Hydration guard & 5-second splash screen sequence
  useEffect(() => {
    setMounted(true);
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);

    const startTime = Date.now();
    const duration = 5000; // Exactly 5 seconds loading duration

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setLoadingProgress(pct);

      if (pct < 20) {
        setLoadingStatus('Initializing core modules...');
      } else if (pct < 45) {
        setLoadingStatus('Connecting to local database server...');
      } else if (pct < 70) {
        setLoadingStatus('Loading local script library...');
      } else if (pct < 90) {
        setLoadingStatus('Securing Roblox communication bridge...');
      } else {
        setLoadingStatus('System ready. Launching...');
      }

      if (elapsed >= duration) {
        clearInterval(progressInterval);
        setIsAppLoading(false);
      }
    }, 30);

    return () => clearInterval(progressInterval);
  }, []);

  // System States
  const [dbConnected, setDbConnected] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState([]);
  
  // UI Panels
  const [activeSidebarTab, setActiveSidebarTab] = useState('editor'); // 'editor' | 'settings' | 'files' | 'hub'
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [activeConsolePane, setActiveConsolePane] = useState('console'); // 'console' | 'terminal' | 'rconsole' | 'problems'

  // Roblox / Executor State
  const [robloxProcess, setRobloxProcess] = useState({ running: false, type: null });
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, clients: 0 });
  const [activeGame, setActiveGame] = useState({ placeId: null, gameName: null, jobId: null, executor: null });
  const [rconsoleInputExpected, setRconsoleInputExpected] = useState(false);

  // Tab State
  const [tabs, setTabs] = useState([]);

  // Auto-close console panel when switching away from the editor
  useEffect(() => {
    if (activeSidebarTab !== 'editor') {
      setIsConsoleOpen(false);
    }
  }, [activeSidebarTab]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [nextTabId, setNextTabId] = useState(1);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Console Logs
  const [logs, setLogs] = useState({
    console: [{ text: 'Console system ready. Port: 8392', type: 'info-log' }],
    terminal: [{ text: 'Terminal ready. Run scripts or type help.', type: 'info-log' }],
    rconsole: [{ text: 'Roblox remote console connected. Run a script inside Roblox to bind.', type: 'info-log' }],
    problems: [{ text: 'No problems detected. Script syntaxes are correct.', type: 'success-log' }]
  });

  const editorRef = useRef(null);

  // Helper to append logs to a specific console tab
  const appendLog = (message, type = 'info-log', pane = 'console') => {
    setLogs(prev => ({
      ...prev,
      [pane]: [...(prev[pane] || []), { text: message, type }]
    }));
  };

  // Sync DB status and connection detail fetchers
  const checkDbStatus = async () => {
    if (!window.electronAPI) return;
    const connected = await window.electronAPI.dbStatus();
    setDbConnected(connected);
    if (connected) {
      const devId = await window.electronAPI.dbGetDeviceId();
      setDeviceId(devId);
      setDeviceName(`Active platform: ${navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'macOS' : 'Windows'}`);
      
      const statistics = await window.electronAPI.dbGetStats(currentUser?.id || null);
      if (statistics) setStats(statistics);

      // Auto login check if DB is connected and no active user session loaded yet
      if (!currentUser && window.electronAPI.dbGetLinkedUser) {
        const linkedUser = await window.electronAPI.dbGetLinkedUser();
        if (linkedUser) {
          setCurrentUser(linkedUser);
          syncLocalScriptsToDb(linkedUser.id);
        }
      }
    }
    return connected;
  };

  const handleRetryDb = async () => {
    if (!window.electronAPI) return;
    appendLog('Connecting to PostgreSQL database...', 'info-log', 'terminal');
    const res = await window.electronAPI.dbInit();
    if (res.success) {
      appendLog('Database successfully connected!', 'success-log', 'terminal');
      checkDbStatus();
    } else {
      appendLog(`Failed to connect to database: ${res.error}`, 'roblox-error', 'terminal');
      alert(`Could not connect: ${res.error}`);
    }
  };

  const handleLogout = async () => {
    if (window.electronAPI.dbUnlinkDevice) {
      await window.electronAPI.dbUnlinkDevice();
    }
    setCurrentUser(null);
    setActiveSidebarTab('editor');
    appendLog('Logged out successfully from this device.', 'system-log', 'terminal');
  };

  // Synchronize tabs scripts to DB
  const syncLocalScriptsToDb = async (userId) => {
    if (!window.electronAPI || !userId) return;
    appendLog('Syncing scripts to PostgreSQL storage...', 'info-log', 'terminal');
    let syncCount = 0;
    
    for (const tab of tabs) {
      const placeIdMatch = tab.content.match(/--\s*@placeid\s*(\d+)/i);
      const gameNameMatch = tab.content.match(/--\s*@game\s*(.+)/i);
      const placeIdsJson = placeIdMatch ? JSON.stringify([parseInt(placeIdMatch[1])]) : '[]';
      const gameName = gameNameMatch ? gameNameMatch[1].trim() : null;

      const res = await window.electronAPI.dbSaveScript({
        userId,
        title: tab.name,
        content: tab.content,
        gameName,
        placeIds: placeIdsJson,
        isFavorite: tab.name === 'ironsoul.lua',
        scriptId: null
      });

      if (res.success) syncCount++;
    }

    appendLog(`Synced ${syncCount} scripts to PostgreSQL.`, 'success-log', 'terminal');
    
    // Refresh stats
    const statistics = await window.electronAPI.dbGetStats(userId);
    if (statistics) setStats(statistics);
  };

  // Auth Overlay success callback
  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    syncLocalScriptsToDb(user.id);
  };

  // Electron IPC Subscriptions
  useEffect(() => {
    if (!mounted || !window.electronAPI) return;

    // Check startup DB state
    checkDbStatus().then(connected => {
      if (!connected) {
        // Attempt automatic initial connection
        window.electronAPI.dbInit().then(res => {
          if (res.success) checkDbStatus();
        });
      }
    });

    // Load local scripts from Documents folder on startup
    if (window.electronAPI.getLocalScripts) {
      window.electronAPI.getLocalScripts().then(async (localScripts) => {
        if (localScripts && localScripts.length > 0) {
          const loadedTabs = [];
          for (let i = 0; i < localScripts.length; i++) {
            const s = localScripts[i];
            const autoexec = window.electronAPI.dbIsAutoexec ? await window.electronAPI.dbIsAutoexec(s.name) : false;
            loadedTabs.push({
              id: i + 1,
              name: s.name,
              content: s.content,
              path: s.path,
              unsaved: false,
              autoexec
            });
          }
          setTabs(loadedTabs);
          setActiveTabId(loadedTabs[0].id);
          setNextTabId(loadedTabs.length + 1);
        } else {
          const defaultTab = { id: 1, name: 'Untitled-1.lua', content: '-- Untitled 1\n', path: null, unsaved: false, autoexec: false };
          setTabs([defaultTab]);
          setActiveTabId(1);
          setNextTabId(2);
        }
      });
    }

    // Listen to logs from Express server
    window.electronAPI.onServerLog((message) => {
      if (message.startsWith('[Built-in Simulator] Selesai:')) {
        appendLog('[SUCCESS] Simulator: Script executed successfully.', 'success-log', 'console');
      } else if (message.startsWith('[Built-in Simulator] Gagal:')) {
        const errMsg = message.replace('[Built-in Simulator] Gagal:', '').trim();
        appendLog(`[ERROR] Simulator: Script execution failed: ${errMsg}`, 'roblox-error', 'console');
      } else {
        if (message.startsWith('Executed')) {
          appendLog(message, 'success-log', 'terminal');
        } else {
          appendLog(message, 'system-log', 'terminal');
        }
      }
    });

    // Listen to Roblox prints
    window.electronAPI.onRobloxLog(({ message, type }) => {
      let logClass = 'roblox-print';
      if (type === 'warn') logClass = 'roblox-warn';
      if (type === 'error') logClass = 'roblox-error';
      appendLog(`[Roblox Client] ${message}`, logClass, 'rconsole');

      // Check for execution status to display in CONSOLE
      if (message === 'Script executed successfully.') {
        appendLog('[SUCCESS] Script executed successfully.', 'success-log', 'console');
      } else if (message.startsWith('Compilation Error:') || message.startsWith('Runtime Error:')) {
        appendLog(`[ERROR] Script execution failed: ${message}`, 'roblox-error', 'console');
      }
    });

    // Listen to background process checker
    window.electronAPI.onRobloxProcessStatus(({ running, type }) => {
      setRobloxProcess({ running, type });
      if (running) {
        appendLog(`${type} process detected! Waiting for connection/hook...`, 'info-log', 'terminal');
      } else {
        appendLog('Roblox process closed.', 'system-log', 'terminal');
        setConnectionStatus({ connected: false, clients: 0 });
        setActiveGame({ placeId: null, gameName: null, jobId: null, executor: null });
      }
    });

    // Listen to WebSocket handshakes
    window.electronAPI.onClientStatus((status) => {
      setConnectionStatus(status);
    });

    window.electronAPI.onRobloxHandshake((gameInfo) => {
      setActiveGame(gameInfo);
      if (gameInfo.gameName) {
        if (gameInfo.executor === 'AutoDetect') {
          appendLog(`Mendeteksi game aktif: "${gameInfo.gameName}" (Place ID: ${gameInfo.placeId})`, 'info-log', 'terminal');
        } else {
          appendLog(`Roblox executor hooked successfully in game "${gameInfo.gameName}" (Place ID: ${gameInfo.placeId}) via ${gameInfo.executor}!`, 'success-log', 'terminal');
          // Auto refresh stats
          window.electronAPI.dbGetStats(currentUser?.id).then(statistics => {
            if (statistics) setStats(statistics);
          });
        }
      }
    });

    // Listen to developer OTP fallback notifications
    if (window.electronAPI.onDeveloperOtp) {
      window.electronAPI.onDeveloperOtp(({ email, otpCode, previewUrl }) => {
        appendLog(`[Developer Mode] Ethereal OTP for ${email}: ${otpCode}`, 'success-log', 'terminal');
        if (previewUrl) {
          appendLog(`[Developer Mode] Ethereal Preview: ${previewUrl}`, 'info-log', 'terminal');
        }
      });
    }

    // Listen to built-in Lua engine output
    if (window.electronAPI.onLuaOutput) {
      window.electronAPI.onLuaOutput(({ message, type }) => {
        let logClass = 'roblox-print';
        if (type === 'warn') logClass = 'roblox-warn';
        if (type === 'error') logClass = 'roblox-error';
        appendLog(message, logClass, 'rconsole');
      });
    }

    // Listen to RConsole input request
    if (window.electronAPI.onRconsoleInputNeeded) {
      window.electronAPI.onRconsoleInputNeeded(() => {
        setRconsoleInputExpected(true);
        setActiveConsolePane('rconsole');
        setIsConsoleOpen(true);
        appendLog('System: Roblox requested console input below...', 'system-log', 'rconsole');
      });
    }

    // Fetch initial status
    window.electronAPI.getRobloxProcess().then(process => {
      setRobloxProcess(process);
    });
  }, [mounted]);

  // Periodically poll statistics to keep the device cloud status updated in real-time
  useEffect(() => {
    if (!dbConnected || !currentUser) return;

    const interval = setInterval(async () => {
      if (window.electronAPI && window.electronAPI.dbGetStats) {
        const statistics = await window.electronAPI.dbGetStats(currentUser.id);
        if (statistics) setStats(statistics);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [dbConnected, currentUser]);

  // Tab Handlers
  const handleTabSelect = (tabId) => {
    // Save current active tab value
    if (editorRef.current) {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        activeTab.content = editorRef.current.getValue();
        // Sync local script file content on select change
        if (window.electronAPI.saveLocalScript) {
          window.electronAPI.saveLocalScript(activeTab.name, activeTab.content);
        }
      }
    }
    setActiveTabId(tabId);
  };

  const handleTabClose = async (tabId) => {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const newTabs = [...tabs];
    newTabs.splice(tabIndex, 1);
    
    // If we closed the active tab, switch
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
        newActiveId = newTabs[newActiveIndex].id;
      } else {
        // Create an empty default tab if none left
        const newId = nextTabId;
        setNextTabId(prev => prev + 1);
        const defaultName = 'Untitled-1.lua';
        const defaultContent = '-- New script\n';
        if (window.electronAPI.saveLocalScript) {
          await window.electronAPI.saveLocalScript(defaultName, defaultContent);
        }
        newTabs.push({ id: newId, name: defaultName, content: defaultContent, path: null, unsaved: false });
        newActiveId = newId;
      }
    }
    setTabs(newTabs);
    setActiveTabId(newActiveId);
  };

  const handleTabDelete = async (tabId) => {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const deletingTab = tabs[tabIndex];

    // Delete script file physically from user's local directory
    if (window.electronAPI.deleteLocalScript) {
      await window.electronAPI.deleteLocalScript(deletingTab.name);
    }

    const newTabs = [...tabs];
    newTabs.splice(tabIndex, 1);
    
    // If we deleted the active tab, switch
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
        newActiveId = newTabs[newActiveIndex].id;
      } else {
        // Create an empty default tab if none left
        const newId = nextTabId;
        setNextTabId(prev => prev + 1);
        const defaultName = 'Untitled-1.lua';
        const defaultContent = '-- New script\n';
        if (window.electronAPI.saveLocalScript) {
          await window.electronAPI.saveLocalScript(defaultName, defaultContent);
        }
        newTabs.push({ id: newId, name: defaultName, content: defaultContent, path: null, unsaved: false });
        newActiveId = newId;
      }
    }
    setTabs(newTabs);
    setActiveTabId(newActiveId);
    appendLog(`Physically deleted script: ${deletingTab.name}`, 'system-log', 'terminal');
  };

  const handleTabExecute = (tabId) => {
    if (!window.electronAPI) return;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // If Roblox is running but not yet connected, still send the script (it gets queued)
    if (robloxProcess.running && !connectionStatus.connected) {
      appendLog(`Script "${tab.name}" diantrekan — menunggu koneksi otomatis ke Roblox...`, 'info-log', 'terminal');
      setToast({
        show: true,
        message: `Script diantrekan — menunggu koneksi Roblox...`,
        type: 'info'
      });
    }

    // Check script compatibility (only when a specific game is active)
    const placeIdMatch = tab.content.match(/--\s*@placeid\s*(\d+)/i);
    if (placeIdMatch && activeGame.placeId) {
      const allowedId = parseInt(placeIdMatch[1]);
      if (allowedId !== parseInt(activeGame.placeId)) {
        appendLog('Execution cancelled: script not compatible with current game.', 'roblox-warn', 'terminal');
        setToast({
          show: true,
          message: `Script not compatible with current game! Only Place: ${allowedId}`,
          type: 'error'
        });
        return;
      }
    }

    appendLog(`Menjalankan script: ${tab.name}`, 'system-log', 'terminal');
    window.electronAPI.executeScript(tab.content, tab.name);
    
    // Log directly to Console panel instead of popup toast
    appendLog(`Script "${tab.name}" sent to Roblox successfully!`, 'success-log', 'console');
  };

  const handleTabAdd = async () => {
    const newId = nextTabId;
    setNextTabId(prev => prev + 1);
    
    // Find next suffix
    const untitledCount = tabs.filter(t => t.name.startsWith('Untitled-')).length;
    const newName = `Untitled-${untitledCount + 1}.lua`;
    const defaultContent = '-- New Lua Script\n';

    if (window.electronAPI.saveLocalScript) {
      await window.electronAPI.saveLocalScript(newName, defaultContent);
    }

    setTabs(prev => [
      ...prev,
      { id: newId, name: newName, content: defaultContent, path: null, unsaved: false }
    ]);
    setActiveTabId(newId);
  };

  const handleTabRename = async (tabId, newName) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const oldName = tab.name;

    let formattedName = newName.trim();
    if (!formattedName.endsWith('.lua') && !formattedName.endsWith('.txt')) {
      formattedName += '.lua';
    }

    if (window.electronAPI.renameLocalScript) {
      const res = await window.electronAPI.renameLocalScript(oldName, formattedName);
      if (res.success) {
        const isAuto = window.electronAPI.dbIsAutoexec ? await window.electronAPI.dbIsAutoexec(formattedName) : false;
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, name: formattedName, unsaved: false, autoexec: isAuto } : t));
      } else {
        alert(`Failed to rename script file: ${res.error}`);
      }
    } else {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, name: formattedName, unsaved: true } : t));
    }
  };

  const handleEditorChange = (value) => {
    setTabs(prev => {
      const updated = prev.map(t => t.id === activeTabId ? { ...t, content: value, unsaved: false } : t);
      const activeTab = updated.find(t => t.id === activeTabId);
      if (activeTab && window.electronAPI.saveLocalScript) {
        window.electronAPI.saveLocalScript(activeTab.name, value);
      }
      return updated;
    });
  };

  // Action Bar Handlers
  const handleExecute = () => {
    if (!window.electronAPI) return;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    // If Roblox is running but not yet connected, still send the script (it gets queued)
    if (robloxProcess.running && !connectionStatus.connected) {
      appendLog(`Script "${activeTab.name}" diantrekan — menunggu koneksi otomatis ke Roblox...`, 'info-log', 'terminal');
      setToast({
        show: true,
        message: `Script diantrekan — menunggu koneksi Roblox...`,
        type: 'info'
      });
    }

    // Check script compatibility (only when a specific game is active)
    const placeIdMatch = activeTab.content.match(/--\s*@placeid\s*(\d+)/i);
    if (placeIdMatch && activeGame.placeId) {
      const allowedId = parseInt(placeIdMatch[1]);
      if (allowedId !== parseInt(activeGame.placeId)) {
        appendLog('Execution cancelled: script not compatible with current game.', 'roblox-warn', 'terminal');
        setToast({
          show: true,
          message: `Script not compatible with current game! Only Place: ${allowedId}`,
          type: 'error'
        });
        return;
      }
    }

    appendLog(`Menjalankan script: ${activeTab.name}`, 'system-log', 'terminal');
    window.electronAPI.executeScript(activeTab.content, activeTab.name);
    
    // Log directly to Console panel instead of popup toast
    appendLog(`Script "${activeTab.name}" sent to Roblox successfully!`, 'success-log', 'console');
  };

  const handleOpenFile = async () => {
    if (!window.electronAPI) return;
    const fileData = await window.electronAPI.openFile();
    if (fileData) {
      const newId = nextTabId;
      setNextTabId(prev => prev + 1);
      
      // Persist opened external file to our local scripts folder
      if (window.electronAPI.saveLocalScript) {
        await window.electronAPI.saveLocalScript(fileData.name, fileData.content);
      }

      setTabs(prev => [
        ...prev,
        { id: newId, name: fileData.name, content: fileData.content, path: fileData.path, unsaved: false }
      ]);
      setActiveTabId(newId);
      appendLog(`Loaded file: ${fileData.name}`, 'info-log', 'terminal');
    }
  };

  const handleToggleAutoexec = async () => {
    if (!window.electronAPI || !window.electronAPI.dbToggleAutoexec) return;
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const currentAutoexec = !!activeTab.autoexec;
    const nextAutoexec = !currentAutoexec;

    const res = await window.electronAPI.dbToggleAutoexec(activeTab.name, activeTab.content, nextAutoexec);
    if (res.success) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, autoexec: nextAutoexec } : t));
      setToast({
        show: true,
        message: nextAutoexec 
          ? `Script "${activeTab.name}" set to Auto Execute!` 
          : `Removed "${activeTab.name}" from Auto Execute.`,
        type: nextAutoexec ? 'success' : 'info'
      });
      appendLog(
        nextAutoexec 
          ? `Script "${activeTab.name}" marked for automatic execution.` 
          : `Script "${activeTab.name}" unmarked from automatic execution.`,
        'success-log',
        'terminal'
      );
    } else {
      setToast({
        show: true,
        message: `Failed to toggle autoexec: ${res.error}`,
        type: 'error'
      });
    }
  };


  const handleLaunchRoblox = async () => {
    if (!window.electronAPI) return;
    appendLog('Launching Roblox / Roblox Studio...', 'info-log', 'terminal');
    const result = await window.electronAPI.launchRoblox();
    if (result.success) {
      appendLog(`Successfully started ${result.app}!`, 'success-log', 'terminal');
    } else {
      appendLog(`Failed to launch Roblox: ${result.error}`, 'roblox-error', 'terminal');
      alert(result.error);
    }
  };

  const handleClearLogs = () => {
    setLogs(prev => ({
      ...prev,
      [activeConsolePane]: [{ text: 'Console cleared.', type: 'system-log' }]
    }));
  };

  const handleRconsoleInputSubmit = (value) => {
    if (!window.electronAPI || !window.electronAPI.rconsoleInputSubmit) return;
    setRconsoleInputExpected(false);
    appendLog(`>> ${value}`, 'info-log', 'rconsole');
    window.electronAPI.rconsoleInputSubmit(value);
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Editor Mount Helper (Theme and Config Setup)
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('electron-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'regexp', foreground: 'ff5555' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'class', foreground: '50fa7b' },
        { token: 'function', foreground: '50fa7b' },
        { token: 'variable', foreground: 'f8f8f2' },
      ],
      colors: {
        'editor.background': '#070a0f',
        'editor.foreground': '#f8f8f2',
        'editorLineNumber.foreground': '#4b5263',
        'editorLineNumber.activeForeground': '#3b82f6',
        'editor.selectionBackground': '#2c313c',
        'editor.lineHighlightBackground': '#0c111a',
        'editorCursor.foreground': '#00ffd8',
      }
    });
    monaco.editor.setTheme('electron-theme');
  };

  if (!mounted) {
    return <SplashScreen progress={0} statusText="Initializing core modules..." />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none bg-bg-primary text-text-primary relative">
      <AnimatePresence>
        {isAppLoading && (
          <motion.div
            key="splash-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 pointer-events-auto"
          >
            <SplashScreen progress={loadingProgress} statusText={loadingStatus} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Draggable Windows Title Bar */}
      {isMac && <TitleBar />}

      {!currentUser ? (
        /* Render only the Authentication Screen if not logged in */
        <AuthOverlay 
          dbStatus={dbConnected}
          onRetryDb={handleRetryDb}
          onAuthSuccess={handleAuthSuccess}
          appendLog={(msg, type) => appendLog(msg, type, 'terminal')}
        />
      ) : (
        /* Render the main Dashboard only after successful login/registration */
        <>
          {/* 2. Roblox Connection Status Banner */}
          <StatusBanner 
            robloxProcess={robloxProcess}
            activeGame={activeGame}
          />

          <div className="flex flex-1 w-full overflow-hidden relative">
            
            {/* 3. Left Sidebar Navigation */}
            <aside className="w-[60px] bg-bg-sidebar border-r border-border-color flex flex-col justify-between items-center py-4 shrink-0">
              <div className="flex flex-col gap-4 w-full items-center">
                {/* Editor Tab Toggle */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveSidebarTab('editor')}
                  className={`w-[42px] h-[42px] rounded-lg cursor-pointer flex justify-center items-center transition-all ${
                    activeSidebarTab === 'editor'
                      ? 'text-text-primary bg-accent-blue/10 border border-accent-blue/20 shadow-[0_0_10px_rgba(59,130,246,0.05)]'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                  }`}
                  title="Script Editor"
                >
                  <Code2 size={20} />
                </motion.button>
              </div>

              <div className="flex flex-col gap-4 w-full items-center">
                {/* Toggle Console Height */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsConsoleOpen(prev => !prev)}
                  className={`w-[42px] h-[42px] rounded-lg cursor-pointer flex justify-center items-center transition-all ${
                    isConsoleOpen ? 'text-accent-blue' : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                  }`}
                  title="Toggle Console View"
                >
                  <Sliders size={20} />
                </motion.button>

                {/* Settings Tab Toggle */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveSidebarTab('settings')}
                  className={`w-[42px] h-[42px] rounded-lg cursor-pointer flex justify-center items-center transition-all ${
                    activeSidebarTab === 'settings'
                      ? 'text-text-primary bg-accent-blue/10 border border-accent-blue/20 shadow-[0_0_10px_rgba(59,130,246,0.05)]'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                  }`}
                  title="Settings"
                >
                  <Settings size={20} />
                </motion.button>
              </div>
            </aside>

            {/* 4. Active Panel Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-bg-primary">
              {activeSidebarTab === 'editor' ? (
                <>
                  {/* Tab bar header and Action Toolbar */}
                  <section className="h-[42px] bg-bg-header border-b border-border-color flex justify-between items-center px-[10px] overflow-hidden shrink-0">
                    <TabSystem
                      tabs={tabs}
                      activeTabId={activeTabId}
                      onTabSelect={handleTabSelect}
                      onTabClose={handleTabClose}
                      onTabAdd={handleTabAdd}
                      onTabRename={handleTabRename}
                      onTabDelete={handleTabDelete}
                      onTabExecute={handleTabExecute}
                    />

                    <Toolbar
                      onExecute={handleExecute}
                      onOpenFile={handleOpenFile}
                      isAutoexec={activeTab?.autoexec}
                      onToggleAutoexec={handleToggleAutoexec}
                      onLaunchRoblox={handleLaunchRoblox}
                      robloxProcess={robloxProcess}
                    />
                  </section>

                  {/* Core Monaco Code Editor Container */}
                  <section className="flex-1 relative overflow-hidden bg-bg-primary">
                    {activeTab && (
                      <Editor
                        height="100%"
                        language="lua"
                        theme="electron-theme"
                        value={activeTab.content}
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        options={{
                          automaticLayout: true,
                          fontFamily: 'Fira Code, Menlo, Monaco, Consolas, monospace',
                          fontSize: 13,
                          lineHeight: 20,
                          minimap: { enabled: false },
                          scrollbar: {
                            vertical: 'visible',
                            horizontal: 'visible',
                            useShadows: false,
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8
                          },
                          cursorBlinking: 'smooth',
                          cursorSmoothCaretAnimation: 'on',
                          padding: { top: 10 }
                        }}
                      />
                    )}
                  </section>
                </>
              ) : (
                <SettingsPanel 
                  deviceId={deviceId}
                  deviceName={deviceName}
                  dbConnected={dbConnected}
                  userProfile={currentUser}
                  stats={stats}
                  onLogout={handleLogout}
                />
              )}

              {/* 5. Slider Console Output Panels */}
              <ConsolePanel
                isOpen={isConsoleOpen}
                activePane={activeConsolePane}
                setActivePane={setActiveConsolePane}
                logs={logs}
                onClear={handleClearLogs}
                rconsoleInputExpected={rconsoleInputExpected}
                onRconsoleSubmit={handleRconsoleInputSubmit}
              />
            </main>
          </div>

          {/* Premium Toast popup notification overlay */}
          <AnimatePresence>
            {toast.show && (
              <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`fixed top-16 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg ${
                  toast.type === 'success' 
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200 shadow-emerald-950/20' 
                    : toast.type === 'warning'
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-200 shadow-amber-950/20'
                    : toast.type === 'info'
                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-200 shadow-blue-950/20'
                    : 'bg-rose-500/20 border-rose-500/30 text-rose-200 shadow-rose-950/20'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${
                  toast.type === 'success' ? 'bg-emerald-400 animate-pulse' 
                  : toast.type === 'warning' ? 'bg-amber-400 animate-pulse'
                  : toast.type === 'info' ? 'bg-blue-400 animate-pulse'
                  : 'bg-rose-400'
                }`} />
                <span className="text-sm font-medium">{toast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { Shield, HardDrive, LayoutGrid, CheckCircle2, XCircle, LogOut, Laptop, Monitor, Gamepad2, RefreshCw } from 'lucide-react';

export default function SettingsPanel({ 
  deviceId, 
  deviceName, 
  dbConnected, 
  userProfile, 
  stats,
  onLogout
}) {
  const [platformName, setPlatformName] = React.useState('macOS');
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isWin = navigator.platform.toUpperCase().indexOf('WIN') >= 0;
      setPlatformName(isWin ? 'Windows' : 'macOS');
    }
  }, []);

  const triggerRefreshAnimation = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Find current device stats
  const myStats = stats?.find(s => s.device_id === deviceId) || {
    total_synced_scripts: 0,
    total_executions: 0,
    last_sync_at: null
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary font-sans animate-fade-in-up">
      {/* Settings Header bar */}
      <div className="h-[42px] bg-bg-header border-b border-border-color flex items-center justify-between px-4 shrink-0">
        <h3 className="text-[11px] font-bold tracking-wider text-text-primary flex items-center gap-2">
          <Shield size={14} className="text-accent-blue" />
          SYSTEM SETTINGS & CLOUD SYNC
        </h3>
        {dbConnected && (
          <button 
            onClick={triggerRefreshAnimation}
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCw size={14} className={`${isRefreshing ? 'animate-spin text-accent-blue' : ''}`} />
          </button>
        )}
      </div>

      {/* Settings Body */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 max-w-4xl w-full mx-auto select-none scrollbar-none">
        
        {/* Section 1: Connection & Device */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2 bg-[#090d14] border border-border-color rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent-blue/5 rounded-full blur-2xl group-hover:bg-accent-blue/10 transition-colors duration-300" />
            <div>
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <HardDrive size={12} className="text-accent-blue" />
                Current Device Info
              </div>
              <h4 className="text-[15px] font-bold text-text-primary truncate mb-1">
                {deviceName || 'Device Client'}
              </h4>
              <p className="text-[11px] text-text-muted select-text font-mono mt-1">
                ID: <span className="text-accent-blue font-semibold">{deviceId || 'DEV-ID-UNKNOWN'}</span>
              </p>
            </div>
            <div className="mt-4 border-t border-border-color/30 pt-3 flex justify-between items-center">
              <span className="text-[10px] text-text-secondary">Host Platform Details</span>
              <span className="text-[10px] font-mono text-text-primary bg-white/5 px-2 py-0.5 rounded">
                {platformName.toUpperCase()} OS
              </span>
            </div>
          </div>

          <div className="bg-[#090d14] border border-border-color rounded-xl p-5 flex flex-col justify-between shadow-lg text-center relative overflow-hidden">
            <div>
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">
                Database Status
              </div>
              <div className="flex justify-center mb-2">
                {dbConnected ? (
                  <CheckCircle2 size={36} className="text-emerald-500 animate-pulse" />
                ) : (
                  <XCircle size={36} className="text-red-500 animate-pulse" />
                )}
              </div>
            </div>
            <div>
              <div className={`font-bold text-[11px] tracking-wider uppercase ${dbConnected ? 'text-emerald-500' : 'text-red-500'}`}>
                {dbConnected ? 'DATABASE ONLINE' : 'DATABASE OFFLINE'}
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                {dbConnected ? 'Sync system fully active' : 'PostgreSQL disconnected'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Active Account Details */}
        <div className="bg-[#090d14] border border-border-color rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-center border-b border-border-color/50 pb-4 mb-4">
            <h4 className="text-[11px] font-bold text-text-primary tracking-wider uppercase">Active Account Profile</h4>
            {userProfile && (
              <button
                onClick={onLogout}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-semibold px-3 py-1.5 rounded transition-all duration-150 cursor-pointer border border-red-500/20 text-[10px] flex items-center gap-1.5"
              >
                <LogOut size={12} />
                LOG OUT FROM DEVICE
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#05070a] border border-border-color rounded-lg p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Username</div>
              <div className="text-[13px] font-bold text-text-primary">
                {userProfile?.username || 'Not Logged In'}
              </div>
            </div>
            <div className="bg-[#05070a] border border-border-color rounded-lg p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Email Address</div>
              <div className="text-[13px] font-bold text-text-primary select-text">
                {userProfile?.email || 'n/a'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Device Cloud Network (Requirement #8 + Real-time Active Game Detection) */}
        <div className="bg-[#090d14] border border-border-color rounded-xl p-6 shadow-lg flex flex-col gap-4">
          <h4 className="text-[11px] font-bold text-text-primary tracking-wider uppercase flex items-center gap-1.5">
            <LayoutGrid size={13} className="text-accent-yellow" />
            Device Cloud Sync Network
          </h4>

          {dbConnected ? (
            <div className="flex flex-col gap-3">
              {stats && stats.length > 0 ? (
                stats.map((device, index) => {
                  const isCurrent = device.device_id === deviceId;
                  const isWindows = String(device.os_platform).toLowerCase().includes('win');
                  const isPlaying = !!device.active_game_name;
                  
                  return (
                    <div 
                      key={device.device_id || index}
                      className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                        isCurrent 
                          ? 'bg-accent-blue/5 border-accent-blue/30 shadow-[0_0_15px_rgba(59,130,246,0.05)]' 
                          : 'bg-[#05070a] border-border-color/60 hover:border-border-color hover:bg-white/[0.01]'
                      }`}
                    >
                      {/* Left Side: Device Icon and Name */}
                      <div className="flex items-start gap-3.5">
                        <div className={`p-2.5 rounded-lg shrink-0 ${isCurrent ? 'bg-accent-blue/15 text-accent-blue' : 'bg-white/5 text-text-secondary'}`}>
                          {isWindows ? <Monitor size={18} /> : <Laptop size={18} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[13px] text-text-primary truncate">
                              {device.device_name}
                            </span>
                            {isCurrent && (
                              <span className="text-[8px] bg-accent-blue/20 text-accent-blue font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide">
                                This Device
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-text-muted font-mono mt-0.5 truncate max-w-[280px]">
                            ID: {device.device_id}
                          </p>
                        </div>
                      </div>

                      {/* Middle Side: Active Roblox Game Play Status */}
                      <div className="flex items-center gap-2 bg-white/[0.02] border border-border-color/30 rounded-lg px-3 py-2 shrink-0 md:max-w-[280px] w-full md:w-auto">
                        <div className="relative flex h-2.5 w-2.5 shrink-0">
                          {isPlaying && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          )}
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? 'bg-emerald-500' : 'bg-white/10'}`}></span>
                        </div>
                        <div className="min-w-0">
                          {isPlaying ? (
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                                <Gamepad2 size={10} /> Playing Roblox
                              </span>
                              <span className="text-[11px] font-bold text-text-primary truncate" title={device.active_game_name}>
                                {device.active_game_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-muted font-medium">Offline / Idle</span>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Sync Stats */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 border-border-color/30 pt-3.5 md:pt-0">
                        <div className="text-right">
                          <div className="text-[8px] text-text-muted uppercase tracking-wider">Synced Scripts</div>
                          <div className="text-[13px] font-bold text-text-primary">{device.total_synced_scripts || 0}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] text-text-muted uppercase tracking-wider">Runs</div>
                          <div className="text-[13px] font-bold text-text-primary">{device.total_executions || 0}</div>
                        </div>
                        <div className="text-right pl-2 border-l border-border-color/30 min-w-[100px]">
                          <div className="text-[8px] text-text-muted uppercase tracking-wider">Last Sync</div>
                          <div className="text-[10px] font-mono text-text-secondary mt-0.5">
                            {device.last_sync_at ? new Date(device.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-text-muted text-[11px] border border-dashed border-border-color rounded-xl">
                  No devices registered in cloud network.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted text-[11px] border border-dashed border-border-color rounded-xl bg-white/[0.01]">
              Database offline. Connect to PostgreSQL to enable Cloud Device Network.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Shield, HardDrive, LayoutGrid, CheckCircle2, XCircle, LogOut } from 'lucide-react';

export default function SettingsPanel({ 
  deviceId, 
  deviceName, 
  dbConnected, 
  userProfile, 
  stats,
  onLogout
}) {
  const [platformName, setPlatformName] = React.useState('macOS');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isWin = navigator.platform.toUpperCase().indexOf('WIN') >= 0;
      setPlatformName(isWin ? 'Windows' : 'macOS');
    }
  }, []);

  const myStats = stats?.find(s => s.device_id === deviceId) || {
    total_synced_scripts: 0,
    total_executions: 0,
    last_sync_at: null
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary font-sans animate-fade-in-up">
      {/* Settings Header bar */}
      <div className="h-[42px] bg-bg-header border-b border-border-color flex items-center px-4 shrink-0">
        <h3 className="text-[11px] font-bold tracking-wider text-text-primary flex items-center gap-2">
          <Shield size={14} className="text-accent-blue" />
          SYSTEM SETTINGS & CLOUD SYNC
        </h3>
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
                Device Information
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

        {/* Section 3: Sync Statistics */}
        <div className="bg-[#090d14] border border-border-color rounded-xl p-6 shadow-lg flex flex-col gap-4">
          <h4 className="text-[11px] font-bold text-text-primary tracking-wider uppercase flex items-center gap-1.5">
            <LayoutGrid size={13} className="text-accent-yellow" />
            Synchronized Cloud Statistics
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#05070a] border border-border-color rounded-lg p-5 text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-accent-blue" />
              <div className="text-[9px] text-text-secondary uppercase tracking-wider mb-1">Total Synced Scripts</div>
              <div className="text-2xl font-bold text-accent-blue">{myStats.total_synced_scripts || 0}</div>
            </div>
            <div className="bg-[#05070a] border border-border-color rounded-lg p-5 text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-accent-yellow" />
              <div className="text-[9px] text-text-secondary uppercase tracking-wider mb-1">Total Executions</div>
              <div className="text-2xl font-bold text-accent-yellow">{myStats.total_executions || 0}</div>
            </div>
          </div>

          <div className="bg-[#05070a] border border-border-color rounded-lg p-3.5 flex justify-between items-center text-[10px] mt-2">
            <span className="text-text-secondary font-medium">Last Synced Timestamp:</span>
            <span className="font-mono text-text-primary">
              {myStats.last_sync_at ? new Date(myStats.last_sync_at).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

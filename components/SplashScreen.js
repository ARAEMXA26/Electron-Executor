'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function SplashScreen({ progress, statusText }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#070a0f] flex flex-col items-center justify-center select-none overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent-blue/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-cyan/5 blur-[120px] pointer-events-none" />

      {/* Main Logo & Title Container */}
      <div className="flex flex-col items-center z-10 max-w-[400px] w-full px-6">
        {/* Breathing Glowing Logo Shield */}
        <div className="relative mb-10 animate-pulse-glowing flex items-center justify-center">
          <img 
            src="/logo.png" 
            className="w-36 h-36 object-contain rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.2)] relative z-10" 
            alt="Logo" 
          />
        </div>

        {/* Brand Header */}
        <h1 className="text-xl font-bold tracking-[0.25em] text-text-primary uppercase text-center animate-text-glow select-none mb-1">
          ELECTRON EXECUTOR
        </h1>
        <p className="text-[10px] tracking-[0.18em] text-text-secondary font-semibold uppercase text-center mb-10 opacity-70">
          Next-Gen Roblox Environment
        </p>

        {/* Sleek Loading Bar Section */}
        <div className="w-full bg-[#04060a] border border-border-color/60 rounded-full h-[6px] overflow-hidden relative mb-4">
          <div 
            className="h-full bg-gradient-to-r from-accent-blue to-accent-cyan rounded-full shadow-[0_0_12px_rgba(0,255,216,0.7)] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status updates & percentages */}
        <div className="w-full flex items-center justify-between px-1 text-[11px] font-mono text-text-secondary">
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-accent-cyan" />
            <span className="truncate max-w-[220px] select-none text-left">{statusText}</span>
          </div>
          <span className="text-accent-cyan font-bold tabular-nums">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] tracking-widest text-text-muted select-none">
        SECURE EXECUTION SYSTEM v1.0.0
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Play, FolderOpen, Zap, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Toolbar({ 
  onExecute, 
  onOpenFile, 
  isAttached, 
  onToggleAttach, 
  onLaunchRoblox,
  robloxProcess
}) {
  const isRobloxRunning = robloxProcess?.running;

  return (
    <div className="flex gap-2 items-center">
      {/* Execute Button */}
      <motion.button
        whileHover={{ scale: 1.05, translateY: -1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onExecute}
        className="w-8 h-8 rounded-md border border-border-color bg-white/[0.01] text-emerald-500 flex justify-center items-center cursor-pointer transition-colors duration-150 hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:shadow-[0_0_8px_rgba(16,185,129,0.15)]"
        title="Execute Script"
      >
        <Play size={14} fill="currentColor" />
      </motion.button>

      {/* Load File Button */}
      <motion.button
        whileHover={{ scale: 1.05, translateY: -1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onOpenFile}
        className="w-8 h-8 rounded-md border border-border-color bg-white/[0.01] text-text-secondary flex justify-center items-center cursor-pointer transition-colors duration-150 hover:text-text-primary hover:border-text-muted hover:bg-white/[0.04]"
        title="Open Script File"
      >
        <FolderOpen size={14} />
      </motion.button>

      {/* Attach/Inject Button */}
      <motion.button
        whileHover={{ scale: 1.05, translateY: -1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggleAttach}
        animate={isAttached ? {
          boxShadow: [
            "0 0 2px rgba(16, 185, 129, 0.2)",
            "0 0 8px rgba(16, 185, 129, 0.4)",
            "0 0 2px rgba(16, 185, 129, 0.2)"
          ]
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className={`w-8 h-8 rounded-md border border-border-color bg-white/[0.01] flex justify-center items-center cursor-pointer transition-colors duration-150 ${
          isAttached 
            ? 'text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10' 
            : 'text-accent-yellow hover:bg-accent-yellow/10 hover:border-accent-yellow/25'
        }`}
        title={isAttached ? "Executor Attached" : "Attach Executor"}
      >
        <Zap size={14} fill={isAttached ? "currentColor" : "none"} />
      </motion.button>

      {/* Roblox Launch / Status Button */}
      <motion.button
        whileHover={{ scale: 1.05, translateY: -1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onLaunchRoblox}
        className={`w-8 h-8 rounded-md border border-border-color bg-white/[0.01] flex justify-center items-center cursor-pointer transition-colors duration-150 hover:bg-white/[0.04] ${
          isRobloxRunning ? 'text-emerald-400' : 'text-accent-blue'
        }`}
        title={isRobloxRunning ? "Roblox is running" : "Launch Roblox Client"}
      >
        <Gamepad2 size={14} />
      </motion.button>
    </div>
  );
}

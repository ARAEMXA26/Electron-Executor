'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function StatusBanner({ robloxProcess, activeGame }) {
  const isRobloxRunning = robloxProcess?.running;
  const robloxType = robloxProcess?.type || 'Roblox Client';
  
  const activeMapName = activeGame?.gameName || 'No Active Session';
  const activePlaceId = activeGame?.placeId;

  return (
    <div className="bg-bg-header/80 border-b border-border-color/50 px-4 h-8 flex items-center justify-between text-[11px] font-sans text-text-secondary select-none">
      <div className="flex items-center gap-3">
        {/* Process indicator */}
        <span className="flex items-center gap-1.5">
          {isRobloxRunning ? (
            <motion.span 
              className="w-2 h-2 rounded-full bg-emerald-500"
              animate={{
                boxShadow: [
                  "0 0 2px rgba(16, 185, 129, 0.4)",
                  "0 0 8px rgba(16, 185, 129, 0.8)",
                  "0 0 2px rgba(16, 185, 129, 0.4)"
                ]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          ) : (
            <span className="w-2 h-2 rounded-full bg-red-500" />
          )}
          <span>{isRobloxRunning ? `${robloxType} Running` : `${robloxType} Closed`}</span>
        </span>
      </div>

      {/* Active Game / Map Info */}
      <div className="flex items-center gap-1.5 truncate max-w-[400px]">
        <span className="text-text-muted">Map:</span>
        <span className="font-semibold text-text-primary">{activeMapName}</span>
        {activePlaceId && (
          <span className="text-text-muted font-mono text-[10px]">({activePlaceId})</span>
        )}
      </div>
    </div>
  );
}

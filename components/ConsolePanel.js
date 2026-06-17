'use client';

import React, { useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConsolePanel({ 
  isOpen, 
  activePane, 
  setActivePane, 
  logs, 
  onClear 
}) {
  const bodyRef = useRef(null);

  // Scroll to bottom on new log additions
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs, activePane]);

  const paneTabs = [
    { id: 'console', label: 'CONSOLE' },
    { id: 'terminal', label: 'TERMINAL' },
    { id: 'rconsole', label: 'RCONSOLE' },
    { id: 'problems', label: 'PROBLEMS' }
  ];

  return (
    <motion.section
      initial={false}
      animate={{ 
        height: isOpen ? 200 : 0,
        opacity: isOpen ? 1 : 0,
        borderTopWidth: isOpen ? 1 : 0
      }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="bg-bg-primary border-t border-border-color flex flex-col overflow-hidden shrink-0 w-full"
    >
      {/* Console Tab Header */}
      <div className="h-9 bg-bg-header border-b border-border-color flex justify-between items-center px-3 select-none">
        <div className="flex h-full items-center">
          {paneTabs.map(tab => {
            const isActive = activePane === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePane(tab.id)}
                className={`bg-transparent border-0 font-sans text-[9px] font-bold tracking-wider px-3.5 h-full cursor-pointer transition-all duration-150 relative flex items-center hover:text-text-primary ${
                  isActive ? 'text-text-primary' : 'text-text-secondary'
                }`}
              >
                {tab.label}
                {isActive && (
                  <motion.div 
                    layoutId="activeConsoleTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-blue"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Clear console button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={onClear}
          className="bg-transparent border-0 text-text-muted cursor-pointer flex items-center justify-center w-6 h-6 rounded hover:text-text-primary hover:bg-white/5 transition-all duration-150"
          title="Clear Active Panel"
        >
          <Trash2 size={13} />
        </motion.button>
      </div>
      
      {/* Console Body showing outputs */}
      <div 
        ref={bodyRef}
        className="flex-grow overflow-y-auto p-3.5 font-mono text-[11px] leading-[18px] bg-[#05070a] select-text"
      >
        <div className="flex flex-col gap-0.5">
          {logs[activePane]?.map((log, index) => {
            let colorClass = 'text-text-secondary';
            if (log.type === 'system-log') colorClass = 'text-text-muted';
            else if (log.type === 'info-log') colorClass = 'text-text-secondary';
            else if (log.type === 'success-log') colorClass = 'text-text-log';
            else if (log.type === 'roblox-print') colorClass = 'text-text-log';
            else if (log.type === 'roblox-warn') colorClass = 'text-accent-yellow';
            else if (log.type === 'roblox-error') colorClass = 'text-red-500';

            return (
              <div key={index} className={colorClass}>
                {log.text}
              </div>
            );
          })}
          {(!logs[activePane] || logs[activePane].length === 0) && (
            <div className="text-text-muted italic">No logs available.</div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

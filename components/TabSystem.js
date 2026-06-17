'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TabSystem({ 
  tabs, 
  activeTabId, 
  onTabSelect, 
  onTabClose, 
  onTabAdd, 
  onTabRename,
  onTabDelete,
  onTabExecute
}) {
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { tabId, tab, x, y }

  // Listen to global click to close context menu
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleTabContextMenu = (e, tab) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      tabId: tab.id,
      tab: tab,
      x: e.clientX,
      y: e.clientY
    });
  };

  const startRename = (tab) => {
    setEditingTabId(tab.id);
    setEditingText(tab.name);
  };

  const commitRename = (tabId) => {
    if (editingText.trim()) {
      onTabRename(tabId, editingText.trim());
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (e, tabId) => {
    if (e.key === 'Enter') {
      commitRename(tabId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  return (
    <div className="flex h-full items-end overflow-hidden flex-1 select-none pr-4">
      {/* Tabs List */}
      <div className="flex items-end overflow-x-auto gap-1 h-full max-w-full scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        <AnimatePresence initial={false}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <motion.div
                key={tab.id}
                layoutId={`tab-${tab.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                onClick={() => onTabSelect(tab.id)}
                onContextMenu={(e) => handleTabContextMenu(e, tab)}
                onDoubleClick={(e) => handleTabContextMenu(e, tab)}
                className={`flex items-center gap-2 px-3.5 h-[34px] rounded-t-md text-[11px] cursor-pointer transition-colors duration-150 relative max-w-[150px] min-w-[90px] whitespace-nowrap ${
                  isActive 
                    ? 'bg-bg-active-tab text-text-primary border-b-2 border-accent-blue font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]' 
                    : 'bg-white/[0.01] border border-border-color border-b-0 text-text-secondary hover:bg-white/[0.03] hover:text-text-primary'
                }`}
              >
                {editingTabId === tab.id ? (
                  <input
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => commitRename(tab.id)}
                    onKeyDown={(e) => handleKeyDown(e, tab.id)}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="bg-bg-primary text-text-primary border border-accent-blue/30 rounded px-1 text-[10px] w-full focus:outline-none focus:border-accent-blue"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="truncate flex-1">{tab.name}</span>

                    {/* Specific logo for ironsoul.lua */}
                    {tab.name === 'ironsoul.lua' && (
                      <span className="text-accent-yellow flex items-center shrink-0">
                        <Zap size={10} fill="currentColor" />
                      </span>
                    )}

                    {/* Unsaved indicator / Dot */}
                    {tab.unsaved && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
                    )}

                    {/* Close Button (only closes tab in UI, does not delete from disk) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTabClose(tab.id);
                      }}
                      className="bg-transparent border-0 text-text-muted hover:text-text-primary hover:bg-white/10 rounded-full w-3.5 h-3.5 flex items-center justify-center transition-all duration-150"
                    >
                      <X size={10} />
                    </button>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add Tab Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onTabAdd}
        className="w-[28px] h-[28px] rounded-md border border-border-color bg-white/[0.01] text-text-secondary flex justify-center items-center cursor-pointer transition-colors duration-150 hover:text-text-primary hover:border-text-muted hover:bg-white/[0.04] mb-1.5 ml-2 shrink-0"
        title="New Tab"
      >
        <Plus size={12} />
      </motion.button>

      {/* Custom Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#0b0f17]/95 border border-border-color rounded-xl shadow-2xl p-1 text-[11px] font-sans text-text-secondary w-32 select-none backdrop-blur-md"
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 8px 16px -6px rgba(0, 0, 0, 0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              startRename(contextMenu.tab);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-white/5 hover:text-text-primary flex items-center gap-2 cursor-pointer transition-colors"
          >
            Rename
          </button>
          <button 
            onClick={() => {
              onTabExecute(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-emerald-500/10 hover:text-emerald-400 flex items-center gap-2 cursor-pointer transition-colors"
          >
            Execute
          </button>
          <div className="h-[1px] bg-border-color/50 my-1 mx-1"></div>
          <button 
            onClick={() => {
              onTabDelete(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2 cursor-pointer transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

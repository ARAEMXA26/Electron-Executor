'use client';

import React from 'react';

export default function TitleBar() {
  return (
    <header className="h-[38px] bg-bg-header border-b border-border-color flex items-center justify-center relative select-none title-bar-drag w-full pl-20">
      <span className="text-[11px] font-semibold tracking-[0.2em] text-text-secondary uppercase select-none">
        ELECTRON EXECUTOR
      </span>
    </header>
  );
}

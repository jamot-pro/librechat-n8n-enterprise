import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import DivineChat from './DivineChat';

export default function DivineSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg
          bg-gradient-to-br from-blue-500 to-purple-600
          flex items-center justify-center text-white
          hover:scale-105 active:scale-95 transition-all duration-150
          ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}
        title="Divine Intelligence (⌘K)"
        aria-label="Open Divine Intelligence"
      >
        <Sparkles size={20} />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[1px]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        className={`
          fixed inset-y-0 right-0 z-50
          w-full sm:w-[400px]
          bg-white dark:bg-gray-900
          border-l border-gray-200 dark:border-gray-800
          shadow-2xl flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm">
              ✦
            </div>
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Divine Intelligence
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Chat fills the rest */}
        <div className="flex-1 overflow-hidden">
          <DivineChat />
        </div>
      </div>
    </>
  );
}

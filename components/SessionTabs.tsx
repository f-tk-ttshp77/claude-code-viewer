'use client';

import { useState, useRef, useCallback } from 'react';

interface Tab {
  id: string;
  label: string;
}

interface SessionTabsProps {
  tabs: Tab[];
  children: (activeTab: string) => React.ReactNode;
}

export function SessionTabs({ tabs, children }: SessionTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;
      if (e.key === 'ArrowRight') {
        nextIndex = (index + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabs.length - 1;
      }
      if (nextIndex !== null) {
        e.preventDefault();
        setActiveTab(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
      }
    },
    [tabs]
  );

  return (
    <div>
      {/* Tab buttons */}
      <div
        role="tablist"
        className="sticky top-14 z-30 -mx-4 mb-4 flex border-b border-gray-200 bg-gray-50 px-4 dark:border-gray-700 dark:bg-gray-900 sm:-mx-8 sm:px-8"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={activeTab}>
        {children(activeTab)}
      </div>
    </div>
  );
}

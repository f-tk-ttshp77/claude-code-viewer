'use client';

import { useState } from 'react';

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

  return (
    <div>
      {/* Tab buttons */}
      <div className="mb-4 flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>{children(activeTab)}</div>
    </div>
  );
}

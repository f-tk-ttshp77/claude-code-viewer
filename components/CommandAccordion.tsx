'use client';

import { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  commandName: string;
  content: string;
}

export function CommandAccordion({ commandName, content }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg my-2 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
      >
        <span className="font-medium text-gray-700">
          📄 {commandName} の展開内容
        </span>
        <span className="text-gray-500 text-sm">
          {isOpen ? '▲ 閉じる' : '▼ 開く'}
        </span>
      </button>
      {isOpen && (
        <div className="p-4 border-t border-gray-200 bg-white max-h-96 overflow-y-auto">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}

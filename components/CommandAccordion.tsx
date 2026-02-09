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
    <div className="my-2 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <span className="font-medium text-gray-700 dark:text-gray-300">
          📄 {commandName} の展開内容
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {isOpen ? '▲ 閉じる' : '▼ 開く'}
        </span>
      </button>
      {isOpen && (
        <div className="max-h-96 overflow-y-auto border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}

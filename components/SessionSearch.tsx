'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SessionSearchProps {
  onSearch: (query: string) => void;
  totalCount: number;
  filteredCount: number;
}

export default function SessionSearch({ onSearch, totalCount, filteredCount }: SessionSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        onSearch(value);
      }, 300);
    },
    [onSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    debouncedSearch(value);
  };

  const handleClear = () => {
    setInputValue('');
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    onSearch('');
  };

  const isFiltered = inputValue.length > 0;

  return (
    <div className="mb-6">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg
            className="h-5 w-5 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          placeholder="セッションを検索..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        />
        {isFiltered && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label="検索をクリア"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
      {isFiltered && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {totalCount}件中{filteredCount}件表示
        </p>
      )}
    </div>
  );
}

/**
 * Filter sessions by search query.
 * Performs case-insensitive partial matching against session summary and project name.
 */
export function filterSessions<T extends { summary: string | null; projectName: string }>(
  sessions: T[],
  query: string
): T[] {
  if (!query.trim()) {
    return sessions;
  }
  const lowerQuery = query.toLowerCase();
  return sessions.filter((session) => {
    const summary = (session.summary || '').toLowerCase();
    const projectName = session.projectName.toLowerCase();
    return summary.includes(lowerQuery) || projectName.includes(lowerQuery);
  });
}

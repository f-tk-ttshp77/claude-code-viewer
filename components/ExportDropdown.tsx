'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  projectName: string;
  sessionId: string;
}

type FormatOption = {
  value: 'markdown' | 'json' | 'html';
  label: string;
  ext: string;
};

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'markdown', label: 'Markdown', ext: '.md' },
  { value: 'json', label: 'JSON', ext: '.json' },
  { value: 'html', label: 'HTML', ext: '.html' },
];

export function ExportDropdown({ projectName, sessionId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [includeToolCalls, setIncludeToolCalls] = useState(false);
  const [includeTokenStats, setIncludeTokenStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleExport = async (format: string) => {
    setIsExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        project: projectName,
        session: sessionId,
        format,
        includeToolCalls: String(includeToolCalls),
        includeTokenStats: String(includeTokenStats),
      });

      const response = await fetch(`/api/export?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Export failed');
      }

      // Extract filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `session.${format === 'markdown' ? 'md' : format}`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-500 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-600 disabled:opacity-50 sm:px-4 sm:text-base"
      >
        {isExporting ? 'Exporting...' : 'Export'}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {/* Options */}
          <div className="border-b border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Options</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includeToolCalls}
                onChange={(e) => setIncludeToolCalls(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Include tool calls
            </label>
            <label className="mt-1.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includeTokenStats}
                onChange={(e) => setIncludeTokenStats(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Include token stats
            </label>
          </div>

          {/* Format buttons */}
          <div className="p-2">
            <p className="mb-1.5 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              Format
            </p>
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleExport(opt.value)}
                disabled={isExporting}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <span>{opt.label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{opt.ext}</span>
              </button>
            ))}
          </div>

          {/* Error display */}
          {error && (
            <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

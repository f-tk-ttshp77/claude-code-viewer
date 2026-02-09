'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { SearchResult } from '@/lib/types';

interface ProjectOption {
  key: string;
  name: string;
}

interface Props {
  projects: ProjectOption[];
}

const TOOL_OPTIONS = [
  'Read',
  'Edit',
  'Write',
  'Bash',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'Task',
];

export function SearchPage({ projects }: Props) {
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [toolFilter, setToolFilter] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);
    const start = performance.now();

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (projectFilter) params.set('project', projectFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (toolFilter) params.set('tool', toolFilter);

      const res = await fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      setResults(data.results || []);
      setElapsed(Math.round(performance.now() - start));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Search failed:', err);
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [query, projectFilter, dateFrom, dateTo, toolFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doSearch();
    }
  };

  const totalMatches = results.reduce((sum, r) => sum + r.totalMatches, 0);

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="検索キーワードを入力..."
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        />
        <button
          onClick={doSearch}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {loading ? '検索中...' : '検索'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">全プロジェクト</option>
          {projects.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">全ツール</option>
          {TOOL_OPTIONS.map((tool) => (
            <option key={tool} value={tool}>
              {tool}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <span>From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          />
          <span>To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          />
        </div>
      </div>

      {/* Results summary */}
      {searched && !loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {results.length > 0 ? (
            <>
              <span className="font-medium text-gray-900 dark:text-gray-100">{results.length}</span>{' '}
              セッションで{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">{totalMatches}</span>{' '}
              件のマッチ
              <span className="ml-2 text-gray-400 dark:text-gray-500">({elapsed}ms)</span>
            </>
          ) : (
            '検索結果が見つかりませんでした'
          )}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          検索中...
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <SearchResultCard key={result.sessionId} result={result} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ result, query }: { result: SearchResult; query: string }) {
  const sessionDate = result.sessionTimestamp
    ? new Date(result.sessionTimestamp).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // Extract project key from projectName for the link URL
  // The session detail URL uses the encoded project path
  const projectPath = encodeURIComponent(result.projectName);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/session/${projectPath}/${result.sessionId}`}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {result.sessionId.slice(0, 8)}...
          </Link>
          <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {result.projectName}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            {result.totalMatches} マッチ
          </span>
          {sessionDate && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{sessionDate}</span>
          )}
        </div>
      </div>

      {/* Match snippets */}
      <div className="space-y-2">
        {result.matches.slice(0, 5).map((match, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                match.messageRole === 'user'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
              }`}
            >
              {match.messageRole === 'user' ? 'User' : 'AI'}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              <HighlightedSnippet text={match.snippet} query={query} />
            </span>
          </div>
        ))}
        {result.matches.length > 5 && (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            ... 他 {result.matches.length - 5} 件のマッチ
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const parts: { text: string; highlight: boolean }[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let searchPos = 0;
  while (searchPos < lowerText.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, searchPos);
    if (matchIndex === -1) break;

    // Text before match
    if (matchIndex > lastIndex) {
      parts.push({ text: text.slice(lastIndex, matchIndex), highlight: false });
    }
    // Match itself
    parts.push({ text: text.slice(matchIndex, matchIndex + query.length), highlight: true });

    lastIndex = matchIndex + query.length;
    searchPos = lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 text-gray-900 dark:bg-yellow-700/60 dark:text-yellow-100"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

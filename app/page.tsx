import Link from 'next/link';
import { getProjects, getSessions, getDataPathInfo, getAllTokenStats } from '@/lib/parser';
import type { SessionTokenStats } from '@/lib/types';

function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

function EmptyState() {
  const pathInfo = getDataPathInfo();

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h2 className="mb-4 text-xl font-semibold text-amber-800">
        セッションデータが見つかりません
      </h2>

      <div className="space-y-4 text-amber-900">
        <div>
          <p className="mb-2 font-medium">現在の設定:</p>
          <code className="block overflow-x-auto rounded bg-amber-100 px-2 py-1 text-sm">
            {pathInfo.path}
          </code>
          <p className="mt-1 text-sm">
            {pathInfo.exists ? (
              <span className="text-green-700">
                ディレクトリは存在しますが、セッションファイルがありません
              </span>
            ) : (
              <span className="text-red-700">このディレクトリは存在しません</span>
            )}
          </p>
        </div>

        <div className="border-t border-amber-200 pt-4">
          <p className="mb-2 font-medium">解決方法:</p>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              <strong>Claude Code を使用していることを確認</strong>
              <p className="ml-5 text-amber-700">
                Claude Code でセッションを開始すると、自動的にデータが作成されます
              </p>
            </li>
            <li>
              <strong>データの保存場所を確認</strong>
              <p className="ml-5 text-amber-700">
                デフォルトでは <code className="rounded bg-amber-100 px-1">~/.claude/projects</code>{' '}
                にデータが保存されます
              </p>
            </li>
            {!pathInfo.isCustom && (
              <li>
                <strong>カスタムパスを設定</strong>
                <p className="ml-5 text-amber-700">
                  別の場所にデータがある場合は、
                  <code className="rounded bg-amber-100 px-1">.env</code> ファイルで{' '}
                  <code className="rounded bg-amber-100 px-1">CLAUDE_DATA_PATH</code>{' '}
                  を設定してください
                </p>
              </li>
            )}
          </ol>
        </div>

        <div className="border-t border-amber-200 pt-4">
          <p className="mb-2 font-medium">環境変数の設定例:</p>
          <pre className="overflow-x-auto rounded bg-amber-100 p-3 text-sm">
            {`# .env ファイルを作成して以下を追加
CLAUDE_DATA_PATH=/path/to/your/claude/projects`}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const projects = getProjects();
  const allTokenStats = getAllTokenStats();

  // Create a map for quick lookup by sessionId
  const tokenStatsMap = new Map<string, SessionTokenStats>();
  for (const stats of allTokenStats) {
    tokenStatsMap.set(stats.sessionId, stats);
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Claude Code Viewer</h1>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Token Analytics
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {projects.map((project) => {
            const sessions = getSessions(project);
            if (sessions.length === 0) return null;

            return (
              <div key={project} className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-4 text-lg font-semibold text-gray-700">
                  {sessions[0]?.projectName || project}
                </h2>

                <div className="space-y-2">
                  {sessions.map((session) => {
                    const tokenStats = tokenStatsMap.get(session.id);
                    const totalTokens = tokenStats
                      ? tokenStats.usage.inputTokens + tokenStats.usage.outputTokens
                      : 0;

                    return (
                      <Link
                        key={session.id}
                        href={`/session/${project}/${session.id}`}
                        className="block rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-400 hover:bg-blue-50 sm:p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-gray-900">
                              {session.summary || 'No summary'}
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              {formatDate(session.lastMessageTime)}
                            </div>
                          </div>
                          {tokenStats && totalTokens > 0 && (
                            <div className="flex-shrink-0 text-right">
                              <div className="text-sm font-medium text-gray-700">
                                {formatTokenCount(totalTokens)}
                              </div>
                              <div className="text-xs text-gray-400">tokens</div>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

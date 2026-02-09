import { getProjects, getSessions, getDataPathInfo, getAllTokenStats } from '@/lib/parser';
import { Breadcrumb } from '@/components/Breadcrumb';
import { HomeContent } from '@/components/HomeContent';
import type { SessionTokenStats } from '@/lib/types';

function EmptyState() {
  const pathInfo = getDataPathInfo();

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-900/30">
      <h2 className="mb-4 text-xl font-semibold text-amber-800 dark:text-amber-300">
        セッションデータが見つかりません
      </h2>

      <div className="space-y-4 text-amber-900 dark:text-amber-200">
        <div>
          <p className="mb-2 font-medium">現在の設定:</p>
          <code className="block overflow-x-auto rounded bg-amber-100 px-2 py-1 text-sm dark:bg-amber-800/50">
            {pathInfo.path}
          </code>
          <p className="mt-1 text-sm">
            {pathInfo.exists ? (
              <span className="text-green-700 dark:text-green-400">
                ディレクトリは存在しますが、セッションファイルがありません
              </span>
            ) : (
              <span className="text-red-700 dark:text-red-400">このディレクトリは存在しません</span>
            )}
          </p>
        </div>

        <div className="border-t border-amber-200 pt-4 dark:border-amber-700">
          <p className="mb-2 font-medium">解決方法:</p>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              <strong>Claude Code を使用していることを確認</strong>
              <p className="ml-5 text-amber-700 dark:text-amber-300">
                Claude Code でセッションを開始すると、自動的にデータが作成されます
              </p>
            </li>
            <li>
              <strong>データの保存場所を確認</strong>
              <p className="ml-5 text-amber-700 dark:text-amber-300">
                デフォルトでは{' '}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-800/50">
                  ~/.claude/projects
                </code>{' '}
                にデータが保存されます
              </p>
            </li>
            {!pathInfo.isCustom && (
              <li>
                <strong>カスタムパスを設定</strong>
                <p className="ml-5 text-amber-700 dark:text-amber-300">
                  別の場所にデータがある場合は、
                  <code className="rounded bg-amber-100 px-1 dark:bg-amber-800/50">.env</code>{' '}
                  ファイルで{' '}
                  <code className="rounded bg-amber-100 px-1 dark:bg-amber-800/50">
                    CLAUDE_DATA_PATH
                  </code>{' '}
                  を設定してください
                </p>
              </li>
            )}
          </ol>
        </div>

        <div className="border-t border-amber-200 pt-4 dark:border-amber-700">
          <p className="mb-2 font-medium">環境変数の設定例:</p>
          <pre className="overflow-x-auto rounded bg-amber-100 p-3 text-sm dark:bg-amber-800/50">
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

  // Create a serializable record for the client component
  const tokenStatsMap: Record<string, SessionTokenStats> = {};
  for (const stats of allTokenStats) {
    tokenStatsMap[stats.sessionId] = stats;
  }

  // Build project data with sessions
  const projectData = projects
    .map((project) => {
      const sessions = getSessions(project);
      return {
        projectKey: project,
        projectName: sessions[0]?.projectName || project,
        sessions,
      };
    })
    .filter((p) => p.sessions.length > 0);

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <Breadcrumb />
        <h1 className="mt-2 text-2xl font-bold dark:text-gray-100 sm:text-3xl">Sessions</h1>
      </div>

      {projectData.length === 0 ? (
        <EmptyState />
      ) : (
        <HomeContent projects={projectData} tokenStatsMap={tokenStatsMap} />
      )}
    </main>
  );
}

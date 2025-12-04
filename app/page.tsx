import Link from 'next/link';
import { getProjects, getSessions, getDataPathInfo } from '@/lib/parser';

function EmptyState() {
  const pathInfo = getDataPathInfo();

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-amber-800 mb-4">
        セッションデータが見つかりません
      </h2>

      <div className="space-y-4 text-amber-900">
        <div>
          <p className="font-medium mb-2">現在の設定:</p>
          <code className="bg-amber-100 px-2 py-1 rounded text-sm block overflow-x-auto">
            {pathInfo.path}
          </code>
          <p className="text-sm mt-1">
            {pathInfo.exists ? (
              <span className="text-green-700">ディレクトリは存在しますが、セッションファイルがありません</span>
            ) : (
              <span className="text-red-700">このディレクトリは存在しません</span>
            )}
          </p>
        </div>

        <div className="border-t border-amber-200 pt-4">
          <p className="font-medium mb-2">解決方法:</p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              <strong>Claude Code を使用していることを確認</strong>
              <p className="ml-5 text-amber-700">
                Claude Code でセッションを開始すると、自動的にデータが作成されます
              </p>
            </li>
            <li>
              <strong>データの保存場所を確認</strong>
              <p className="ml-5 text-amber-700">
                デフォルトでは <code className="bg-amber-100 px-1 rounded">~/.claude/projects</code> にデータが保存されます
              </p>
            </li>
            {!pathInfo.isCustom && (
              <li>
                <strong>カスタムパスを設定</strong>
                <p className="ml-5 text-amber-700">
                  別の場所にデータがある場合は、<code className="bg-amber-100 px-1 rounded">.env</code> ファイルで{' '}
                  <code className="bg-amber-100 px-1 rounded">CLAUDE_DATA_PATH</code> を設定してください
                </p>
              </li>
            )}
          </ol>
        </div>

        <div className="border-t border-amber-200 pt-4">
          <p className="font-medium mb-2">環境変数の設定例:</p>
          <pre className="bg-amber-100 p-3 rounded text-sm overflow-x-auto">
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

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Claude Code Viewer</h1>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {projects.map((project) => {
            const sessions = getSessions(project);
            if (sessions.length === 0) return null;

            return (
              <div key={project} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">
                  {sessions[0]?.projectName || project}
                </h2>

                <div className="space-y-2">
                  {sessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/session/${project}/${session.id}`}
                      className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">
                        {session.summary || 'No summary'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {formatDate(session.lastMessageTime)}
                      </div>
                    </Link>
                  ))}
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

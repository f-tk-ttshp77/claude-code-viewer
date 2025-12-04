import Link from 'next/link';
import { getProjects, getSessions } from '@/lib/parser';

export default function Home() {
  const projects = getProjects();

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Claude Code Viewer</h1>

      {projects.length === 0 ? (
        <p className="text-gray-500">
          No projects found. Make sure ~/.claude/projects exists.
        </p>
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

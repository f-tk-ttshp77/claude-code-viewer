import Link from 'next/link';
import {
  getSession,
  getMessages,
  getSessionSummary,
  getSessionTokenStats,
  getSessions,
} from '@/lib/parser';
import { ExportDropdown } from '@/components/ExportDropdown';
import { SessionContent } from '@/components/SessionContent';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ScrollToTop } from '@/components/ScrollToTop';

interface Props {
  params: { project: string; id: string };
}

function getAdjacentSessions(
  projectName: string,
  currentId: string
): { prev: string | null; next: string | null } {
  const sessions = getSessions(projectName);
  const currentIndex = sessions.findIndex((s) => s.id === currentId);
  if (currentIndex === -1) return { prev: null, next: null };
  return {
    prev: currentIndex < sessions.length - 1 ? sessions[currentIndex + 1].id : null,
    next: currentIndex > 0 ? sessions[currentIndex - 1].id : null,
  };
}

export default function SessionPage({ params }: Props) {
  const session = getSession(params.project, params.id);
  const messages = getMessages(params.project, params.id);
  const summary = getSessionSummary(params.project, params.id);
  const tokenStats = getSessionTokenStats(params.project, params.id);
  const { prev, next } = getAdjacentSessions(params.project, params.id);

  if (!session) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-red-500">Session not found</p>
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Breadcrumb />
          <h1 className="mt-2 break-words text-xl font-bold dark:text-gray-100 sm:text-2xl">
            {session.summary || 'Session'}
          </h1>
          <p className="mt-1 break-words text-sm text-gray-500 dark:text-gray-400">
            {session.projectName} • {formatDate(session.lastMessageTime)}
          </p>
        </div>
        <div className="flex-shrink-0">
          <ExportDropdown projectName={params.project} sessionId={params.id} />
        </div>
      </div>

      {/* Prev/Next Session Navigation */}
      <div className="mb-4 flex items-center justify-between">
        {prev ? (
          <Link
            href={`/session/${params.project}/${prev}`}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <span aria-hidden="true">&larr;</span> 前のセッション
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600">
            <span aria-hidden="true">&larr;</span> 前のセッション
          </span>
        )}
        {next ? (
          <Link
            href={`/session/${params.project}/${next}`}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            次のセッション <span aria-hidden="true">&rarr;</span>
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600">
            次のセッション <span aria-hidden="true">&rarr;</span>
          </span>
        )}
      </div>

      {/* Content with tabs */}
      <SessionContent
        messages={messages}
        summary={summary}
        projectName={params.project}
        sessionId={params.id}
        tokenStats={tokenStats}
      />

      <ScrollToTop />
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

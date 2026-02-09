import Link from 'next/link';
import { getSession, getMessages, getSessionSummary, getSessionTokenStats } from '@/lib/parser';
import { ExportButton } from '@/components/ExportButton';
import { SessionContent } from '@/components/SessionContent';

interface Props {
  params: { project: string; id: string };
}

export default function SessionPage({ params }: Props) {
  const session = getSession(params.project, params.id);
  const messages = getMessages(params.project, params.id);
  const summary = getSessionSummary(params.project, params.id);
  const tokenStats = getSessionTokenStats(params.project, params.id);

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
          <Link href="/" className="text-sm text-blue-500 hover:underline">
            ← Back
          </Link>
          <h1 className="mt-2 break-words text-xl font-bold sm:text-2xl">
            {session.summary || 'Session'}
          </h1>
          <p className="mt-1 break-words text-sm text-gray-500">
            {session.projectName} • {formatDate(session.lastMessageTime)}
          </p>
        </div>
        <div className="flex-shrink-0">
          <ExportButton session={session} messages={messages} />
        </div>
      </div>

      {/* Content with tabs */}
      <SessionContent
        messages={messages}
        summary={summary}
        projectName={params.project}
        sessionId={params.id}
        tokenStats={tokenStats}
      />
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

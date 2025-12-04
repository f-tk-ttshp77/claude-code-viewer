import Link from 'next/link';
import { getSession, getMessages } from '@/lib/parser';
import { ExportButton } from '@/components/ExportButton';

interface Props {
  params: { project: string; id: string };
}

export default function SessionPage({ params }: Props) {
  const session = getSession(params.project, params.id);
  const messages = getMessages(params.project, params.id);

  if (!session) {
    return (
      <main className="max-w-4xl mx-auto p-8">
        <p className="text-red-500">Session not found</p>
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Home
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/" className="text-blue-500 hover:underline text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            {session.summary || 'Session'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {session.projectName} • {formatDate(session.lastMessageTime)}
          </p>
        </div>
        <ExportButton session={session} messages={messages} />
      </div>

      {/* Messages */}
      <div id="chat-content" className="bg-white rounded-lg shadow">
        {messages.length === 0 ? (
          <p className="p-6 text-gray-500">No messages</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((message) => (
              <div key={message.uuid} className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-sm font-medium ${
                      message.type === 'user'
                        ? 'text-blue-600'
                        : 'text-green-600'
                    }`}
                  >
                    {message.type === 'user' ? '👤 User' : '🤖 Claude'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="text-gray-800 whitespace-pre-wrap">
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

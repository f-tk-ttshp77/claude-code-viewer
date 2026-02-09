'use client';

import { SessionTabs } from './SessionTabs';
import { SessionSummaryView } from './SessionSummary';
import { ContentRenderer } from './ContentRenderer';
import type { Message, SessionSummary, SessionTokenStats } from '@/lib/types';

interface Props {
  messages: Message[];
  summary: SessionSummary | null;
  projectName: string;
  sessionId: string;
  tokenStats?: SessionTokenStats | null;
}

const tabs = [
  { id: 'conversation', label: '対話' },
  { id: 'summary', label: 'サマリー' },
];

export function SessionContent({ messages, summary, projectName, sessionId, tokenStats }: Props) {
  return (
    <SessionTabs tabs={tabs}>
      {(activeTab) => (
        <>
          {activeTab === 'conversation' && (
            <div>
              {messages.length === 0 ? (
                <p className="p-6 text-gray-500 dark:text-gray-400">No messages</p>
              ) : (
                <div className="flex flex-col gap-6">
                  {messages.map((message, index) => {
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const prevHasCommandMessage =
                      prevMessage?.content.includes('<command-message>');
                    const commandMatch = prevHasCommandMessage
                      ? prevMessage?.content.match(/<command-name>(\w+)<\/command-name>/) ||
                        prevMessage?.content.match(/^\/(\w+)/)
                      : null;

                    const isCommandExpansion = !!(
                      prevHasCommandMessage &&
                      message.type === 'user' &&
                      message.content.length > 500 &&
                      !message.content.includes('<command-message>')
                    );
                    const commandName = commandMatch ? commandMatch[1] : 'command';

                    const isUser = message.type === 'user';

                    return (
                      <div
                        key={message.uuid}
                        className={`rounded-lg p-4 shadow ${
                          isUser ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              isUser
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-green-600 dark:text-green-400'
                            }`}
                          >
                            {isUser ? '👤 User' : '🤖 Claude'}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <div className="text-gray-800 dark:text-gray-200">
                          <ContentRenderer
                            content={message.content}
                            isCommandExpansion={isCommandExpansion}
                            commandName={commandName}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:p-6">
              {summary ? (
                <SessionSummaryView
                  summary={summary}
                  projectName={projectName}
                  sessionId={sessionId}
                  tokenStats={tokenStats}
                />
              ) : (
                <p className="text-gray-500 dark:text-gray-400">サマリーを生成できませんでした</p>
              )}
            </div>
          )}
        </>
      )}
    </SessionTabs>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

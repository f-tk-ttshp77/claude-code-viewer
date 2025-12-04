'use client';

import { useState } from 'react';
import type { Session, Message } from '@/lib/types';

interface Props {
  session: Session;
  messages: Message[];
}

export function ExportButton({ session, messages }: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const exportHTML = () => {
    setIsExporting(true);

    const html = generateHTML(session, messages);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-session-${session.id.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsExporting(false);
  };

  return (
    <button
      onClick={exportHTML}
      disabled={isExporting}
      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
    >
      {isExporting ? 'Exporting...' : 'Export HTML'}
    </button>
  );
}

function generateHTML(session: Session, messages: Message[]): string {
  const messagesHTML = messages
    .map(
      (msg) => `
      <div class="message ${msg.type}">
        <div class="message-header">
          <span class="role">${msg.type === 'user' ? '👤 User' : '🤖 Claude'}</span>
          <span class="time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
      </div>
    `
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.summary || 'Claude Session')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
      color: #1f2937;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 2rem;
    }
    .header h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .header .meta { font-size: 0.875rem; opacity: 0.9; }
    .messages { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .message { padding: 1.5rem; border-bottom: 1px solid #f3f4f6; }
    .message:last-child { border-bottom: none; }
    .message-header { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center; }
    .role { font-weight: 600; }
    .message.user .role { color: #2563eb; }
    .message.assistant .role { color: #16a34a; }
    .time { font-size: 0.75rem; color: #9ca3af; }
    .message-content { white-space: pre-wrap; }
    .footer { text-align: center; padding: 2rem; color: #9ca3af; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(session.summary || 'Claude Code Session')}</h1>
      <div class="meta">
        <div>Project: ${escapeHtml(session.projectName)}</div>
        <div>Date: ${formatDate(session.lastMessageTime)}</div>
        <div>Messages: ${messages.length}</div>
      </div>
    </div>
    <div class="messages">
      ${messagesHTML}
    </div>
    <div class="footer">
      Exported from Claude Code Viewer
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

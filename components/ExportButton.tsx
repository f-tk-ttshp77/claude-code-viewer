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

    try {
      const html = generateHTML(session, messages);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const filename = `claude-session-${session.id.slice(0, 8)}.html`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={exportHTML}
      disabled={isExporting}
      className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm sm:text-base whitespace-nowrap"
    >
      {isExporting ? 'Exporting...' : 'Export HTML'}
    </button>
  );
}

function generateHTML(session: Session, messages: Message[]): string {
  const messagesHTML = messages
    .map((msg, index) => {
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const prevHasCommandMessage = prevMessage?.content.includes('<command-message>');
      const isCommandExpansion = !!(
        prevHasCommandMessage &&
        msg.type === 'user' &&
        msg.content.length > 500 &&
        !msg.content.includes('<command-message>')
      );

      const processedContent = isCommandExpansion
        ? `<details class="accordion"><summary>📄 コマンド展開内容（クリックで開く）</summary><div class="accordion-content">${processContent(msg.content)}</div></details>`
        : processContent(msg.content);

      return `
      <div class="message ${msg.type}">
        <div class="message-header">
          <span class="role">${msg.type === 'user' ? '👤 User' : '🤖 Claude'}</span>
          <span class="time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="message-content">${processedContent}</div>
      </div>
    `;
    })
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
    .container { max-width: 900px; margin: 0 auto; }
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
    .message-header { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; }
    .role { font-weight: 600; }
    .message.user .role { color: #2563eb; }
    .message.assistant .role { color: #16a34a; }
    .time { font-size: 0.75rem; color: #9ca3af; }
    .message-content { line-height: 1.7; }

    /* Command message styling */
    .command-message {
      margin: 0.75rem 0;
      padding: 0.75rem 1rem;
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 0 4px 4px 0;
    }
    .command-message-label {
      font-size: 0.75rem;
      color: #2563eb;
      font-weight: 500;
      margin-bottom: 0.25rem;
    }
    .command-message-content { color: #1e40af; }

    .command-name {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #f3e8ff;
      color: #7c3aed;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.875rem;
      margin: 0.25rem 0;
    }

    /* Accordion styling */
    .accordion {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin: 0.5rem 0;
      overflow: hidden;
    }
    .accordion summary {
      padding: 0.75rem 1rem;
      background: #f9fafb;
      cursor: pointer;
      font-weight: 500;
      color: #374151;
    }
    .accordion summary:hover { background: #f3f4f6; }
    .accordion-content {
      padding: 1rem;
      border-top: 1px solid #e5e7eb;
      max-height: 500px;
      overflow-y: auto;
    }

    /* Markdown styling */
    .message-content h1 { font-size: 1.5rem; font-weight: bold; margin: 1rem 0 0.5rem; }
    .message-content h2 { font-size: 1.25rem; font-weight: bold; margin: 1rem 0 0.5rem; }
    .message-content h3 { font-size: 1.1rem; font-weight: bold; margin: 0.75rem 0 0.5rem; }
    .message-content h4 { font-size: 1rem; font-weight: bold; margin: 0.5rem 0 0.25rem; }
    .message-content p { margin: 0.5rem 0; }
    .message-content ul, .message-content ol { margin: 0.5rem 0; padding-left: 1.5rem; }
    .message-content li { margin: 0.25rem 0; }
    .message-content strong { font-weight: 600; }
    .message-content em { font-style: italic; }

    .message-content code {
      background: #f3f4f6;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 0.875em;
    }
    .message-content pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0.75rem 0;
    }
    .message-content pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    .message-content blockquote {
      border-left: 4px solid #d1d5db;
      padding-left: 1rem;
      margin: 0.5rem 0;
      color: #6b7280;
    }
    .message-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.75rem 0;
    }
    .message-content th, .message-content td {
      border: 1px solid #d1d5db;
      padding: 0.5rem 0.75rem;
      text-align: left;
    }
    .message-content th { background: #f9fafb; font-weight: 600; }
    .message-content a { color: #2563eb; text-decoration: underline; }
    .message-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0; }

    /* Checkbox styling */
    .message-content input[type="checkbox"] {
      margin-right: 0.5rem;
    }

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

function processContent(content: string): string {
  // First escape HTML
  let processed = escapeHtml(content);

  // Parse escaped XML tags (they are now &lt;tag&gt;)
  processed = parseXmlTags(processed);

  // Convert markdown to HTML
  processed = markdownToHtml(processed);

  return processed;
}

function parseXmlTags(content: string): string {
  let result = content;

  // Parse &lt;command-message&gt; tags (escaped)
  result = result.replace(
    /&lt;command-message[^&]*&gt;([\s\S]*?)&lt;\/command-message&gt;/gi,
    '<div class="command-message"><div class="command-message-label">コマンドメッセージ</div><div class="command-message-content">$1</div></div>'
  );

  // Parse &lt;command-name&gt; tags
  result = result.replace(
    /&lt;command-name[^&]*&gt;([\s\S]*?)&lt;\/command-name&gt;/gi,
    '<span class="command-name">$1</span>'
  );

  // Parse &lt;command-args&gt; tags
  result = result.replace(
    /&lt;command-args[^&]*&gt;([\s\S]*?)&lt;\/command-args&gt;/gi,
    '<span class="command-args">$1</span>'
  );

  // Remove other XML-like tags that shouldn't be displayed (antml, function_results, etc.)
  result = result.replace(/&lt;antml:[^&]+&gt;[\s\S]*?&lt;\/antml:[^&]+&gt;/gi, '');
  result = result.replace(/&lt;function_results&gt;[\s\S]*?&lt;\/function_results&gt;/gi, '');
  result = result.replace(/&lt;system-reminder&gt;[\s\S]*?&lt;\/system-reminder&gt;/gi, '');

  return result;
}

function parseGfmTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line looks like a table row (starts and ends with |, or contains | between content)
    if (line.includes('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1];

      // Check if next line is a separator row (contains |, -, and optionally :)
      if (/^\|?[\s\-:|]+\|?$/.test(nextLine) && nextLine.includes('-')) {
        // This is a table! Parse it
        const tableLines: string[] = [line];
        let j = i + 1;

        // Collect all table rows
        while (j < lines.length && lines[j].includes('|')) {
          tableLines.push(lines[j]);
          j++;
        }

        // Convert to HTML table
        const tableHtml = convertTableToHtml(tableLines);
        result.push(tableHtml);
        i = j;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
}

function convertTableToHtml(lines: string[]): string {
  if (lines.length < 2) return lines.join('\n');

  const parseRow = (row: string): string[] => {
    return row
      .split('|')
      .map((cell) => cell.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || (arr.length === 2 && idx === 0));
  };

  const headerCells = parseRow(lines[0]);
  // Skip separator line (lines[1])
  const bodyRows = lines.slice(2).map(parseRow);

  let html = '<table>\n<thead>\n<tr>\n';
  headerCells.forEach((cell) => {
    html += `<th>${cell}</th>\n`;
  });
  html += '</tr>\n</thead>\n<tbody>\n';

  bodyRows.forEach((row) => {
    if (row.length > 0 && row.some((cell) => cell.length > 0)) {
      html += '<tr>\n';
      row.forEach((cell) => {
        html += `<td>${cell}</td>\n`;
      });
      html += '</tr>\n';
    }
  });

  html += '</tbody>\n</table>';
  return html;
}

function markdownToHtml(text: string): string {
  let html = text;

  // Code blocks (must be before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // GFM Tables (must be before other processing)
  html = parseGfmTables(html);

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Checkboxes
  html = html.replace(/^\s*- \[x\] (.+)$/gm, '<li><input type="checkbox" checked disabled> $1</li>');
  html = html.replace(/^\s*- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>');

  // Unordered lists
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');

  // Numbered lists
  html = html.replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Line breaks
  html = html.replace(/\n\n/g, '\n');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

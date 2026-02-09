import { getSession, getMessages, getSessionSummary, getSessionTokenStats } from './parser';
import type { ExportOptions, Session, Message, SessionSummary, SessionTokenStats } from './types';

export function exportSession(
  projectName: string,
  sessionId: string,
  options: ExportOptions
): string {
  const session = getSession(projectName, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${projectName}/${sessionId}`);
  }

  const messages = getMessages(projectName, sessionId);
  const summary = options.includeToolCalls ? getSessionSummary(projectName, sessionId) : null;
  const tokenStats = options.includeTokenStats
    ? getSessionTokenStats(projectName, sessionId)
    : null;

  switch (options.format) {
    case 'markdown':
      return exportSessionMarkdown(session, messages, summary, tokenStats);
    case 'json':
      return exportSessionJSON(session, messages, summary, tokenStats);
    case 'html':
      return exportSessionHTML(session, messages, summary, tokenStats);
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

// --- Markdown Export ---

function exportSessionMarkdown(
  session: Session,
  messages: Message[],
  summary: SessionSummary | null,
  tokenStats: SessionTokenStats | null
): string {
  const lines: string[] = [];

  // YAML front matter
  lines.push('---');
  lines.push(`title: "${escapeYaml(session.summary || 'Claude Code Session')}"`);
  lines.push(`date: "${session.lastMessageTime}"`);
  lines.push(`project: "${escapeYaml(session.projectName)}"`);
  lines.push(`session_id: "${session.id}"`);
  if (tokenStats?.model) {
    lines.push(`model: "${tokenStats.model}"`);
  }
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${session.summary || 'Claude Code Session'}`);
  lines.push('');
  lines.push(`**Project:** ${session.projectName}`);
  lines.push(`**Date:** ${formatDateISO(session.lastMessageTime)}`);
  lines.push(`**Messages:** ${messages.length}`);
  lines.push('');

  // Token stats
  if (tokenStats) {
    lines.push('## Token Usage');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Input Tokens | ${tokenStats.usage.inputTokens.toLocaleString()} |`);
    lines.push(`| Output Tokens | ${tokenStats.usage.outputTokens.toLocaleString()} |`);
    lines.push(
      `| Cache Creation | ${tokenStats.usage.cacheCreationInputTokens.toLocaleString()} |`
    );
    lines.push(`| Cache Read | ${tokenStats.usage.cacheReadInputTokens.toLocaleString()} |`);
    lines.push('');
  }

  // Summary stats
  if (summary) {
    lines.push('## Session Summary');
    lines.push('');
    lines.push(`- **Tasks:** ${summary.totalTasks}`);
    lines.push(`- **Files Read:** ${summary.stats.filesRead}`);
    lines.push(`- **Files Modified:** ${summary.stats.filesModified}`);
    lines.push(`- **Files Created:** ${summary.stats.filesCreated}`);
    lines.push(`- **Commands Run:** ${summary.stats.commandsRun}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Messages
  lines.push('## Conversation');
  lines.push('');

  for (const msg of messages) {
    const role = msg.type === 'user' ? 'User' : 'Assistant';
    const time = formatTime(msg.timestamp);
    lines.push(`### ${role} <sub>${time}</sub>`);
    lines.push('');
    lines.push(cleanContentForMarkdown(msg.content));
    lines.push('');

    // Tool calls for this message (from summary)
    if (summary && msg.type === 'assistant') {
      const toolCalls = findToolCallsForTimestamp(summary, msg.timestamp);
      if (toolCalls.length > 0) {
        lines.push('<details>');
        lines.push('<summary>Tool Calls</summary>');
        lines.push('');
        for (const tc of toolCalls) {
          lines.push(`- **${tc.name}**`);
          if (tc.input) {
            const inputStr = formatToolInput(tc.name, tc.input);
            if (inputStr) {
              lines.push(`  - ${inputStr}`);
            }
          }
        }
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// --- JSON Export ---

function exportSessionJSON(
  session: Session,
  messages: Message[],
  summary: SessionSummary | null,
  tokenStats: SessionTokenStats | null
): string {
  const data: Record<string, unknown> = {
    metadata: {
      sessionId: session.id,
      projectName: session.projectName,
      projectPath: session.projectPath,
      title: session.summary,
      firstMessageTime: session.firstMessageTime,
      lastMessageTime: session.lastMessageTime,
      messageCount: messages.length,
      exportedAt: new Date().toISOString(),
    },
    messages: messages.map((msg) => ({
      uuid: msg.uuid,
      role: msg.type,
      content: msg.content,
      timestamp: msg.timestamp,
    })),
  };

  if (summary) {
    data.summary = {
      totalTasks: summary.totalTasks,
      stats: summary.stats,
      tasks: summary.tasks.map((t) => ({
        id: t.id,
        userMessage: t.userMessage,
        timestamp: t.timestamp,
        phases: t.phases,
        filesRead: t.filesRead,
        filesModified: t.filesModified,
        filesCreated: t.filesCreated,
        commandsRun: t.commandsRun,
        toolCallCount: t.toolCalls.length,
      })),
    };
  }

  if (tokenStats) {
    data.tokenStats = {
      model: tokenStats.model,
      usage: tokenStats.usage,
    };
  }

  return JSON.stringify(data, null, 2);
}

// --- HTML Export ---

function exportSessionHTML(
  session: Session,
  messages: Message[],
  summary: SessionSummary | null,
  tokenStats: SessionTokenStats | null
): string {
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
        ? `<details class="accordion"><summary>Command Expansion (click to expand)</summary><div class="accordion-content">${processHTMLContent(msg.content)}</div></details>`
        : processHTMLContent(msg.content);

      return `
      <div class="message ${msg.type}">
        <div class="message-header">
          <span class="role">${msg.type === 'user' ? 'User' : 'Claude'}</span>
          <span class="time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="message-content">${processedContent}</div>
      </div>`;
    })
    .join('\n');

  // Stats section
  let statsHTML = '';
  if (summary || tokenStats) {
    const items: string[] = [];
    if (summary) {
      items.push(`<li>Tasks: ${summary.totalTasks}</li>`);
      items.push(`<li>Files Read: ${summary.stats.filesRead}</li>`);
      items.push(`<li>Files Modified: ${summary.stats.filesModified}</li>`);
      items.push(`<li>Commands Run: ${summary.stats.commandsRun}</li>`);
    }
    if (tokenStats) {
      items.push(`<li>Input Tokens: ${tokenStats.usage.inputTokens.toLocaleString()}</li>`);
      items.push(`<li>Output Tokens: ${tokenStats.usage.outputTokens.toLocaleString()}</li>`);
      if (tokenStats.model) {
        items.push(`<li>Model: ${escapeHTML(tokenStats.model)}</li>`);
      }
    }
    statsHTML = `
    <div class="stats">
      <h2>Session Stats</h2>
      <ul>${items.join('\n        ')}</ul>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(session.summary || 'Claude Code Session')}</title>
  <style>
    :root {
      --bg: #f9fafb; --bg-card: #ffffff; --text: #1f2937; --text-muted: #6b7280;
      --border: #e5e7eb; --accent: #3b82f6; --accent-green: #16a34a;
      --code-bg: #1e293b; --code-text: #e2e8f0; --inline-code-bg: #f3f4f6;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111827; --bg-card: #1f2937; --text: #f3f4f6; --text-muted: #9ca3af;
        --border: #374151; --accent: #60a5fa; --accent-green: #34d399;
        --code-bg: #0f172a; --code-text: #e2e8f0; --inline-code-bg: #374151;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem;
    }
    .header h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .header .meta { font-size: 0.875rem; opacity: 0.9; }
    .stats {
      background: var(--bg-card); border-radius: 12px; padding: 1.5rem;
      margin-bottom: 2rem; border: 1px solid var(--border);
    }
    .stats h2 { font-size: 1.1rem; margin-bottom: 0.75rem; }
    .stats ul { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; }
    .stats li { font-size: 0.875rem; color: var(--text-muted); }
    .messages {
      background: var(--bg-card); border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid var(--border);
    }
    .message { padding: 1.5rem; border-bottom: 1px solid var(--border); }
    .message:last-child { border-bottom: none; }
    .message-header { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; }
    .role { font-weight: 600; }
    .message.user .role { color: var(--accent); }
    .message.assistant .role { color: var(--accent-green); }
    .time { font-size: 0.75rem; color: var(--text-muted); }
    .message-content { line-height: 1.7; }

    .command-message {
      margin: 0.75rem 0; padding: 0.75rem 1rem;
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      border-left: 4px solid var(--accent); border-radius: 0 4px 4px 0;
    }
    .command-message-label { font-size: 0.75rem; color: var(--accent); font-weight: 500; margin-bottom: 0.25rem; }
    .command-name {
      display: inline-block; padding: 0.25rem 0.5rem; background: var(--inline-code-bg);
      color: #7c3aed; border-radius: 4px; font-family: monospace; font-size: 0.875rem; margin: 0.25rem 0;
    }

    .accordion { border: 1px solid var(--border); border-radius: 8px; margin: 0.5rem 0; overflow: hidden; }
    .accordion summary { padding: 0.75rem 1rem; background: var(--bg); cursor: pointer; font-weight: 500; }
    .accordion summary:hover { opacity: 0.8; }
    .accordion-content { padding: 1rem; border-top: 1px solid var(--border); max-height: 500px; overflow-y: auto; }

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
      background: var(--inline-code-bg); padding: 0.125rem 0.375rem; border-radius: 4px;
      font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.875em;
    }
    .message-content pre {
      background: var(--code-bg); color: var(--code-text); padding: 1rem;
      border-radius: 8px; overflow-x: auto; margin: 0.75rem 0;
    }
    .message-content pre code { background: none; padding: 0; color: inherit; }
    .message-content blockquote {
      border-left: 4px solid var(--border); padding-left: 1rem; margin: 0.5rem 0; color: var(--text-muted);
    }
    .message-content table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
    .message-content th, .message-content td {
      border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left;
    }
    .message-content th { background: var(--bg); font-weight: 600; }
    .message-content a { color: var(--accent); text-decoration: underline; }
    .message-content hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
    .message-content input[type="checkbox"] { margin-right: 0.5rem; }

    .footer { text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHTML(session.summary || 'Claude Code Session')}</h1>
      <div class="meta">
        <div>Project: ${escapeHTML(session.projectName)}</div>
        <div>Date: ${formatDateFull(session.lastMessageTime)}</div>
        <div>Messages: ${messages.length}</div>
      </div>
    </div>
    ${statsHTML}
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

// --- Helpers ---

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeYaml(text: string): string {
  return text.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDateISO(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().split('T')[0];
}

function formatDateFull(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cleanContentForMarkdown(content: string): string {
  let result = content;

  // Remove XML-like tags that shouldn't appear in export
  result = result.replace(/<[^>]+>[\s\S]*?<\/antml:[^>]+>/g, '');
  result = result.replace(/<function_results>[\s\S]*?<\/function_results>/g, '');
  result = result.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

  // Keep command-message as blockquote
  result = result.replace(
    /<command-message[^>]*>([\s\S]*?)<\/command-message>/g,
    '> **Command:** $1'
  );
  result = result.replace(/<command-name[^>]*>([\s\S]*?)<\/command-name>/g, '`$1`');
  result = result.replace(/<command-args[^>]*>([\s\S]*?)<\/command-args>/g, '`$1`');

  return result.trim();
}

function processHTMLContent(content: string): string {
  let processed = escapeHTML(content);
  processed = parseEscapedXmlTags(processed);
  processed = markdownToHTML(processed);
  return processed;
}

function parseEscapedXmlTags(content: string): string {
  let result = content;

  result = result.replace(
    /&lt;command-message[^&]*&gt;([\s\S]*?)&lt;\/command-message&gt;/gi,
    '<div class="command-message"><div class="command-message-label">Command</div><div class="command-message-content">$1</div></div>'
  );
  result = result.replace(
    /&lt;command-name[^&]*&gt;([\s\S]*?)&lt;\/command-name&gt;/gi,
    '<span class="command-name">$1</span>'
  );
  result = result.replace(
    /&lt;command-args[^&]*&gt;([\s\S]*?)&lt;\/command-args&gt;/gi,
    '<span class="command-args">$1</span>'
  );

  // Remove non-display tags
  result = result.replace(/&lt;antml:[^&]+&gt;[\s\S]*?&lt;\/antml:[^&]+&gt;/gi, '');
  result = result.replace(/&lt;function_results&gt;[\s\S]*?&lt;\/function_results&gt;/gi, '');
  result = result.replace(/&lt;system-reminder&gt;[\s\S]*?&lt;\/system-reminder&gt;/gi, '');

  return result;
}

function markdownToHTML(text: string): string {
  let html = text;

  // Code blocks (must be before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // GFM Tables
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
  html = html.replace(
    /^\s*- \[x\] (.+)$/gm,
    '<li><input type="checkbox" checked disabled> $1</li>'
  );
  html = html.replace(/^\s*- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>');

  // Unordered lists
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');

  // Numbered lists
  html = html.replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/\n\n/g, '\n');

  return html;
}

function parseGfmTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.includes('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (/^\|?[\s\-:|]+\|?$/.test(nextLine) && nextLine.includes('-')) {
        const tableLines: string[] = [line];
        let j = i + 1;
        while (j < lines.length && lines[j].includes('|')) {
          tableLines.push(lines[j]);
          j++;
        }
        result.push(convertTableToHTML(tableLines));
        i = j;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
}

function convertTableToHTML(lines: string[]): string {
  if (lines.length < 2) return lines.join('\n');

  const parseRow = (row: string): string[] =>
    row
      .split('|')
      .map((cell) => cell.trim())
      .filter(
        (_, idx, arr) => (idx > 0 && idx < arr.length - 1) || (arr.length === 2 && idx === 0)
      );

  const headerCells = parseRow(lines[0]);
  const bodyRows = lines.slice(2).map(parseRow);

  let html = '<table>\n<thead>\n<tr>\n';
  for (const cell of headerCells) {
    html += `<th>${cell}</th>\n`;
  }
  html += '</tr>\n</thead>\n<tbody>\n';

  for (const row of bodyRows) {
    if (row.length > 0 && row.some((cell) => cell.length > 0)) {
      html += '<tr>\n';
      for (const cell of row) {
        html += `<td>${cell}</td>\n`;
      }
      html += '</tr>\n';
    }
  }

  html += '</tbody>\n</table>';
  return html;
}

function findToolCallsForTimestamp(
  summary: SessionSummary,
  timestamp: string
): { name: string; input?: Record<string, unknown> }[] {
  for (const task of summary.tasks) {
    const calls = task.toolCalls.filter((tc) => tc.timestamp === timestamp);
    if (calls.length > 0) {
      return calls.map((tc) => ({ name: tc.name, input: tc.input }));
    }
  }
  return [];
}

function formatToolInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Read':
      return input.file_path ? `file: ${input.file_path}` : '';
    case 'Edit':
    case 'Write':
      return input.file_path ? `file: ${input.file_path}` : '';
    case 'Bash':
      return input.command ? `\`${String(input.command).slice(0, 80)}\`` : '';
    case 'Glob':
      return input.pattern ? `pattern: ${input.pattern}` : '';
    case 'Grep':
      return input.pattern ? `pattern: ${input.pattern}` : '';
    default:
      return '';
  }
}

export function getExportFilename(session: Session, format: string): string {
  const prefix = `claude-session-${session.id.slice(0, 8)}`;
  switch (format) {
    case 'markdown':
      return `${prefix}.md`;
    case 'json':
      return `${prefix}.json`;
    case 'html':
      return `${prefix}.html`;
    default:
      return `${prefix}.txt`;
  }
}

export function getExportContentType(format: string): string {
  switch (format) {
    case 'markdown':
      return 'text/markdown; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'html':
      return 'text/html; charset=utf-8';
    default:
      return 'text/plain; charset=utf-8';
  }
}

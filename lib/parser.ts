import fs from 'fs';
import path from 'path';
import type { Session, Message, RawMessage, ContentItem } from './types';

const CLAUDE_PATH = path.join(process.env.HOME || '', '.claude', 'projects');

export function getProjects(): string[] {
  if (!fs.existsSync(CLAUDE_PATH)) {
    return [];
  }
  return fs.readdirSync(CLAUDE_PATH).filter((name) => {
    const fullPath = path.join(CLAUDE_PATH, name);
    return fs.statSync(fullPath).isDirectory();
  });
}

export function getSessions(projectName: string): Session[] {
  const projectPath = path.join(CLAUDE_PATH, projectName);
  if (!fs.existsSync(projectPath)) {
    return [];
  }

  const files = fs.readdirSync(projectPath).filter(
    (f) => f.endsWith('.jsonl') && !f.startsWith('agent-')
  );

  const sessions: Session[] = [];

  for (const file of files) {
    const filePath = path.join(projectPath, file);
    const session = parseSessionFile(filePath, projectName);
    if (session) {
      sessions.push(session);
    }
  }

  // Sort by last message time (newest first)
  return sessions.sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );
}

function parseSessionFile(filePath: string, projectName: string): Session | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    let summary: string | null = null;
    let firstMessageTime: string | null = null;
    let lastMessageTime: string | null = null;
    let sessionId: string | null = null;

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as RawMessage;

        if (data.type === 'summary' && data.summary) {
          summary = data.summary;
        }

        if ((data.type === 'user' || data.type === 'assistant') && data.timestamp) {
          if (!firstMessageTime) {
            firstMessageTime = data.timestamp;
          }
          lastMessageTime = data.timestamp;

          if (!sessionId && data.uuid) {
            sessionId = data.uuid.split('-')[0];
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    if (!firstMessageTime || !lastMessageTime) {
      return null;
    }

    return {
      id: path.basename(filePath, '.jsonl'),
      projectPath: projectName,
      projectName: projectName.replace(/-/g, '/').replace(/^\//, ''),
      summary,
      firstMessageTime,
      lastMessageTime,
      filePath,
    };
  } catch {
    return null;
  }
}

export function getMessages(projectName: string, sessionId: string): Message[] {
  const filePath = path.join(CLAUDE_PATH, projectName, `${sessionId}.jsonl`);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const messages: Message[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as RawMessage;

        if (data.type === 'user' && data.message?.content && data.uuid && data.timestamp) {
          const text = extractTextContent(data.message.content);
          if (text) {
            messages.push({
              uuid: data.uuid,
              type: 'user',
              content: text,
              timestamp: data.timestamp,
            });
          }
        }

        if (data.type === 'assistant' && data.message?.content && data.uuid && data.timestamp) {
          const text = extractTextContent(data.message.content);
          if (text) {
            messages.push({
              uuid: data.uuid,
              type: 'assistant',
              content: text,
              timestamp: data.timestamp,
            });
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return messages;
  } catch {
    return [];
  }
}

function extractTextContent(content: string | ContentItem[]): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    // Only extract text type, ignore thinking, tool_use, etc.
    const textParts = content
      .filter((item): item is ContentItem => item.type === 'text' && !!item.text)
      .map((item) => item.text!);

    return textParts.join('\n');
  }

  return '';
}

export function getSession(projectName: string, sessionId: string): Session | null {
  const filePath = path.join(CLAUDE_PATH, projectName, `${sessionId}.jsonl`);
  return parseSessionFile(filePath, projectName);
}

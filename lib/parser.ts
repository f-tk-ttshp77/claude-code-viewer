import fs from 'fs';
import path from 'path';
import type { Session, Message, RawMessage, ContentItem } from './types';

function getClaudePath(): string {
  if (process.env.CLAUDE_DATA_PATH) {
    return process.env.CLAUDE_DATA_PATH;
  }
  return path.join(process.env.HOME || '', '.claude', 'projects');
}

// Cache for project path mappings
let projectPathCache: Map<string, string> | null = null;

function getProjectPathMappings(): Map<string, string> {
  if (projectPathCache) {
    return projectPathCache;
  }

  projectPathCache = new Map();
  const claudeJsonPath = path.join(process.env.HOME || '', '.claude.json');

  try {
    if (fs.existsSync(claudeJsonPath)) {
      const content = fs.readFileSync(claudeJsonPath, 'utf-8');
      const data = JSON.parse(content);

      if (data.projects && typeof data.projects === 'object') {
        for (const projectPath of Object.keys(data.projects)) {
          // Encode the project path to match directory name format
          // Claude Code encodes: / -> -, _ -> -
          const encoded = projectPath.replace(/[/_]/g, '-');
          projectPathCache.set(encoded, projectPath);
        }
      }
    }
  } catch {
    // Ignore errors reading .claude.json
  }

  return projectPathCache;
}

function decodeProjectPath(encodedName: string): string {
  const mappings = getProjectPathMappings();
  const actualPath = mappings.get(encodedName);

  if (actualPath) {
    // Remove leading slash for display
    return actualPath.replace(/^\//, '');
  }

  // Fallback: just return the encoded name as-is
  return encodedName;
}

export function getDataPathInfo(): { path: string; exists: boolean; isCustom: boolean } {
  const claudePath = getClaudePath();
  return {
    path: claudePath,
    exists: fs.existsSync(claudePath),
    isCustom: !!process.env.CLAUDE_DATA_PATH,
  };
}

export function getProjects(): string[] {
  const claudePath = getClaudePath();
  if (!fs.existsSync(claudePath)) {
    return [];
  }
  return fs.readdirSync(claudePath).filter((name) => {
    const fullPath = path.join(claudePath, name);
    return fs.statSync(fullPath).isDirectory();
  });
}

export function getSessions(projectName: string): Session[] {
  const claudePath = getClaudePath();
  const projectPath = path.join(claudePath, projectName);
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
      projectName: decodeProjectPath(projectName),
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
  const claudePath = getClaudePath();
  const filePath = path.join(claudePath, projectName, `${sessionId}.jsonl`);

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
  const claudePath = getClaudePath();
  const filePath = path.join(claudePath, projectName, `${sessionId}.jsonl`);
  return parseSessionFile(filePath, projectName);
}

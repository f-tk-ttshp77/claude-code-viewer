import fs from 'fs';
import path from 'path';
import type { Session, Message, RawMessage, ContentItem, SessionSummary, TaskSummary, TaskPhase, ToolCall } from './types';

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

// Session Summary extraction
interface RawToolUse {
  type: 'tool_use';
  name: string;
  input?: Record<string, unknown>;
}

interface RawLineData {
  type: string;
  uuid?: string;
  timestamp?: string;
  message?: {
    role: string;
    content: string | (ContentItem | RawToolUse)[];
  };
}

export function getSessionSummary(projectName: string, sessionId: string): SessionSummary | null {
  const claudePath = getClaudePath();
  const filePath = path.join(claudePath, projectName, `${sessionId}.jsonl`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    const tasks: TaskSummary[] = [];
    let currentTask: TaskSummary | null = null;
    let taskId = 0;

    // Stats tracking
    const allFilesRead = new Set<string>();
    const allFilesModified = new Set<string>();
    const allFilesCreated = new Set<string>();
    let commandsRun = 0;
    let searchCount = 0;
    let webSearchCount = 0;

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as RawLineData;

        // Detect task boundary (user message that's not a tool result)
        if (data.type === 'user' && data.message?.content && data.timestamp) {
          const textContent = extractUserText(data.message.content);

          // Skip tool results and system messages
          if (textContent && !textContent.startsWith('<function_results>') && !textContent.startsWith('<system-reminder>')) {
            // Save previous task
            if (currentTask) {
              currentTask.phases = detectPhases(currentTask.toolCalls);
              tasks.push(currentTask);
            }

            // Start new task
            taskId++;
            currentTask = {
              id: taskId,
              userMessage: truncateText(textContent, 200),
              timestamp: data.timestamp,
              phases: [],
              toolCalls: [],
              filesRead: [],
              filesModified: [],
              filesCreated: [],
              commandsRun: [],
            };
          }
        }

        // Collect tool calls from assistant messages
        if (data.type === 'assistant' && data.message?.content && data.timestamp && currentTask) {
          const toolCalls = extractToolCalls(data.message.content, data.timestamp);

          for (const tool of toolCalls) {
            currentTask.toolCalls.push(tool);

            // Categorize tool usage
            const input = tool.input || {};

            switch (tool.name) {
              case 'Read':
                if (input.file_path) {
                  const filePath = extractFileName(input.file_path as string);
                  if (!currentTask.filesRead.includes(filePath)) {
                    currentTask.filesRead.push(filePath);
                  }
                  allFilesRead.add(filePath);
                }
                break;
              case 'Edit':
                if (input.file_path) {
                  const filePath = extractFileName(input.file_path as string);
                  if (!currentTask.filesModified.includes(filePath)) {
                    currentTask.filesModified.push(filePath);
                  }
                  allFilesModified.add(filePath);
                }
                break;
              case 'Write':
                if (input.file_path) {
                  const filePath = extractFileName(input.file_path as string);
                  if (!currentTask.filesCreated.includes(filePath)) {
                    currentTask.filesCreated.push(filePath);
                  }
                  allFilesCreated.add(filePath);
                }
                break;
              case 'Bash':
                if (input.command) {
                  const cmd = truncateText(input.command as string, 50);
                  currentTask.commandsRun.push(cmd);
                  commandsRun++;
                }
                break;
              case 'Glob':
              case 'Grep':
                searchCount++;
                break;
              case 'WebSearch':
              case 'WebFetch':
                webSearchCount++;
                break;
            }
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    // Don't forget the last task
    if (currentTask) {
      currentTask.phases = detectPhases(currentTask.toolCalls);
      tasks.push(currentTask);
    }

    return {
      sessionId,
      totalTasks: tasks.length,
      tasks,
      stats: {
        filesRead: allFilesRead.size,
        filesModified: allFilesModified.size,
        filesCreated: allFilesCreated.size,
        commandsRun,
        searchCount,
        webSearchCount,
      },
    };
  } catch {
    return null;
  }
}

function extractUserText(content: string | (ContentItem | RawToolUse)[]): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const textParts = content
      .filter((item): item is ContentItem => item.type === 'text' && !!item.text)
      .map((item) => item.text!);
    return textParts.join('\n');
  }
  return '';
}

function extractToolCalls(content: string | (ContentItem | RawToolUse)[], timestamp: string): ToolCall[] {
  if (typeof content === 'string') {
    return [];
  }
  if (Array.isArray(content)) {
    return content
      .filter((item): item is RawToolUse => item.type === 'tool_use' && 'name' in item && !!item.name)
      .map((item) => ({
        name: item.name,
        input: item.input,
        timestamp,
      }));
  }
  return [];
}

function detectPhases(toolCalls: ToolCall[]): TaskPhase[] {
  const phases: TaskPhase[] = [];

  const hasInvestigation = toolCalls.some((t) =>
    ['Read', 'Glob', 'Grep', 'Task'].includes(t.name) &&
    (t.name !== 'Task' || (t.input as Record<string, unknown>)?.subagent_type === 'Explore')
  );

  const hasPlanning = toolCalls.some((t) =>
    t.name === 'TodoWrite' ||
    (t.name === 'Task' && (t.input as Record<string, unknown>)?.subagent_type === 'Plan')
  );

  const hasImplementation = toolCalls.some((t) =>
    ['Edit', 'Write'].includes(t.name)
  );

  const hasVerification = toolCalls.some((t) =>
    t.name === 'Bash' &&
    typeof (t.input as Record<string, unknown>)?.command === 'string' &&
    /(npm\s+(test|run\s+build|run\s+lint)|pytest|jest|cargo\s+test)/.test((t.input as Record<string, unknown>)?.command as string)
  );

  if (hasInvestigation) phases.push('investigation');
  if (hasPlanning) phases.push('planning');
  if (hasImplementation) phases.push('implementation');
  if (hasVerification) phases.push('verification');

  // If no phases detected, mark as immediate
  if (phases.length === 0) {
    phases.push('immediate');
  }

  return phases;
}

function extractFileName(fullPath: string): string {
  // Extract just the filename or last part of path for display
  const parts = fullPath.split('/');
  if (parts.length <= 2) {
    return fullPath;
  }
  // Return last 2 parts: e.g., "components/Toast.tsx"
  return parts.slice(-2).join('/');
}

function truncateText(text: string, maxLength: number): string {
  // Remove command-message tags and clean up
  const cleaned = text
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength) + '...';
}

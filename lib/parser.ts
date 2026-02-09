import fs from 'fs';
import path from 'path';
import type {
  Session,
  Message,
  RawMessage,
  ContentItem,
  SessionSummary,
  TaskSummary,
  TaskPhase,
  ToolCall,
  TokenUsage,
  SessionTokenStats,
  DailyTokenStats,
  TokenAnalytics,
} from './types';

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

  const files = fs
    .readdirSync(projectPath)
    .filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'));

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
          if (
            textContent &&
            !textContent.startsWith('<function_results>') &&
            !textContent.startsWith('<system-reminder>')
          ) {
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

function extractToolCalls(
  content: string | (ContentItem | RawToolUse)[],
  timestamp: string
): ToolCall[] {
  if (typeof content === 'string') {
    return [];
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (item): item is RawToolUse => item.type === 'tool_use' && 'name' in item && !!item.name
      )
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

  const hasInvestigation = toolCalls.some(
    (t) =>
      ['Read', 'Glob', 'Grep', 'Task'].includes(t.name) &&
      (t.name !== 'Task' || (t.input as Record<string, unknown>)?.subagent_type === 'Explore')
  );

  const hasPlanning = toolCalls.some(
    (t) =>
      t.name === 'TodoWrite' ||
      (t.name === 'Task' && (t.input as Record<string, unknown>)?.subagent_type === 'Plan')
  );

  const hasImplementation = toolCalls.some((t) => ['Edit', 'Write'].includes(t.name));

  const hasVerification = toolCalls.some(
    (t) =>
      t.name === 'Bash' &&
      typeof (t.input as Record<string, unknown>)?.command === 'string' &&
      /(npm\s+(test|run\s+build|run\s+lint)|pytest|jest|cargo\s+test)/.test(
        (t.input as Record<string, unknown>)?.command as string
      )
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

// Token Usage extraction
interface RawMessageWithUsage {
  type: string;
  timestamp?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

export function getSessionTokenStats(
  projectName: string,
  sessionId: string
): SessionTokenStats | null {
  const claudePath = getClaudePath();
  const filePath = path.join(claudePath, projectName, `${sessionId}.jsonl`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheCreation = 0;
    let totalCacheRead = 0;
    let firstTimestamp: string | null = null;
    let model: string | undefined;

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as RawMessageWithUsage;

        if (data.type === 'assistant' && data.message?.usage) {
          const usage = data.message.usage;
          totalInputTokens += usage.input_tokens || 0;
          totalOutputTokens += usage.output_tokens || 0;
          totalCacheCreation += usage.cache_creation_input_tokens || 0;
          totalCacheRead += usage.cache_read_input_tokens || 0;

          if (!model && data.message.model) {
            model = data.message.model;
          }
        }

        if (data.timestamp && !firstTimestamp) {
          firstTimestamp = data.timestamp;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return {
      sessionId,
      projectName: decodeProjectPath(projectName),
      projectPath: projectName,
      timestamp: firstTimestamp || new Date().toISOString(),
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheCreationInputTokens: totalCacheCreation,
        cacheReadInputTokens: totalCacheRead,
      },
      model,
    };
  } catch {
    return null;
  }
}

export function getAllTokenStats(): SessionTokenStats[] {
  const projects = getProjects();
  const allStats: SessionTokenStats[] = [];

  for (const projectName of projects) {
    const claudePath = getClaudePath();
    const projectPath = path.join(claudePath, projectName);

    if (!fs.existsSync(projectPath)) continue;

    const files = fs
      .readdirSync(projectPath)
      .filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    for (const file of files) {
      const sessionId = path.basename(file, '.jsonl');
      const stats = getSessionTokenStats(projectName, sessionId);
      if (stats && (stats.usage.inputTokens > 0 || stats.usage.outputTokens > 0)) {
        allStats.push(stats);
      }
    }
  }

  // Sort by timestamp (newest first)
  return allStats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getTokenAnalytics(days: number = 30): TokenAnalytics {
  const allStats = getAllTokenStats();
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);
  periodStart.setHours(0, 0, 0, 0);

  // Filter stats within the period
  const filteredStats = allStats.filter((stat) => {
    const statDate = new Date(stat.timestamp);
    return statDate >= periodStart && statDate <= now;
  });

  // Calculate total usage
  const totalUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };

  for (const stat of filteredStats) {
    totalUsage.inputTokens += stat.usage.inputTokens;
    totalUsage.outputTokens += stat.usage.outputTokens;
    totalUsage.cacheCreationInputTokens += stat.usage.cacheCreationInputTokens;
    totalUsage.cacheReadInputTokens += stat.usage.cacheReadInputTokens;
  }

  // Group by day
  const dailyMap = new Map<string, { usage: TokenUsage; sessionCount: number }>();

  for (const stat of filteredStats) {
    const date = new Date(stat.timestamp).toISOString().split('T')[0];

    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
        sessionCount: 0,
      });
    }

    const daily = dailyMap.get(date)!;
    daily.usage.inputTokens += stat.usage.inputTokens;
    daily.usage.outputTokens += stat.usage.outputTokens;
    daily.usage.cacheCreationInputTokens += stat.usage.cacheCreationInputTokens;
    daily.usage.cacheReadInputTokens += stat.usage.cacheReadInputTokens;
    daily.sessionCount++;
  }

  // Convert to array and sort by date
  const dailyStats: DailyTokenStats[] = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      usage: data.usage,
      sessionCount: data.sessionCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalUsage,
    dailyStats,
    sessionStats: filteredStats,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
  };
}

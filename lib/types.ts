export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  summary: string | null;
  firstMessageTime: string;
  lastMessageTime: string;
  filePath: string;
}

export interface Message {
  uuid: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface RawMessage {
  type: string;
  uuid?: string;
  timestamp?: string;
  message?: {
    role: string;
    content: string | ContentItem[];
  };
  summary?: string;
}

export interface ContentItem {
  type: string;
  text?: string;
  thinking?: string;
}

// Session Summary types
export interface ToolCall {
  name: string;
  input?: Record<string, unknown>;
  timestamp: string;
}

export type TaskPhase = 'investigation' | 'planning' | 'implementation' | 'verification' | 'immediate';

export interface TaskSummary {
  id: number;
  userMessage: string;
  timestamp: string;
  phases: TaskPhase[];
  toolCalls: ToolCall[];
  filesRead: string[];
  filesModified: string[];
  filesCreated: string[];
  commandsRun: string[];
}

export interface SessionSummary {
  sessionId: string;
  totalTasks: number;
  tasks: TaskSummary[];
  stats: {
    filesRead: number;
    filesModified: number;
    filesCreated: number;
    commandsRun: number;
    searchCount: number;
    webSearchCount: number;
  };
}

// Token Usage types
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface SessionTokenStats {
  sessionId: string;
  projectName: string;
  projectPath: string;
  timestamp: string;
  usage: TokenUsage;
  model?: string;
}

export interface DailyTokenStats {
  date: string;
  usage: TokenUsage;
  sessionCount: number;
}

export interface TokenAnalytics {
  totalUsage: TokenUsage;
  dailyStats: DailyTokenStats[];
  sessionStats: SessionTokenStats[];
  periodStart: string;
  periodEnd: string;
}

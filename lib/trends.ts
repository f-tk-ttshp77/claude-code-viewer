import fs from 'fs';
import path from 'path';
import { getProjects } from './parser';
import type {
  ContentItem,
  TrendData,
  TimeSeriesPoint,
  ProjectActivity,
  ToolDistribution,
  ActivityHeatmapCell,
} from './types';

// ---------- JSONL raw types (local to this module) ----------

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
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
}

// ---------- Per-session extracted data ----------

interface SessionExtract {
  timestamp: string; // first timestamp in the session
  projectName: string; // decoded project name
  toolCounts: Map<string, number>; // tool name -> call count
  taskCount: number; // number of user-initiated tasks
  filesModifiedCount: number; // unique files edited/written
  totalInputTokens: number;
  totalOutputTokens: number;
  editWriteCount: number; // total Edit + Write calls
}

// ---------- Helpers ----------

function getClaudePath(): string {
  if (process.env.CLAUDE_DATA_PATH) {
    return process.env.CLAUDE_DATA_PATH;
  }
  return path.join(process.env.HOME || '', '.claude', 'projects');
}

// Cache for project path mappings
let projectPathCache: Map<string, string> | null = null;

function getProjectPathMappings(): Map<string, string> {
  if (projectPathCache) return projectPathCache;

  projectPathCache = new Map();
  const claudeJsonPath = path.join(process.env.HOME || '', '.claude.json');

  try {
    if (fs.existsSync(claudeJsonPath)) {
      const content = fs.readFileSync(claudeJsonPath, 'utf-8');
      const data = JSON.parse(content);
      if (data.projects && typeof data.projects === 'object') {
        for (const projectPath of Object.keys(data.projects)) {
          const encoded = projectPath.replace(/[/_]/g, '-');
          projectPathCache.set(encoded, projectPath);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return projectPathCache;
}

function decodeProjectPath(encodedName: string): string {
  const mappings = getProjectPathMappings();
  const actualPath = mappings.get(encodedName);
  if (actualPath) return actualPath.replace(/^\//, '');
  return encodedName;
}

function extractUserText(content: string | (ContentItem | RawToolUse)[]): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((item): item is ContentItem => item.type === 'text' && !!item.text)
      .map((item) => item.text!)
      .join('\n');
  }
  return '';
}

function isUserMessage(text: string): boolean {
  return (
    !!text &&
    !text.startsWith('<function_results>') &&
    !text.startsWith('<system-reminder>') &&
    !text.startsWith('<tool_result')
  );
}

// ---------- Session analyser ----------

function extractSession(filePath: string, projectName: string): SessionExtract | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    const extract: SessionExtract = {
      timestamp: '',
      projectName: decodeProjectPath(projectName),
      toolCounts: new Map(),
      taskCount: 0,
      filesModifiedCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      editWriteCount: 0,
    };

    const modifiedFiles = new Set<string>();

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as RawLineData;

        // Track first timestamp
        if (data.timestamp && !extract.timestamp) {
          extract.timestamp = data.timestamp;
        }

        // Count user-initiated tasks
        if (data.type === 'user' && data.message?.content) {
          const text = extractUserText(data.message.content);
          if (isUserMessage(text)) {
            extract.taskCount++;
          }
        }

        // Assistant messages: token usage + tool calls
        if (data.type === 'assistant' && data.message?.content) {
          // Token usage
          if (data.message.usage) {
            extract.totalInputTokens += data.message.usage.input_tokens || 0;
            extract.totalOutputTokens += data.message.usage.output_tokens || 0;
          }

          // Tool calls
          if (Array.isArray(data.message.content)) {
            for (const item of data.message.content) {
              if (item.type === 'tool_use' && 'name' in item) {
                const tool = item as RawToolUse;
                extract.toolCounts.set(tool.name, (extract.toolCounts.get(tool.name) || 0) + 1);

                if (tool.name === 'Edit' || tool.name === 'Write') {
                  extract.editWriteCount++;
                  const fp = (tool.input?.file_path as string) || '';
                  if (fp) modifiedFiles.add(fp);
                }
              }
            }
          }
        }
      } catch {
        // Skip invalid lines
      }
    }

    extract.filesModifiedCount = modifiedFiles.size;

    if (!extract.timestamp) return null;
    return extract;
  } catch {
    return null;
  }
}

// ---------- Aggregation helpers ----------

/** Get ISO date string (YYYY-MM-DD) from a date */
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Get the Monday of the week containing the given date */
function getWeekStart(d: Date): string {
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust for Monday
  const monday = new Date(d);
  monday.setDate(diff);
  return toDateStr(monday);
}

// ---------- Public API ----------

export function getTrends(days: number = 90): TrendData {
  const claudePath = getClaudePath();
  const projects = getProjects();

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);
  periodStart.setHours(0, 0, 0, 0);

  // Collect all session extracts
  const sessions: SessionExtract[] = [];

  for (const projectName of projects) {
    const projectPath = path.join(claudePath, projectName);
    if (!fs.existsSync(projectPath)) continue;

    let files: string[];
    try {
      files = fs
        .readdirSync(projectPath)
        .filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(projectPath, file);
      const extract = extractSession(filePath, projectName);
      if (!extract) continue;

      // Date filter
      const sessionDate = new Date(extract.timestamp);
      if (sessionDate < periodStart) continue;

      sessions.push(extract);
    }
  }

  // If no sessions, return empty TrendData
  if (sessions.length === 0) {
    return {
      period: { from: toDateStr(periodStart), to: toDateStr(now), days },
      sessionTimeSeries: [],
      projectBreakdown: [],
      toolDistribution: [],
      activityHeatmap: [],
      complexityTrend: [],
      tokenEfficiencyTrend: [],
      totalSessions: 0,
      totalTokens: 0,
    };
  }

  // Sort sessions by timestamp
  sessions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // ---- 1. Session time series (weekly aggregation) ----
  const weeklySessionMap = new Map<string, number>();
  for (const s of sessions) {
    const weekStart = getWeekStart(new Date(s.timestamp));
    weeklySessionMap.set(weekStart, (weeklySessionMap.get(weekStart) || 0) + 1);
  }
  const sessionTimeSeries: TimeSeriesPoint[] = Array.from(weeklySessionMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- 2. Project breakdown ----
  const projectMap = new Map<string, { sessionCount: number; totalTokens: number }>();
  for (const s of sessions) {
    const existing = projectMap.get(s.projectName);
    const tokens = s.totalInputTokens + s.totalOutputTokens;
    if (existing) {
      existing.sessionCount++;
      existing.totalTokens += tokens;
    } else {
      projectMap.set(s.projectName, { sessionCount: 1, totalTokens: tokens });
    }
  }
  const projectBreakdown: ProjectActivity[] = Array.from(projectMap.entries())
    .map(([projectName, data]) => ({
      projectName,
      sessionCount: data.sessionCount,
      totalTokens: data.totalTokens,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  // ---- 3. Tool distribution ----
  const globalToolCounts = new Map<string, number>();
  for (const s of sessions) {
    for (const [name, count] of s.toolCounts) {
      globalToolCounts.set(name, (globalToolCounts.get(name) || 0) + count);
    }
  }
  const totalToolCalls = Array.from(globalToolCounts.values()).reduce((a, b) => a + b, 0);
  const toolDistribution: ToolDistribution[] = Array.from(globalToolCounts.entries())
    .map(([toolName, count]) => ({
      toolName,
      count,
      percentage: totalToolCalls === 0 ? 0 : Math.round((count / totalToolCalls) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  // ---- 4. Activity heatmap (dayOfWeek x hour) ----
  const heatmapGrid = new Map<string, number>(); // "dayOfWeek-hour" -> count
  for (const s of sessions) {
    const d = new Date(s.timestamp);
    const key = `${d.getDay()}-${d.getHours()}`;
    heatmapGrid.set(key, (heatmapGrid.get(key) || 0) + 1);
  }
  const activityHeatmap: ActivityHeatmapCell[] = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = heatmapGrid.get(`${dayOfWeek}-${hour}`) || 0;
      if (count > 0) {
        activityHeatmap.push({ dayOfWeek, hour, count });
      }
    }
  }

  // ---- 5. Complexity trend (weekly: average taskCount + filesModifiedCount per session) ----
  const weeklyComplexityMap = new Map<string, { totalComplexity: number; sessionCount: number }>();
  for (const s of sessions) {
    const weekStart = getWeekStart(new Date(s.timestamp));
    const complexity = s.taskCount + s.filesModifiedCount;
    const existing = weeklyComplexityMap.get(weekStart);
    if (existing) {
      existing.totalComplexity += complexity;
      existing.sessionCount++;
    } else {
      weeklyComplexityMap.set(weekStart, { totalComplexity: complexity, sessionCount: 1 });
    }
  }
  const complexityTrend: TimeSeriesPoint[] = Array.from(weeklyComplexityMap.entries())
    .map(([date, data]) => ({
      date,
      value: Math.round((data.totalComplexity / data.sessionCount) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- 6. Token efficiency trend (weekly: editWriteCount / (tokens / 100k)) ----
  const weeklyEfficiencyMap = new Map<string, { totalEditWrite: number; totalTokens: number }>();
  for (const s of sessions) {
    const weekStart = getWeekStart(new Date(s.timestamp));
    const tokens = s.totalInputTokens + s.totalOutputTokens;
    const existing = weeklyEfficiencyMap.get(weekStart);
    if (existing) {
      existing.totalEditWrite += s.editWriteCount;
      existing.totalTokens += tokens;
    } else {
      weeklyEfficiencyMap.set(weekStart, {
        totalEditWrite: s.editWriteCount,
        totalTokens: tokens,
      });
    }
  }
  const tokenEfficiencyTrend: TimeSeriesPoint[] = Array.from(weeklyEfficiencyMap.entries())
    .map(([date, data]) => {
      const per100k = data.totalTokens / 100000;
      const efficiency = per100k === 0 ? 0 : Math.round((data.totalEditWrite / per100k) * 10) / 10;
      return { date, value: efficiency };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- Totals ----
  const totalTokens = sessions.reduce(
    (sum, s) => sum + s.totalInputTokens + s.totalOutputTokens,
    0
  );

  return {
    period: { from: toDateStr(periodStart), to: toDateStr(now), days },
    sessionTimeSeries,
    projectBreakdown,
    toolDistribution,
    activityHeatmap,
    complexityTrend,
    tokenEfficiencyTrend,
    totalSessions: sessions.length,
    totalTokens,
  };
}

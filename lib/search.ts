import fs from 'fs';
import path from 'path';
import { getProjects } from './parser';
import type { SearchQuery, SearchMatch, SearchResult, ContentItem } from './types';

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
  };
}

// ---------- Helpers ----------

function getClaudePath(): string {
  if (process.env.CLAUDE_DATA_PATH) {
    return process.env.CLAUDE_DATA_PATH;
  }
  return path.join(process.env.HOME || '', '.claude', 'projects');
}

// Cache for project path mappings (same logic as parser.ts)
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
    return actualPath.replace(/^\//, '');
  }
  return encodedName;
}

function extractTextContent(content: string | (ContentItem | RawToolUse)[]): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((item): item is ContentItem => item.type === 'text' && !!item.text)
      .map((item) => item.text!)
      .join('\n');
  }
  return '';
}

function extractToolNames(content: string | (ContentItem | RawToolUse)[]): string[] {
  if (typeof content === 'string') return [];
  if (Array.isArray(content)) {
    return content
      .filter(
        (item): item is RawToolUse => item.type === 'tool_use' && 'name' in item && !!item.name
      )
      .map((item) => item.name);
  }
  return [];
}

/**
 * Generate a snippet around a match position with surrounding context.
 * Returns ~50 chars before and after the match.
 */
function generateSnippet(text: string, matchStart: number, matchLength: number): string {
  const contextChars = 50;
  const snippetStart = Math.max(0, matchStart - contextChars);
  const snippetEnd = Math.min(text.length, matchStart + matchLength + contextChars);

  let snippet = text.slice(snippetStart, snippetEnd);

  // Clean up whitespace
  snippet = snippet.replace(/\s+/g, ' ');

  // Add ellipsis if truncated
  if (snippetStart > 0) {
    snippet = '...' + snippet;
  }
  if (snippetEnd < text.length) {
    snippet = snippet + '...';
  }

  return snippet;
}

// ---------- Main search function ----------

const MAX_MATCHES_PER_SESSION = 10;

export function searchSessions(query: SearchQuery): SearchResult[] {
  if (!query.query.trim()) {
    return [];
  }

  const claudePath = getClaudePath();
  const projects = getProjects();
  const results: SearchResult[] = [];

  const searchTermLower = query.query.toLowerCase();

  // Date range filter
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  const dateTo = query.dateTo ? new Date(query.dateTo) : null;
  if (dateTo) {
    // Include the entire "dateTo" day
    dateTo.setHours(23, 59, 59, 999);
  }

  for (const projectName of projects) {
    // Project filter
    if (query.projectFilter) {
      const decodedName = decodeProjectPath(projectName);
      if (
        projectName !== query.projectFilter &&
        decodedName !== query.projectFilter &&
        !decodedName.toLowerCase().includes(query.projectFilter.toLowerCase()) &&
        !projectName.toLowerCase().includes(query.projectFilter.toLowerCase())
      ) {
        continue;
      }
    }

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
      const sessionId = path.basename(file, '.jsonl');

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        const matches: SearchMatch[] = [];
        let sessionTimestamp = '';
        let sessionHasToolFilter = !query.toolFilter;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          if (matches.length >= MAX_MATCHES_PER_SESSION) break;

          try {
            const data = JSON.parse(lines[lineIndex]) as RawLineData;

            // Track session timestamp (first message)
            if (data.timestamp && !sessionTimestamp) {
              sessionTimestamp = data.timestamp;
            }

            // Tool filter: check if any assistant message in this session uses the specified tool
            if (
              query.toolFilter &&
              !sessionHasToolFilter &&
              data.type === 'assistant' &&
              data.message?.content
            ) {
              const toolNames = extractToolNames(data.message.content);
              if (
                toolNames.some((name) => name.toLowerCase() === query.toolFilter!.toLowerCase())
              ) {
                sessionHasToolFilter = true;
              }
            }

            // Search in user and assistant messages
            if (
              (data.type === 'user' || data.type === 'assistant') &&
              data.message?.content &&
              data.timestamp
            ) {
              const text = extractTextContent(data.message.content);
              if (!text) continue;

              const textLower = text.toLowerCase();
              let searchPos = 0;

              while (searchPos < textLower.length && matches.length < MAX_MATCHES_PER_SESSION) {
                const matchIndex = textLower.indexOf(searchTermLower, searchPos);
                if (matchIndex === -1) break;

                matches.push({
                  messageRole: data.type as 'user' | 'assistant',
                  snippet: generateSnippet(text, matchIndex, query.query.length),
                  timestamp: data.timestamp,
                  lineIndex,
                });

                // Move past this match to find the next one
                searchPos = matchIndex + searchTermLower.length;
              }
            }
          } catch {
            // Skip invalid JSON lines
          }
        }

        // Apply date filter on session timestamp
        if (sessionTimestamp && (dateFrom || dateTo)) {
          const sessionDate = new Date(sessionTimestamp);
          if (dateFrom && sessionDate < dateFrom) continue;
          if (dateTo && sessionDate > dateTo) continue;
        }

        // Apply tool filter
        if (query.toolFilter && !sessionHasToolFilter) continue;

        if (matches.length > 0) {
          results.push({
            sessionId,
            projectName: decodeProjectPath(projectName),
            sessionTimestamp,
            matches,
            totalMatches: matches.length,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Sort by total matches (descending)
  results.sort((a, b) => b.totalMatches - a.totalMatches);

  return results;
}

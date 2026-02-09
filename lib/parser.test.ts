import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Stats } from 'fs';

// Mock fs module before importing parser
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

import fs from 'fs';
import {
  getProjects,
  getMessages,
  getSession,
  getSessionSummary,
  getSessionTokenStats,
} from './parser';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);
const mockStatSync = vi.mocked(fs.statSync);

beforeEach(() => {
  vi.resetAllMocks();
  // Set a known HOME for deterministic paths
  process.env.HOME = '/home/testuser';
  delete process.env.CLAUDE_DATA_PATH;
});

// ==============================
// getProjects
// ==============================
describe('getProjects', () => {
  it('returns project directory names when path exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['proj-a', 'proj-b'] as unknown as ReturnType<
      typeof fs.readdirSync
    >);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as Stats);

    const result = getProjects();
    expect(result).toEqual(['proj-a', 'proj-b']);
  });

  it('returns empty array when claude path does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = getProjects();
    expect(result).toEqual([]);
  });

  it('filters out non-directory entries', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['proj-a', 'file.txt'] as unknown as ReturnType<
      typeof fs.readdirSync
    >);
    mockStatSync
      .mockReturnValueOnce({ isDirectory: () => true } as Stats)
      .mockReturnValueOnce({ isDirectory: () => false } as Stats);

    const result = getProjects();
    expect(result).toEqual(['proj-a']);
  });
});

// ==============================
// getMessages
// ==============================
describe('getMessages', () => {
  it('rejects path traversal in projectName', () => {
    const result = getMessages('../..', 'session-id');
    expect(result).toEqual([]);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('rejects path traversal in sessionId', () => {
    const result = getMessages('valid-project', '../../etc/passwd');
    expect(result).toEqual([]);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('returns empty array when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = getMessages('valid-project', 'nonexistent-session');
    expect(result).toEqual([]);
  });

  it('parses a simple session JSONL and extracts messages', () => {
    const jsonlContent = [
      '{"type":"summary","summary":"Test session"}',
      '{"type":"user","uuid":"user-001","timestamp":"2025-01-15T10:00:00Z","message":{"role":"user","content":"Fix the bug"}}',
      '{"type":"assistant","uuid":"asst-001","timestamp":"2025-01-15T10:01:00Z","message":{"role":"assistant","content":"I will fix it."}}',
    ].join('\n');

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(jsonlContent);

    const messages = getMessages('test-project', 'test-session');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      uuid: 'user-001',
      type: 'user',
      content: 'Fix the bug',
      timestamp: '2025-01-15T10:00:00Z',
    });
    expect(messages[1]).toEqual({
      uuid: 'asst-001',
      type: 'assistant',
      content: 'I will fix it.',
      timestamp: '2025-01-15T10:01:00Z',
    });
  });

  it('extracts text from ContentItem arrays', () => {
    const jsonlContent = [
      '{"type":"assistant","uuid":"asst-001","timestamp":"2025-01-15T10:01:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello"},{"type":"tool_use","name":"Read","id":"t1","input":{}},{"type":"text","text":"World"}]}}',
    ].join('\n');

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(jsonlContent);

    const messages = getMessages('test-project', 'test-session');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello\nWorld');
  });

  it('skips malformed JSON lines gracefully', () => {
    const jsonlContent = [
      '{"type":"user","uuid":"user-001","timestamp":"2025-01-15T10:00:00Z","message":{"role":"user","content":"test"}}',
      'this is not valid json',
      '{"type":"assistant","uuid":"asst-001","timestamp":"2025-01-15T10:01:00Z","message":{"role":"assistant","content":"response"}}',
    ].join('\n');

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(jsonlContent);

    const messages = getMessages('test-project', 'test-session');
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('test');
    expect(messages[1].content).toBe('response');
  });
});

// ==============================
// getSession
// ==============================
describe('getSession', () => {
  it('rejects path traversal', () => {
    const result = getSession('../evil', 'session-id');
    expect(result).toBeNull();
  });

  it('returns null when session file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = getSession('valid-project', 'nonexistent');
    expect(result).toBeNull();
  });

  it('parses a valid session file into a Session object', () => {
    const jsonlContent = [
      '{"type":"summary","summary":"My summary"}',
      '{"type":"user","uuid":"user-001","timestamp":"2025-01-15T10:00:00Z","message":{"role":"user","content":"hello"}}',
      '{"type":"assistant","uuid":"asst-001","timestamp":"2025-01-15T10:05:00Z","message":{"role":"assistant","content":"hi"}}',
    ].join('\n');

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(jsonlContent);

    const session = getSession('test-project', 'test-session');
    expect(session).not.toBeNull();
    expect(session!.id).toBe('test-session');
    expect(session!.summary).toBe('My summary');
    expect(session!.firstMessageTime).toBe('2025-01-15T10:00:00Z');
    expect(session!.lastMessageTime).toBe('2025-01-15T10:05:00Z');
  });

  it('returns null for a session with only a summary line (no messages)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"type":"summary","summary":"Empty"}');

    const session = getSession('test-project', 'empty-session');
    expect(session).toBeNull();
  });
});

// ==============================
// getSessionSummary
// ==============================
describe('getSessionSummary', () => {
  it('rejects path traversal', () => {
    const result = getSessionSummary('../evil', 'session');
    expect(result).toBeNull();
  });

  it('returns null when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(getSessionSummary('proj', 'missing')).toBeNull();
  });

  it('extracts tasks and tool calls from a session', () => {
    const jsonlContent = [
      '{"type":"user","uuid":"u1","timestamp":"2025-01-15T10:00:00Z","message":{"role":"user","content":"Implement feature"}}',
      '{"type":"assistant","uuid":"a1","timestamp":"2025-01-15T10:01:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Working on it."},{"type":"tool_use","name":"Read","id":"t1","input":{"file_path":"/src/lib/parser.ts"}},{"type":"tool_use","name":"Edit","id":"t2","input":{"file_path":"/src/components/App.tsx","old_string":"old","new_string":"new"}},{"type":"tool_use","name":"Bash","id":"t3","input":{"command":"npm test"}}]}}',
    ].join('\n');

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(jsonlContent);

    const summary = getSessionSummary('proj', 'sess');
    expect(summary).not.toBeNull();
    expect(summary!.totalTasks).toBe(1);
    expect(summary!.tasks[0].userMessage).toBe('Implement feature');
    expect(summary!.stats.filesRead).toBe(1);
    expect(summary!.stats.filesModified).toBe(1);
    expect(summary!.stats.commandsRun).toBe(1);

    // Phase detection: Read = investigation, Edit = implementation, Bash npm test = verification
    expect(summary!.tasks[0].phases).toContain('investigation');
    expect(summary!.tasks[0].phases).toContain('implementation');
    expect(summary!.tasks[0].phases).toContain('verification');
  });

  it('detects multiple tasks (one per user message)', () => {
    const jsonlContent = [
      '{"type":"user","uuid":"u1","timestamp":"2025-01-15T10:00:00Z","message":{"role":"user","content":"First task"}}',
      '{"type":"assistant","uuid":"a1","timestamp":"2025-01-15T10:01:00Z","message":{"role":"assistant","content":"Done"}}',
      '{"type":"user","uuid":"u2","timestamp":"2025-01-15T10:02:00Z","message":{"role":"user","content":"Second task"}}',
      '{"type":"assistant","uuid":"a2","timestamp":"2025-01-15T10:03:00Z","message":{"role":"assistant","content":"Done again"}}',
    ].join('\n');

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(jsonlContent);

    const summary = getSessionSummary('proj', 'sess');
    expect(summary!.totalTasks).toBe(2);
    expect(summary!.tasks[0].userMessage).toBe('First task');
    expect(summary!.tasks[1].userMessage).toBe('Second task');
  });
});

// ==============================
// getSessionTokenStats
// ==============================
describe('getSessionTokenStats', () => {
  it('rejects path traversal', () => {
    const result = getSessionTokenStats('../evil', 'session');
    expect(result).toBeNull();
  });

  it('returns null when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(getSessionTokenStats('proj', 'missing')).toBeNull();
  });

  it('aggregates token usage from assistant messages', () => {
    const jsonlContent = [
      '{"type":"user","uuid":"u1","timestamp":"2025-01-15T10:00:00Z","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","timestamp":"2025-01-15T10:01:00Z","message":{"role":"assistant","model":"claude-sonnet-4-5-20250514","content":"hello","usage":{"input_tokens":1000,"output_tokens":200,"cache_creation_input_tokens":50,"cache_read_input_tokens":30}}}',
      '{"type":"assistant","uuid":"a2","timestamp":"2025-01-15T10:02:00Z","message":{"role":"assistant","model":"claude-sonnet-4-5-20250514","content":"more","usage":{"input_tokens":500,"output_tokens":100,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    ].join('\n');

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(jsonlContent);

    const stats = getSessionTokenStats('proj', 'sess');
    expect(stats).not.toBeNull();
    expect(stats!.usage.inputTokens).toBe(1500);
    expect(stats!.usage.outputTokens).toBe(300);
    expect(stats!.usage.cacheCreationInputTokens).toBe(50);
    expect(stats!.usage.cacheReadInputTokens).toBe(30);
    expect(stats!.model).toBe('claude-sonnet-4-5-20250514');
    expect(stats!.sessionId).toBe('sess');
    expect(stats!.timestamp).toBe('2025-01-15T10:00:00Z');
  });

  it('returns zero usage when assistant messages have no usage field', () => {
    const jsonlContent = [
      '{"type":"user","uuid":"u1","timestamp":"2025-01-15T10:00:00Z","message":{"role":"user","content":"hi"}}',
      '{"type":"assistant","uuid":"a1","timestamp":"2025-01-15T10:01:00Z","message":{"role":"assistant","content":"hello"}}',
    ].join('\n');

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(jsonlContent);

    const stats = getSessionTokenStats('proj', 'sess');
    expect(stats).not.toBeNull();
    expect(stats!.usage.inputTokens).toBe(0);
    expect(stats!.usage.outputTokens).toBe(0);
    expect(stats!.usage.cacheCreationInputTokens).toBe(0);
    expect(stats!.usage.cacheReadInputTokens).toBe(0);
    expect(stats!.model).toBeUndefined();
  });
});

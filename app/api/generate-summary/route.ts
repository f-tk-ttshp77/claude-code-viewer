import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { getSessionSummary } from '@/lib/parser';

const anthropic = new Anthropic();

// Cache directory for AI summaries
const CACHE_DIR = path.join(process.cwd(), '.cache', 'summaries');

interface AISummary {
  sessionSummary: string;
  taskSummaries: { id: number; summary: string }[];
  generatedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { projectName, sessionId } = await request.json();

    if (!projectName || !sessionId) {
      return NextResponse.json({ error: 'Missing projectName or sessionId' }, { status: 400 });
    }

    // Check cache first
    const cached = loadFromCache(projectName, sessionId);
    if (cached) {
      return NextResponse.json({ summary: cached, fromCache: true });
    }

    // Get structured summary data
    const structuredSummary = getSessionSummary(projectName, sessionId);
    if (!structuredSummary) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Build prompt for Claude
    const prompt = buildPrompt(structuredSummary);

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Parse the response
    const aiSummary = parseResponse(responseText, structuredSummary.tasks.length);

    // Save to cache
    saveToCache(projectName, sessionId, aiSummary);

    return NextResponse.json({ summary: aiSummary, fromCache: false });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}

function buildPrompt(summary: ReturnType<typeof getSessionSummary>): string {
  if (!summary) return '';

  const taskDescriptions = summary.tasks
    .map((task, i) => {
      const phases = task.phases.join(' → ');
      const files = [
        ...task.filesRead.map((f) => `読込: ${f}`),
        ...task.filesModified.map((f) => `変更: ${f}`),
        ...task.filesCreated.map((f) => `作成: ${f}`),
      ].join(', ');
      const commands = task.commandsRun.join(', ');

      return `タスク${i + 1}: "${task.userMessage}"
  フェーズ: ${phases}
  ファイル: ${files || 'なし'}
  コマンド: ${commands || 'なし'}`;
    })
    .join('\n\n');

  return `以下はClaude Codeセッションの構造化データです。これを元に要約を生成してください。

## セッション統計
- 読んだファイル: ${summary.stats.filesRead}件
- 変更したファイル: ${summary.stats.filesModified}件
- 作成したファイル: ${summary.stats.filesCreated}件
- 実行コマンド: ${summary.stats.commandsRun}回

## タスク一覧
${taskDescriptions}

## 出力形式
以下の形式で出力してください：

SESSION_SUMMARY:
（セッション全体の1-2文の要約）

TASK_1:
（タスク1の1文要約）

TASK_2:
（タスク2の1文要約）
...

注意：
- 日本語で簡潔に
- 技術的な内容を正確に
- 各タスクは1文で`;
}

function parseResponse(response: string, taskCount: number): AISummary {
  const lines = response.split('\n');
  let sessionSummary = '';
  const taskSummaries: { id: number; summary: string }[] = [];

  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('SESSION_SUMMARY:')) {
      if (currentSection && currentContent.length > 0) {
        processSection(currentSection, currentContent.join(' ').trim(), taskSummaries);
      }
      currentSection = 'SESSION_SUMMARY';
      currentContent = [];
    } else if (line.match(/^TASK_(\d+):/)) {
      if (currentSection && currentContent.length > 0) {
        if (currentSection === 'SESSION_SUMMARY') {
          sessionSummary = currentContent.join(' ').trim();
        } else {
          processSection(currentSection, currentContent.join(' ').trim(), taskSummaries);
        }
      }
      currentSection = line.match(/^TASK_(\d+):/)?.[0] || '';
      currentContent = [];
    } else if (line.trim()) {
      currentContent.push(line.trim());
    }
  }

  // Process last section
  if (currentSection && currentContent.length > 0) {
    if (currentSection === 'SESSION_SUMMARY') {
      sessionSummary = currentContent.join(' ').trim();
    } else {
      processSection(currentSection, currentContent.join(' ').trim(), taskSummaries);
    }
  }

  // Fill in missing task summaries
  for (let i = 1; i <= taskCount; i++) {
    if (!taskSummaries.find((t) => t.id === i)) {
      taskSummaries.push({ id: i, summary: '' });
    }
  }
  taskSummaries.sort((a, b) => a.id - b.id);

  return {
    sessionSummary,
    taskSummaries,
    generatedAt: new Date().toISOString(),
  };
}

function processSection(
  section: string,
  content: string,
  taskSummaries: { id: number; summary: string }[]
) {
  const match = section.match(/^TASK_(\d+):/);
  if (match) {
    const taskId = parseInt(match[1], 10);
    taskSummaries.push({ id: taskId, summary: content });
  }
}

function getCachePath(projectName: string, sessionId: string): string {
  return path.join(CACHE_DIR, `${projectName}_${sessionId}.json`);
}

function loadFromCache(projectName: string, sessionId: string): AISummary | null {
  const cachePath = getCachePath(projectName, sessionId);
  try {
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(data) as AISummary;
    }
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function saveToCache(projectName: string, sessionId: string, summary: AISummary): void {
  const cachePath = getCachePath(projectName, sessionId);
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(summary, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

'use client';

import { useState } from 'react';
import type { SessionSummary, TaskPhase, SessionTokenStats } from '@/lib/types';
import { TokenUsageCard } from './TokenUsageStats';

interface AISummary {
  sessionSummary: string;
  taskSummaries: { id: number; summary: string }[];
  generatedAt: string;
}

interface Props {
  summary: SessionSummary;
  projectName: string;
  sessionId: string;
  tokenStats?: SessionTokenStats | null;
}

const phaseLabels: Record<TaskPhase, { label: string; emoji: string }> = {
  investigation: { label: '調査', emoji: '🔍' },
  planning: { label: '計画', emoji: '📋' },
  implementation: { label: '実装', emoji: '💻' },
  verification: { label: '検証', emoji: '🧪' },
  immediate: { label: '即答', emoji: '⚡' },
};

export function SessionSummaryView({ summary, projectName, sessionId, tokenStats }: Props) {
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      setAiSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Summary Section */}
      <div className="rounded-lg border border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-purple-800">AI要約</h3>
          <button
            onClick={generateSummary}
            disabled={isGenerating}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {isGenerating ? '生成中...' : aiSummary ? '再生成' : '要約を生成'}
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {aiSummary ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-purple-100 bg-white p-3">
              <p className="text-sm text-gray-800">{aiSummary.sessionSummary}</p>
              <p className="mt-2 text-xs text-gray-400">
                生成日時: {new Date(aiSummary.generatedAt).toLocaleString('ja-JP')}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-purple-600">
            「要約を生成」をクリックすると、AIがセッション内容を要約します
          </p>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">セッション統計</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <StatItem emoji="📖" label="読込" value={summary.stats.filesRead} />
            <StatItem emoji="✏️" label="変更" value={summary.stats.filesModified} />
            <StatItem emoji="📄" label="作成" value={summary.stats.filesCreated} />
            <StatItem emoji="⚡" label="実行" value={summary.stats.commandsRun} />
            <StatItem emoji="🔍" label="検索" value={summary.stats.searchCount} />
            <StatItem emoji="🌐" label="Web" value={summary.stats.webSearchCount} />
          </div>
        </div>

        {/* Token Usage */}
        {tokenStats && (
          <TokenUsageCard
            usage={tokenStats.usage}
            title={`Token Usage${tokenStats.model ? ` (${tokenStats.model.replace('claude-', '').replace(/-\d+$/, '')})` : ''}`}
          />
        )}
      </div>

      {/* Tasks */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          タスク一覧（{summary.totalTasks}件）
        </h3>
        <div className="space-y-4">
          {summary.tasks.map((task, index) => {
            const taskAiSummary = aiSummary?.taskSummaries.find((t) => t.id === task.id);

            return (
              <div key={task.id} className="rounded-lg border border-gray-200 bg-white p-4">
                {/* Task header */}
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm text-gray-800">
                      {task.userMessage || '(メッセージなし)'}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">{formatTime(task.timestamp)}</p>
                  </div>
                </div>

                {/* AI Summary for task */}
                {taskAiSummary?.summary && (
                  <div className="mb-3 rounded border-l-2 border-purple-400 bg-purple-50 p-2">
                    <p className="text-xs text-purple-800">{taskAiSummary.summary}</p>
                  </div>
                )}

                {/* Phases */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {task.phases.map((phase) => (
                    <span
                      key={phase}
                      className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                    >
                      {phaseLabels[phase].emoji} {phaseLabels[phase].label}
                    </span>
                  ))}
                </div>

                {/* Files and commands */}
                <div className="space-y-2 text-xs">
                  {task.filesRead.length > 0 && (
                    <FileList emoji="📖" label="読込" files={task.filesRead} />
                  )}
                  {task.filesModified.length > 0 && (
                    <FileList emoji="✏️" label="変更" files={task.filesModified} />
                  )}
                  {task.filesCreated.length > 0 && (
                    <FileList emoji="📄" label="作成" files={task.filesCreated} />
                  )}
                  {task.commandsRun.length > 0 && <CommandList commands={task.commandsRun} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatItem({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-lg">{emoji}</span>
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-sm font-bold text-gray-800">{value}</span>
    </div>
  );
}

function FileList({ emoji, label, files }: { emoji: string; label: string; files: string[] }) {
  const displayFiles = files.slice(0, 5);
  const remaining = files.length - 5;

  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0">{emoji}</span>
      <span className="flex-shrink-0 text-gray-500">{label}:</span>
      <span className="break-all text-gray-700">
        {displayFiles.map((file, i) => (
          <span key={file}>
            <code className="rounded bg-gray-100 px-1">{file}</code>
            {i < displayFiles.length - 1 && ', '}
          </span>
        ))}
        {remaining > 0 && <span className="text-gray-400"> +{remaining}件</span>}
      </span>
    </div>
  );
}

function CommandList({ commands }: { commands: string[] }) {
  const displayCommands = commands.slice(0, 3);
  const remaining = commands.length - 3;

  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0">⚡</span>
      <span className="flex-shrink-0 text-gray-500">実行:</span>
      <span className="break-all text-gray-700">
        {displayCommands.map((cmd, i) => (
          <span key={i}>
            <code className="rounded bg-gray-100 px-1">{cmd}</code>
            {i < displayCommands.length - 1 && ', '}
          </span>
        ))}
        {remaining > 0 && <span className="text-gray-400"> +{remaining}件</span>}
      </span>
    </div>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

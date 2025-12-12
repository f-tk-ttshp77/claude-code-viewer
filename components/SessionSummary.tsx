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
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-purple-800">AI要約</h3>
          <button
            onClick={generateSummary}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? '生成中...' : aiSummary ? '再生成' : '要約を生成'}
          </button>
        </div>

        {error && (
          <p className="text-red-600 text-sm mb-3">{error}</p>
        )}

        {aiSummary ? (
          <div className="space-y-3">
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <p className="text-sm text-gray-800">{aiSummary.sessionSummary}</p>
              <p className="text-xs text-gray-400 mt-2">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">セッション統計</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatItem emoji="📖" label="読んだファイル" value={summary.stats.filesRead} />
            <StatItem emoji="✏️" label="変更したファイル" value={summary.stats.filesModified} />
            <StatItem emoji="📄" label="作成したファイル" value={summary.stats.filesCreated} />
            <StatItem emoji="⚡" label="実行コマンド" value={summary.stats.commandsRun} />
            <StatItem emoji="🔍" label="検索" value={summary.stats.searchCount} />
            <StatItem emoji="🌐" label="Web検索" value={summary.stats.webSearchCount} />
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
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          タスク一覧（{summary.totalTasks}件）
        </h3>
        <div className="space-y-4">
          {summary.tasks.map((task, index) => {
            const taskAiSummary = aiSummary?.taskSummaries.find((t) => t.id === task.id);

            return (
              <div
                key={task.id}
                className="border border-gray-200 rounded-lg p-4 bg-white"
              >
                {/* Task header */}
                <div className="flex items-start gap-3 mb-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 break-words">
                      {task.userMessage || '(メッセージなし)'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTime(task.timestamp)}
                    </p>
                  </div>
                </div>

                {/* AI Summary for task */}
                {taskAiSummary?.summary && (
                  <div className="mb-3 bg-purple-50 rounded p-2 border-l-2 border-purple-400">
                    <p className="text-xs text-purple-800">{taskAiSummary.summary}</p>
                  </div>
                )}

                {/* Phases */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {task.phases.map((phase) => (
                    <span
                      key={phase}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
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
                  {task.commandsRun.length > 0 && (
                    <CommandList commands={task.commandsRun} />
                  )}
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
    <div className="flex items-center gap-2">
      <span>{emoji}</span>
      <span className="text-xs text-gray-600">{label}:</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

function FileList({ emoji, label, files }: { emoji: string; label: string; files: string[] }) {
  const displayFiles = files.slice(0, 5);
  const remaining = files.length - 5;

  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0">{emoji}</span>
      <span className="text-gray-500 flex-shrink-0">{label}:</span>
      <span className="text-gray-700 break-all">
        {displayFiles.map((file, i) => (
          <span key={file}>
            <code className="bg-gray-100 px-1 rounded">{file}</code>
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
      <span className="text-gray-500 flex-shrink-0">実行:</span>
      <span className="text-gray-700 break-all">
        {displayCommands.map((cmd, i) => (
          <span key={i}>
            <code className="bg-gray-100 px-1 rounded">{cmd}</code>
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

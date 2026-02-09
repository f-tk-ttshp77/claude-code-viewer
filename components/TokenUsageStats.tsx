'use client';

import type { TokenUsage, SessionTokenStats, DailyTokenStats } from '@/lib/types';

interface TokenUsageStatsProps {
  usage: TokenUsage;
  title?: string;
  showDetails?: boolean;
}

export function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(2)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

export function TokenUsageCard({
  usage,
  title = 'Token Usage',
  showDetails = true,
}: TokenUsageStatsProps) {
  const totalTokens = usage.inputTokens + usage.outputTokens;

  // Estimate cost based on Claude Sonnet 4.5 API pricing (for reference only)
  // Max Plan users pay $200/month flat rate
  // API pricing: Input $3/1M, Output $15/1M, Cache write $3.75/1M, Cache read $0.30/1M
  const inputCost = (usage.inputTokens / 1000000) * 3;
  const outputCost = (usage.outputTokens / 1000000) * 15;
  const cacheCreationCost = (usage.cacheCreationInputTokens / 1000000) * 3.75;
  const cacheReadCost = (usage.cacheReadInputTokens / 1000000) * 0.3;
  const totalCost = inputCost + outputCost + cacheCreationCost + cacheReadCost;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-400">{title}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-2xl font-bold text-white">{formatTokenCount(totalTokens)}</div>
          <div className="text-xs text-zinc-500">Total Tokens</div>
        </div>

        <div>
          <div className="text-2xl font-bold text-emerald-400">${totalCost.toFixed(2)}</div>
          <div className="text-xs text-zinc-500">API Equivalent</div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Input</span>
            <span className="text-white">{formatTokenCount(usage.inputTokens)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Output</span>
            <span className="text-white">{formatTokenCount(usage.outputTokens)}</span>
          </div>
          {usage.cacheCreationInputTokens > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Cache Creation</span>
              <span className="text-amber-400">
                {formatTokenCount(usage.cacheCreationInputTokens)}
              </span>
            </div>
          )}
          {usage.cacheReadInputTokens > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Cache Read</span>
              <span className="text-green-400">{formatTokenCount(usage.cacheReadInputTokens)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TokenUsageBarChartProps {
  dailyStats: DailyTokenStats[];
  maxDays?: number;
}

export function TokenUsageBarChart({ dailyStats, maxDays = 14 }: TokenUsageBarChartProps) {
  const displayStats = dailyStats.slice(-maxDays);

  if (displayStats.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="py-8 text-center text-zinc-500">No usage data available</div>
      </div>
    );
  }

  const maxTokens = Math.max(
    ...displayStats.map((d) => d.usage.inputTokens + d.usage.outputTokens)
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-400">Daily Token Usage</h3>

      <div className="flex h-32 items-end gap-1">
        {displayStats.map((day) => {
          const totalTokens = day.usage.inputTokens + day.usage.outputTokens;
          const heightPercent = maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;
          const inputRatio = totalTokens > 0 ? (day.usage.inputTokens / totalTokens) * 100 : 50;

          return (
            <div
              key={day.date}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
            >
              <div
                className="flex w-full flex-col overflow-hidden rounded-t"
                style={{ height: `${Math.max(heightPercent, 4)}%` }}
              >
                <div
                  className="w-full flex-shrink-0 bg-blue-500"
                  style={{ height: `${inputRatio}%` }}
                />
                <div className="w-full flex-1 bg-purple-500" />
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full z-10 mb-2 hidden group-hover:block">
                <div className="whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs">
                  <div className="font-medium">{new Date(day.date).toLocaleDateString()}</div>
                  <div className="text-blue-400">In: {formatTokenCount(day.usage.inputTokens)}</div>
                  <div className="text-purple-400">
                    Out: {formatTokenCount(day.usage.outputTokens)}
                  </div>
                  <div className="text-zinc-400">{day.sessionCount} sessions</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="mt-2 flex gap-1">
        {displayStats.map((day, idx) => (
          <div key={day.date} className="flex-1 text-center">
            {idx === 0 || idx === displayStats.length - 1 || displayStats.length <= 7 ? (
              <span className="text-[10px] text-zinc-500">
                {new Date(day.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-blue-500" />
          <span className="text-zinc-400">Input</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-purple-500" />
          <span className="text-zinc-400">Output</span>
        </div>
      </div>
    </div>
  );
}

interface SessionTokenListProps {
  sessions: SessionTokenStats[];
  maxItems?: number;
}

export function SessionTokenList({ sessions, maxItems = 10 }: SessionTokenListProps) {
  const displaySessions = sessions.slice(0, maxItems);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-4">
        <h3 className="text-sm font-medium text-zinc-400">Recent Sessions</h3>
      </div>

      <div className="divide-y divide-zinc-800">
        {displaySessions.map((session) => {
          const totalTokens = session.usage.inputTokens + session.usage.outputTokens;

          return (
            <div
              key={`${session.projectPath}-${session.sessionId}`}
              className="p-3 hover:bg-zinc-800/50"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {session.projectName}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(session.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-sm font-medium text-white">
                    {formatTokenCount(totalTokens)}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {session.model?.replace('claude-', '').replace('-20', ' ') || 'unknown'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sessions.length > maxItems && (
        <div className="border-t border-zinc-800 p-3 text-center text-xs text-zinc-500">
          + {sessions.length - maxItems} more sessions
        </div>
      )}
    </div>
  );
}

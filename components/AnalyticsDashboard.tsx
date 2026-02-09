'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TokenAnalytics } from '@/lib/types';
import {
  TokenUsageCard,
  TokenUsageBarChart,
  SessionTokenList,
  formatTokenCount,
} from './TokenUsageStats';

interface Props {
  weeklyAnalytics: TokenAnalytics;
  monthlyAnalytics: TokenAnalytics;
  allTimeAnalytics: TokenAnalytics;
}

type Period = 'weekly' | 'monthly' | 'allTime';

export function AnalyticsDashboard({ weeklyAnalytics, monthlyAnalytics, allTimeAnalytics }: Props) {
  const [activePeriod, setActivePeriod] = useState<Period>('weekly');

  const analytics = {
    weekly: weeklyAnalytics,
    monthly: monthlyAnalytics,
    allTime: allTimeAnalytics,
  };

  const currentAnalytics = analytics[activePeriod];

  const periodLabels: Record<Period, string> = {
    weekly: 'Past 7 Days',
    monthly: 'Past 30 Days',
    allTime: 'All Time',
  };

  // Calculate cost estimates based on Claude Sonnet 4.5 API pricing
  // Note: Max Plan users pay $200/month flat rate - this is API equivalent for reference
  const calculateCost = (analytics: TokenAnalytics) => {
    const { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens } =
      analytics.totalUsage;
    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;
    const cacheCreationCost = (cacheCreationInputTokens / 1000000) * 3.75;
    const cacheReadCost = (cacheReadInputTokens / 1000000) * 0.3;
    return inputCost + outputCost + cacheCreationCost + cacheReadCost;
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {(Object.keys(periodLabels) as Period[]).map((period) => (
          <button
            key={period}
            onClick={() => setActivePeriod(period)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activePeriod === period
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            {periodLabels[period]}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">Total Tokens</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatTokenCount(
              currentAnalytics.totalUsage.inputTokens + currentAnalytics.totalUsage.outputTokens
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
            {periodLabels[activePeriod]}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">API Equivalent</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${calculateCost(currentAnalytics).toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
            Sonnet 4.5 API pricing
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">Sessions</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {currentAnalytics.sessionStats.length}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
            {periodLabels[activePeriod]}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">Cache Savings</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatTokenCount(currentAnalytics.totalUsage.cacheReadInputTokens)}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
            Tokens read from cache
          </div>
        </div>
      </div>

      {/* Comparison Summary */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 text-sm font-medium text-gray-500 dark:text-zinc-400">
          Period Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="pb-2 pr-4">Period</th>
                <th className="pb-2 pr-4 text-right">Input</th>
                <th className="pb-2 pr-4 text-right">Output</th>
                <th className="pb-2 pr-4 text-right">Total</th>
                <th className="pb-2 pr-4 text-right">Sessions</th>
                <th className="pb-2 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="text-gray-900 dark:text-white">
              <tr
                className={`border-b border-gray-200 dark:border-zinc-800 ${activePeriod === 'weekly' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
              >
                <td className="py-2 pr-4">{activePeriod === 'weekly' && '→ '}7 Days</td>
                <td className="py-2 pr-4 text-right text-blue-600 dark:text-blue-400">
                  {formatTokenCount(weeklyAnalytics.totalUsage.inputTokens)}
                </td>
                <td className="py-2 pr-4 text-right text-purple-600 dark:text-purple-400">
                  {formatTokenCount(weeklyAnalytics.totalUsage.outputTokens)}
                </td>
                <td className="py-2 pr-4 text-right">
                  {formatTokenCount(
                    weeklyAnalytics.totalUsage.inputTokens + weeklyAnalytics.totalUsage.outputTokens
                  )}
                </td>
                <td className="py-2 pr-4 text-right">{weeklyAnalytics.sessionStats.length}</td>
                <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">
                  ${calculateCost(weeklyAnalytics).toFixed(2)}
                </td>
              </tr>
              <tr
                className={`border-b border-gray-200 dark:border-zinc-800 ${activePeriod === 'monthly' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
              >
                <td className="py-2 pr-4">{activePeriod === 'monthly' && '→ '}30 Days</td>
                <td className="py-2 pr-4 text-right text-blue-600 dark:text-blue-400">
                  {formatTokenCount(monthlyAnalytics.totalUsage.inputTokens)}
                </td>
                <td className="py-2 pr-4 text-right text-purple-600 dark:text-purple-400">
                  {formatTokenCount(monthlyAnalytics.totalUsage.outputTokens)}
                </td>
                <td className="py-2 pr-4 text-right">
                  {formatTokenCount(
                    monthlyAnalytics.totalUsage.inputTokens +
                      monthlyAnalytics.totalUsage.outputTokens
                  )}
                </td>
                <td className="py-2 pr-4 text-right">{monthlyAnalytics.sessionStats.length}</td>
                <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">
                  ${calculateCost(monthlyAnalytics).toFixed(2)}
                </td>
              </tr>
              <tr className={activePeriod === 'allTime' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}>
                <td className="py-2 pr-4">{activePeriod === 'allTime' && '→ '}All Time</td>
                <td className="py-2 pr-4 text-right text-blue-600 dark:text-blue-400">
                  {formatTokenCount(allTimeAnalytics.totalUsage.inputTokens)}
                </td>
                <td className="py-2 pr-4 text-right text-purple-600 dark:text-purple-400">
                  {formatTokenCount(allTimeAnalytics.totalUsage.outputTokens)}
                </td>
                <td className="py-2 pr-4 text-right">
                  {formatTokenCount(
                    allTimeAnalytics.totalUsage.inputTokens +
                      allTimeAnalytics.totalUsage.outputTokens
                  )}
                </td>
                <td className="py-2 pr-4 text-right">{allTimeAnalytics.sessionStats.length}</td>
                <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">
                  ${calculateCost(allTimeAnalytics).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Chart and Token Details */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TokenUsageBarChart
          dailyStats={currentAnalytics.dailyStats}
          maxDays={activePeriod === 'weekly' ? 7 : 14}
        />
        <TokenUsageCard usage={currentAnalytics.totalUsage} title="Token Breakdown" />
      </div>

      {/* Recent Sessions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SessionTokenList sessions={currentAnalytics.sessionStats} maxItems={10} />

        {/* Top Projects */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-gray-200 p-4 dark:border-zinc-800">
            <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400">
              Top Projects by Token Usage
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-zinc-800">
            {getTopProjects(currentAnalytics).map(
              ({ projectName, projectPath, totalTokens, sessionCount }) => (
                <Link
                  key={projectPath}
                  href={`/?project=${encodeURIComponent(projectPath)}`}
                  className="block p-3 hover:bg-gray-100 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {projectName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-zinc-500">
                        {sessionCount} sessions
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatTokenCount(totalTokens)}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTopProjects(analytics: TokenAnalytics) {
  const projectMap = new Map<
    string,
    { projectName: string; projectPath: string; totalTokens: number; sessionCount: number }
  >();

  for (const session of analytics.sessionStats) {
    const key = session.projectPath;
    const existing = projectMap.get(key);
    const totalTokens = session.usage.inputTokens + session.usage.outputTokens;

    if (existing) {
      existing.totalTokens += totalTokens;
      existing.sessionCount++;
    } else {
      projectMap.set(key, {
        projectName: session.projectName,
        projectPath: session.projectPath,
        totalTokens,
        sessionCount: 1,
      });
    }
  }

  return Array.from(projectMap.values())
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 5);
}

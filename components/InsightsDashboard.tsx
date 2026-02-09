'use client';

import { useState } from 'react';
import type { InsightsResult, InsightDetail } from '@/lib/types';

interface Props {
  insights: InsightsResult;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

function getBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getOverallLabel(score: number): string {
  if (score >= 90) return '🏆 エキスパート';
  if (score >= 70) return '💪 上級者';
  if (score >= 50) return '📈 中級者';
  if (score >= 30) return '🌱 初級者';
  return '🔰 入門者';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function ProgressBar({ score, size = 'normal' }: { score: number; size?: 'normal' | 'small' }) {
  const height = size === 'small' ? 'h-1.5' : 'h-2.5';
  return (
    <div className={`w-full rounded-full bg-gray-200 dark:bg-gray-700 ${height}`}>
      <div
        className={`${height} rounded-full transition-all duration-500 ${getBarColor(score)}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

function DetailItem({ detail }: { detail: InsightDetail }) {
  return (
    <div className="py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-gray-700 dark:text-gray-300">{detail.category}</span>
        <span className={`text-sm font-semibold ${getScoreColor(detail.score)}`}>
          {detail.score}
        </span>
      </div>
      <ProgressBar score={detail.score} size="small" />
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail.finding}</p>
    </div>
  );
}

function AxisCard({
  title,
  score,
  details,
}: {
  title: string;
  score: number;
  details: InsightDetail[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-white p-6 shadow dark:bg-gray-800">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
      <div className={`mb-3 text-3xl font-bold ${getScoreColor(score)}`}>{score}</div>
      <ProgressBar score={score} />

      {details.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {expanded ? '▲ 詳細を閉じる' : '▼ 詳細を見る'}
          </button>
          {expanded && (
            <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
              {details.map((detail, i) => (
                <DetailItem key={i} detail={detail} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InsightsDashboard({ insights }: Props) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Overall Score Section */}
      <div className="rounded-xl bg-white p-8 text-center shadow dark:bg-gray-800">
        <h2 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">総合スコア</h2>
        <div className={`text-7xl font-extrabold ${getScoreColor(insights.overallScore)}`}>
          {insights.overallScore}
        </div>
        <div className="mt-2 text-xl">{getOverallLabel(insights.overallScore)}</div>
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          {insights.analyzedSessions}セッションを分析
          {insights.analyzedPeriod.from && insights.analyzedPeriod.to && (
            <span>
              {' '}
              | {formatDate(insights.analyzedPeriod.from)} 〜{' '}
              {formatDate(insights.analyzedPeriod.to)}
            </span>
          )}
        </div>
      </div>

      {/* 3-Axis Score Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <AxisCard
          title="Best Practice"
          score={insights.bestPractice.score}
          details={insights.bestPractice.details}
        />
        <AxisCard
          title="指示の本質度"
          score={insights.instructionQuality.score}
          details={insights.instructionQuality.details}
        />
        <AxisCard
          title="作業密度"
          score={insights.workDensity.score}
          details={insights.workDensity.details}
        />
      </div>

      {/* Recommendations Section */}
      {insights.recommendations.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            💡 改善のヒント
          </h2>
          <div className="space-y-3">
            {insights.recommendations.map((rec, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

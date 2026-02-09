'use client';

import { useState } from 'react';
import type {
  TrendData,
  TimeSeriesPoint,
  ProjectActivity,
  ToolDistribution,
  ActivityHeatmapCell,
} from '@/lib/types';

interface Props {
  weeklyTrends: TrendData;
  monthlyTrends: TrendData;
  quarterlyTrends: TrendData;
  allTimeTrends: TrendData;
}

type Period = 'weekly' | 'monthly' | 'quarterly' | 'allTime';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

// ---------- Session Time Series (SVG line/bar chart) ----------

function SessionTimeSeries({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No session data available" />;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(12, Math.min(40, Math.floor(500 / data.length) - 4));
  const chartWidth = data.length * (barWidth + 4) + 40;
  const chartHeight = 180;
  const yPadding = 20;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
        className="w-full min-w-[300px]"
        style={{ maxWidth: chartWidth }}
      >
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = yPadding + chartHeight * (1 - frac);
          return (
            <g key={frac}>
              <line
                x1={35}
                y1={y}
                x2={chartWidth}
                y2={y}
                className="stroke-gray-200 dark:stroke-zinc-700"
                strokeDasharray={frac > 0 ? '4 4' : undefined}
              />
              <text
                x={30}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-400 text-[10px] dark:fill-zinc-500"
              >
                {Math.round(maxValue * frac)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((point, i) => {
          const x = 40 + i * (barWidth + 4);
          const barHeight = (point.value / maxValue) * chartHeight;
          const y = yPadding + chartHeight - barHeight;

          return (
            <g key={point.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
                className="fill-blue-500 dark:fill-blue-400"
                opacity={0.85}
              >
                <title>
                  {point.date}: {point.value} sessions
                </title>
              </rect>
              {/* X label */}
              <text
                x={x + barWidth / 2}
                y={yPadding + chartHeight + 14}
                textAnchor="middle"
                className="fill-gray-400 text-[9px] dark:fill-zinc-500"
              >
                {point.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- Project Breakdown (horizontal bars) ----------

function ProjectBreakdown({ data }: { data: ProjectActivity[] }) {
  if (data.length === 0) {
    return <EmptyState message="No project data available" />;
  }

  const top = data.slice(0, 8);
  const maxTokens = Math.max(...top.map((d) => d.totalTokens), 1);

  return (
    <div className="space-y-2.5">
      {top.map((project) => {
        const pct = (project.totalTokens / maxTokens) * 100;
        const displayName =
          project.projectName.length > 30
            ? '...' + project.projectName.slice(-27)
            : project.projectName;

        return (
          <div key={project.projectName}>
            <div className="mb-0.5 flex items-baseline justify-between text-xs">
              <span
                className="truncate font-medium text-gray-700 dark:text-zinc-300"
                title={project.projectName}
              >
                {displayName}
              </span>
              <span className="ml-2 shrink-0 text-gray-500 dark:text-zinc-400">
                {project.sessionCount}s / {formatNumber(project.totalTokens)} tok
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Tool Distribution ----------

function ToolDistributionChart({ data }: { data: ToolDistribution[] }) {
  if (data.length === 0) {
    return <EmptyState message="No tool usage data available" />;
  }

  const top = data.slice(0, 10);
  const maxCount = Math.max(...top.map((d) => d.count), 1);

  const colorClasses = [
    'bg-blue-500 dark:bg-blue-400',
    'bg-emerald-500 dark:bg-emerald-400',
    'bg-amber-500 dark:bg-amber-400',
    'bg-purple-500 dark:bg-purple-400',
    'bg-pink-500 dark:bg-pink-400',
    'bg-cyan-500 dark:bg-cyan-400',
    'bg-orange-500 dark:bg-orange-400',
    'bg-teal-500 dark:bg-teal-400',
    'bg-rose-500 dark:bg-rose-400',
    'bg-sky-500 dark:bg-sky-400',
  ];

  return (
    <div className="space-y-2">
      {top.map((tool, i) => {
        const pct = (tool.count / maxCount) * 100;
        return (
          <div key={tool.toolName}>
            <div className="mb-0.5 flex items-baseline justify-between text-xs">
              <span className="font-mono font-medium text-gray-700 dark:text-zinc-300">
                {tool.toolName}
              </span>
              <span className="ml-2 shrink-0 text-gray-500 dark:text-zinc-400">
                {tool.count} ({tool.percentage}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
              <div
                className={`h-full rounded-full ${colorClasses[i % colorClasses.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Activity Heatmap ----------

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ActivityHeatmap({ data }: { data: ActivityHeatmapCell[] }) {
  if (data.length === 0) {
    return <EmptyState message="No activity data available" />;
  }

  // Build lookup
  const lookup = new Map<string, number>();
  let maxCount = 0;
  for (const cell of data) {
    const key = `${cell.dayOfWeek}-${cell.hour}`;
    lookup.set(key, cell.count);
    if (cell.count > maxCount) maxCount = cell.count;
  }

  function getCellColor(count: number): string {
    if (count === 0) return 'bg-gray-100 dark:bg-zinc-800';
    const intensity = count / maxCount;
    if (intensity > 0.75) return 'bg-emerald-600 dark:bg-emerald-500';
    if (intensity > 0.5) return 'bg-emerald-400 dark:bg-emerald-400';
    if (intensity > 0.25) return 'bg-emerald-300 dark:bg-emerald-600/60';
    return 'bg-emerald-200 dark:bg-emerald-700/50';
  }

  // Show only even hours as labels to save space
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Hour labels */}
        <div className="mb-0.5 flex">
          <div className="w-8 shrink-0" />
          {hours.map((h) => (
            <div
              key={h}
              className="text-center text-[9px] text-gray-400 dark:text-zinc-500"
              style={{ width: 16, marginRight: 2 }}
            >
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <div key={day} className="mb-0.5 flex items-center">
            <div className="w-8 shrink-0 text-[10px] text-gray-400 dark:text-zinc-500">
              {DAY_LABELS[day]}
            </div>
            {hours.map((hour) => {
              const count = lookup.get(`${day}-${hour}`) || 0;
              return (
                <div
                  key={hour}
                  className={`rounded-sm ${getCellColor(count)}`}
                  style={{ width: 16, height: 16, marginRight: 2 }}
                  title={`${DAY_LABELS[day]} ${hour}:00 - ${count} sessions`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500">
          <span>Less</span>
          <div className="h-3 w-3 rounded-sm bg-gray-100 dark:bg-zinc-800" />
          <div className="h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-700/50" />
          <div className="h-3 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-600/60" />
          <div className="h-3 w-3 rounded-sm bg-emerald-400 dark:bg-emerald-400" />
          <div className="h-3 w-3 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Efficiency / Complexity Line Chart (SVG) ----------

function TrendLineChart({
  data,
  label,
  color,
}: {
  data: TimeSeriesPoint[];
  label: string;
  color: string;
}) {
  if (data.length === 0) {
    return <EmptyState message={`No ${label.toLowerCase()} data available`} />;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 0.1);
  const chartWidth = Math.max(300, data.length * 50 + 60);
  const chartHeight = 120;
  const yPad = 20;
  const xPad = 40;

  const points = data.map((point, i) => {
    const x = xPad + (i / Math.max(data.length - 1, 1)) * (chartWidth - xPad - 10);
    const y = yPad + chartHeight - (point.value / maxValue) * chartHeight;
    return { x, y, ...point };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const strokeClass =
    color === 'blue'
      ? 'stroke-blue-500 dark:stroke-blue-400'
      : 'stroke-emerald-500 dark:stroke-emerald-400';
  const fillClass =
    color === 'blue'
      ? 'fill-blue-500 dark:fill-blue-400'
      : 'fill-emerald-500 dark:fill-emerald-400';

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + yPad + 20}`}
        className="w-full min-w-[300px]"
        style={{ maxWidth: chartWidth }}
      >
        {/* Y grid */}
        {[0, 0.5, 1].map((frac) => {
          const y = yPad + chartHeight * (1 - frac);
          return (
            <g key={frac}>
              <line
                x1={xPad - 5}
                y1={y}
                x2={chartWidth}
                y2={y}
                className="stroke-gray-200 dark:stroke-zinc-700"
                strokeDasharray="4 4"
              />
              <text
                x={xPad - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-400 text-[10px] dark:fill-zinc-500"
              >
                {(maxValue * frac).toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <path d={pathD} fill="none" className={strokeClass} strokeWidth={2} />

        {/* Dots */}
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={3} className={fillClass}>
            <title>
              {p.date}: {p.value}
            </title>
          </circle>
        ))}

        {/* X labels */}
        {points.map((p, i) => {
          if (data.length > 8 && i % 2 !== 0) return null;
          return (
            <text
              key={p.date}
              x={p.x}
              y={yPad + chartHeight + 14}
              textAnchor="middle"
              className="fill-gray-400 text-[9px] dark:fill-zinc-500"
            >
              {p.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- Empty State ----------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
      {message}
    </div>
  );
}

// ---------- Card wrapper ----------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-gray-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ---------- Main Dashboard ----------

export function TrendsDashboard({
  weeklyTrends,
  monthlyTrends,
  quarterlyTrends,
  allTimeTrends,
}: Props) {
  const [activePeriod, setActivePeriod] = useState<Period>('quarterly');

  const trendsMap: Record<Period, TrendData> = {
    weekly: weeklyTrends,
    monthly: monthlyTrends,
    quarterly: quarterlyTrends,
    allTime: allTimeTrends,
  };

  const current = trendsMap[activePeriod];

  const periodLabels: Record<Period, string> = {
    weekly: 'Past 7 Days',
    monthly: 'Past 30 Days',
    quarterly: 'Past 90 Days',
    allTime: 'All Time',
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">Total Sessions</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {current.totalSessions}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
            {periodLabels[activePeriod]}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">Total Tokens</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatNumber(current.totalTokens)}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">Input + Output</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">Projects</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {current.projectBreakdown.length}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">Active projects</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">Tool Calls</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatNumber(current.toolDistribution.reduce((sum, t) => sum + t.count, 0))}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
            {current.toolDistribution.length} different tools
          </div>
        </div>
      </div>

      {/* Session Time Series */}
      <Card title="Sessions per Week">
        <SessionTimeSeries data={current.sessionTimeSeries} />
      </Card>

      {/* Two-column: Project Breakdown + Tool Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Project Activity">
          <ProjectBreakdown data={current.projectBreakdown} />
        </Card>

        <Card title="Tool Usage Distribution">
          <ToolDistributionChart data={current.toolDistribution} />
        </Card>
      </div>

      {/* Activity Heatmap */}
      <Card title="Activity Heatmap (Day x Hour)">
        <ActivityHeatmap data={current.activityHeatmap} />
      </Card>

      {/* Two-column: Complexity + Token Efficiency */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Session Complexity Trend">
          <TrendLineChart data={current.complexityTrend} label="Complexity" color="blue" />
          <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500">
            Average (tasks + modified files) per session, by week
          </p>
        </Card>

        <Card title="Token Efficiency Trend">
          <TrendLineChart data={current.tokenEfficiencyTrend} label="Efficiency" color="green" />
          <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500">
            Edit+Write calls per 100K tokens, by week
          </p>
        </Card>
      </div>
    </div>
  );
}

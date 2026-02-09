import { getInsights } from '@/lib/insights';
import { InsightsDashboard } from '@/components/InsightsDashboard';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function InsightsPage() {
  const insights = getInsights();

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <Breadcrumb />
        <h1 className="mt-2 text-2xl font-bold dark:text-gray-100">Insights</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Claude Code 活用力の分析と改善のヒント
        </p>
      </div>

      <InsightsDashboard insights={insights} />
    </main>
  );
}

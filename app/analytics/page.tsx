import { getTokenAnalytics } from '@/lib/parser';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function AnalyticsPage() {
  // Get analytics for different periods
  const weeklyAnalytics = getTokenAnalytics(7);
  const monthlyAnalytics = getTokenAnalytics(30);
  const allTimeAnalytics = getTokenAnalytics(365);

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <Breadcrumb />
        <h1 className="mt-2 text-2xl font-bold dark:text-gray-100">Token Usage Analytics</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Claude Code token usage statistics
        </p>
      </div>

      <AnalyticsDashboard
        weeklyAnalytics={weeklyAnalytics}
        monthlyAnalytics={monthlyAnalytics}
        allTimeAnalytics={allTimeAnalytics}
      />
    </main>
  );
}

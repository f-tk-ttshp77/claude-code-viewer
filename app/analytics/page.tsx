import Link from 'next/link';
import { getTokenAnalytics } from '@/lib/parser';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';

export default function AnalyticsPage() {
  // Get analytics for different periods
  const weeklyAnalytics = getTokenAnalytics(7);
  const monthlyAnalytics = getTokenAnalytics(30);
  const allTimeAnalytics = getTokenAnalytics(365);

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold mt-2">Token Usage Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">
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

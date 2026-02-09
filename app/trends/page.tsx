import { getTrends } from '@/lib/trends';
import { TrendsDashboard } from '@/components/TrendsDashboard';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function TrendsPage() {
  const weeklyTrends = getTrends(7);
  const monthlyTrends = getTrends(30);
  const quarterlyTrends = getTrends(90);
  const allTimeTrends = getTrends(365);

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-6">
        <Breadcrumb />
        <h1 className="mt-2 text-2xl font-bold dark:text-gray-100">Trends</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Usage trends and activity patterns
        </p>
      </div>

      <TrendsDashboard
        weeklyTrends={weeklyTrends}
        monthlyTrends={monthlyTrends}
        quarterlyTrends={quarterlyTrends}
        allTimeTrends={allTimeTrends}
      />
    </main>
  );
}

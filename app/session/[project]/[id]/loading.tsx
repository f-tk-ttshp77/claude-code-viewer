export default function SessionLoading() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="mb-2 h-4 w-16 rounded bg-gray-200"></div>
          <div className="mb-2 h-7 w-2/3 rounded bg-gray-200"></div>
          <div className="h-4 w-1/3 rounded bg-gray-200"></div>
        </div>

        {/* Messages skeleton */}
        <div className="rounded-lg bg-white shadow">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border-b border-gray-100 p-6 last:border-b-0">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-4 w-20 rounded bg-gray-200"></div>
                <div className="h-3 w-12 rounded bg-gray-100"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-gray-100"></div>
                <div className="h-4 w-5/6 rounded bg-gray-100"></div>
                <div className="h-4 w-4/6 rounded bg-gray-100"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

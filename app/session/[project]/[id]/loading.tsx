export default function SessionLoading() {
  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-7 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>

        {/* Messages skeleton */}
        <div className="bg-white rounded-lg shadow">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-3 bg-gray-100 rounded w-12"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 rounded w-full"></div>
                <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                <div className="h-4 bg-gray-100 rounded w-4/6"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

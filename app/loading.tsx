export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="animate-pulse">
        <div className="mb-8 h-8 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <div className="mb-4 h-5 w-1/4 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div className="space-y-3">
                <div className="h-16 rounded bg-gray-100 dark:bg-gray-700"></div>
                <div className="h-16 rounded bg-gray-100 dark:bg-gray-700"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

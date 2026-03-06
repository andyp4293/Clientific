export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 animate-pulse">
      {/* Top bar skeleton */}
      <div className="hidden lg:flex fixed top-0 left-0 right-0 h-16 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800" />

      {/* Sidebar skeleton */}
      <div className="hidden lg:block fixed top-16 bottom-0 left-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800" />

      {/* Content skeleton */}
      <div className="lg:pl-64 lg:pt-16 py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 max-w-4xl">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-lg w-48" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-72" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl mt-4" />
        </div>
      </div>
    </div>
  );
}

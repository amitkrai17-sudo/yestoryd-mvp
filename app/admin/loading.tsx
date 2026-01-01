export default function AdminDashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Top bar skeleton */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-700 rounded animate-pulse"></div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-24 bg-gray-700 rounded animate-pulse"></div>
            <div className="h-10 w-10 bg-gray-700 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page title */}
        <div className="h-8 w-48 bg-gray-700 rounded animate-pulse mb-6"></div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <div className="h-4 w-16 bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-8 w-12 bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-28 bg-gray-800 rounded-lg animate-pulse"></div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-700">
            <div className="flex items-center gap-4">
              <div className="h-8 w-48 bg-gray-700 rounded animate-pulse"></div>
              <div className="flex-1"></div>
              <div className="h-8 w-32 bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
          
          {/* Table rows */}
          <div className="divide-y divide-gray-700">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-700 rounded animate-pulse"></div>
                <div className="flex-1 grid grid-cols-5 gap-4">
                  <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-4 w-20 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CoachDashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar skeleton - desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
              ))}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Mobile header */}
        <div className="lg:hidden bg-white shadow-sm border-b px-4 py-3">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>

        <main className="flex-1 p-6">
          {/* Page title */}
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6"></div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-8 w-12 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>

          {/* Table skeleton */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

'use client';

import { BarChart3, Construction } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1">Platform insights and performance metrics</p>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Construction className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Coming Soon</h2>
          <p className="text-slate-500 mb-8">
            The analytics dashboard is under development. You'll be able to track conversions, engagement, and growth metrics.
          </p>
          <div className="bg-slate-50 rounded-xl p-6 text-left">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Planned Features
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Website traffic & page views
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Assessment completion rates
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Assessment → Enrollment conversion
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Revenue trends over time
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Coach performance metrics
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

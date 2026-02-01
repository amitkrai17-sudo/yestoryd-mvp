'use client';

import { GraduationCap, Construction } from 'lucide-react';

export default function EnrollmentsPage() {
  return (
    <div className="bg-surface-0">
      <div className="bg-surface-1 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Enrollments</h1>
          <p className="text-xs sm:text-sm text-text-tertiary mt-0.5 sm:mt-1">View and manage all program enrollments</p>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Construction className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Coming Soon</h2>
          <p className="text-text-tertiary mb-8">
            The enrollments management page is under development. You'll be able to view all enrollments, filter by status, and manage enrollment details.
          </p>
          <div className="bg-surface-0 rounded-xl p-6 text-left">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              Planned Features
            </h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                View all enrollments with search & filters
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Filter by status (active, completed, cancelled)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                View child and parent details
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Track session progress
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Export enrollment data
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

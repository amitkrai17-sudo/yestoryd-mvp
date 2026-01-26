'use client';

import { Users, Construction } from 'lucide-react';

export default function CoachesPage() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="bg-surface-1 border-b border-border">
        <div className="px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Coaches</h1>
          <p className="text-text-tertiary mt-1">Manage your coaching team</p>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Construction className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Coming Soon</h2>
          <p className="text-text-tertiary mb-8">
            The coaches management page is under development. You'll be able to add coaches, manage their profiles, and track performance.
          </p>
          <div className="bg-surface-0 rounded-xl p-6 text-left">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Planned Features
            </h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Add and manage coach profiles
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Set availability and max students
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                View assigned students per coach
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Track session completion rates
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Manage revenue split percentages
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

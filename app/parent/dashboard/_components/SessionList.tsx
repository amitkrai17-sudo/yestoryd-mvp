'use client';

import Link from 'next/link';
import { Calendar, Video, ChevronRight } from 'lucide-react';
import { getSessionTypeLabel } from '@/lib/utils/session-labels';

interface Session {
  id: string;
  session_type: string;
  session_number: number;
  scheduled_date: string;
  scheduled_time: string;
  google_meet_link: string;
  status: string;
  title: string;
}

interface SessionListProps {
  upcomingSessions: Session[];
  completedSessions: number;
  totalSessions: number;
  sessionsPurchased: number | null;
  getProgressPercentage: () => number;
  isTuition?: boolean;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatTime(time: string): string {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
}

export default function SessionList({
  upcomingSessions,
  completedSessions,
  totalSessions,
  sessionsPurchased,
  getProgressPercentage,
  isTuition = false,
}: SessionListProps) {
  const displayTotal = sessionsPurchased || totalSessions;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-base">
          <Calendar className="w-5 h-5 text-[#FF0099]" />
          Upcoming Sessions
        </h2>
        <Link
          href="/parent/sessions"
          className="text-sm text-[#FF0099] hover:text-[#CC007A] font-medium flex items-center gap-1 min-h-[44px] px-2 -mr-2"
        >
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {upcomingSessions.length > 0 ? (
        <div className="divide-y divide-gray-200">
          {upcomingSessions.slice(0, 3).map((session) => (
            <div key={session.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Video className="w-6 h-6 text-[#FF0099]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-base truncate">
                    {session.title || (isTuition ? 'English Classes Session' : getSessionTypeLabel(session.session_type))}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(session.scheduled_date)} &bull; {formatTime(session.scheduled_time)}
                    {session.session_number ? ` \u2022 Session ${session.session_number}${isTuition ? '' : `/${displayTotal}`}` : ''}
                  </p>
                </div>
              </div>
              {session.google_meet_link && (
                <a
                  href={session.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#CC007A] transition-all flex-shrink-0 min-h-[44px] flex items-center"
                >
                  Join
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-base">No upcoming sessions</p>
          <p className="text-sm text-gray-500 mt-1">Sessions will appear here once scheduled</p>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-100">
        {isTuition ? (
          <p className="text-xs text-gray-500">{completedSessions} sessions completed</p>
        ) : (
          <>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{completedSessions} of {displayTotal} completed</span>
              <span>{getProgressPercentage()}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-full transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

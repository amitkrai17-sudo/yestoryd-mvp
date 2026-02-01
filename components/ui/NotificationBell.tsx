'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X, Volume2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface Props {
  userId: string;
  userType: 'parent' | 'coach' | 'admin';
  showPushPrompt?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  success: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  error: 'border-l-red-500',
  action: 'border-l-[#FF0099]',
  info: 'border-l-blue-500',
};

export function NotificationBell({ userId, userType, showPushPrompt = true }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, dismiss } = useRealtimeNotifications(userId, userType);
  const { isSubscribed, subscribe, checkSupport } = usePushNotifications(userId, userType);

  useEffect(() => {
    if (showPushPrompt && checkSupport() && !isSubscribed) {
      const timer = setTimeout(() => setShowPushBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [showPushPrompt, isSubscribed, checkSupport]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNotificationClick = async (n: typeof notifications[0]) => {
    if (!n.is_read) await markAsRead(n.id);
    if (n.action_url) router.push(n.action_url);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF0099] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto sm:left-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[60] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-[#FF0099] hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {showPushBanner && !isSubscribed && (
            <div className="p-3 bg-gradient-to-r from-[#FF0099]/20 to-[#7B008B]/20 border-b border-gray-700">
              <div className="flex items-center gap-2 text-sm text-white mb-2">
                <Volume2 className="w-4 h-4" />
                <span>Enable push notifications?</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => { await subscribe(); setShowPushBanner(false); }}
                  className="px-3 py-1 bg-[#FF0099] text-white text-xs rounded-lg hover:bg-[#FF0099]/80"
                >
                  Enable
                </button>
                <button
                  onClick={() => setShowPushBanner(false)}
                  className="px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-600"
                >
                  Later
                </button>
              </div>
            </div>
          )}

          <div className="max-h-[70vh] sm:max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-3 border-b border-gray-800 border-l-4 ${TYPE_COLORS[n.notification_type] || 'border-l-gray-500'} ${!n.is_read ? 'bg-gray-800/50' : ''} hover:bg-gray-800/30 cursor-pointer`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="w-2 h-2 bg-[#FF0099] rounded-full mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.is_read ? 'font-semibold text-white' : 'text-gray-300'} truncate`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!n.is_read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                          className="p-1 text-gray-500 hover:text-emerald-400 hover:bg-gray-700 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                        className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;

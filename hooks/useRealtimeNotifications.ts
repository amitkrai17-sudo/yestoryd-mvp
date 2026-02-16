'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface InAppNotification {
  id: string;
  user_type: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: 'info' | 'success' | 'warning' | 'error' | 'action';
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  is_dismissed: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export function useRealtimeNotifications(userId: string, userType: string) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('user_type', userType)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (err) {
      console.error('[Notifications] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, userType]);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'in_app_notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const newNotif = payload.new as InAppNotification;
        if (newNotif.user_type === userType) {
          setNotifications(prev => [newNotif, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, userType, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  }, [notifications]);

  const dismiss = useCallback(async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ is_dismissed: true })
      .eq('id', id);
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notif && !notif.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, [notifications]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, dismiss, refetch: fetchNotifications };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function detectDeviceType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Unknown';
}

export function usePushNotifications(userId: string, userType: string) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const checkSupport = useCallback(() => {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  }, []);

  useEffect(() => {
    if (!checkSupport()) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, [checkSupport]);

  const subscribe = useCallback(async () => {
    if (!checkSupport() || !userId) throw new Error('Push not supported');
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') throw new Error('Permission denied');

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
    });

    const json = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_type: userType,
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh_key: json.keys!.p256dh,
      auth_key: json.keys!.auth,
      device_type: detectDeviceType(),
      browser: detectBrowser(),
      is_active: true,
    }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;
    setIsSubscribed(true);
  }, [userId, userType, checkSupport]);

  const unsubscribe = useCallback(async () => {
    if (!checkSupport()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await supabase.from('push_subscriptions').update({ is_active: false }).eq('user_id', userId).eq('endpoint', sub.endpoint);
    }
    setIsSubscribed(false);
  }, [userId, checkSupport]);

  return { permission, isSubscribed, subscribe, unsubscribe, checkSupport };
}

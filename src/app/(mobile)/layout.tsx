'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { checkProximityAndNotify } from '@/lib/capacitor/geofence';

async function registerPushToken() {
  if (!Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  void PushNotifications.addListener('registration', async (token) => {
    const platform = Capacitor.getPlatform() as 'ios' | 'android';
    try {
      await fetch('/api/push/device-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value, platform }),
      });
    } catch (err) {
      console.error('[push] failed to register token:', err);
    }
  });

  void PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] registration error:', err);
  });
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerPushToken();
  }, []);

  useEffect(() => {
    checkProximityAndNotify();
  }, []);

  return <main className="min-h-screen bg-gray-50 flex flex-col">{children}</main>;
}

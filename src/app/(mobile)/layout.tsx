'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

  useEffect(() => {
    registerPushToken();
  }, []);

  useEffect(() => {
    checkProximityAndNotify();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void CapApp.addListener('appUrlOpen', (event) => {
      // Custom URL scheme parsing note:
      // new URL('fidelitap://c/my-slug') →  hostname='c', pathname='/my-slug'
      // new URL('fidelitap://card/uuid')  →  hostname='card', pathname='/uuid'
      // So we reconstruct the path as `/${hostname}${pathname}`.
      const url = new URL(event.url);
      const path = `/${url.hostname}${url.pathname}`;

      if (path.startsWith('/c/')) {
        // Activation page: fidelitap://c/[slug] → /c/[slug]
        router.push(path);
      } else if (path.startsWith('/card/')) {
        // Card detail: fidelitap://card/[customerCardId] → /app/cards/[customerCardId]
        const cardId = path.replace('/card/', '');
        router.push(`/app/cards/${cardId}`);
      }
    });
  }, [router]);

  return <main className="min-h-screen bg-gray-50 flex flex-col">{children}</main>;
}

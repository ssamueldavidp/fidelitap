import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';

interface CardLocation {
  id: string;
  businessName: string;
  lat: number;
  lng: number;
  radius: number;
  stampsLeft: number;
  benefitDescription: string;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function checkProximityAndNotify(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // Request permissions
  const geoPermission = await Geolocation.requestPermissions();
  if (geoPermission.location !== 'granted') return;

  const notifPermission = await LocalNotifications.requestPermissions();
  if (notifPermission.display !== 'granted') return;

  // Fetch cards with business locations from our API
  let cards: CardLocation[] = [];
  try {
    const res = await fetch('/api/mobile/cards-with-location');
    if (!res.ok) return;
    const data = await res.json();
    cards = data.cards ?? [];
  } catch {
    return;
  }

  if (cards.length === 0) return;

  // Get current position
  let position: { coords: { latitude: number; longitude: number } };
  try {
    position = await Geolocation.getCurrentPosition({ timeout: 10000, enableHighAccuracy: false });
  } catch {
    return;
  }

  const { latitude, longitude } = position.coords;

  // Check each business
  const nearby = cards.filter(card =>
    distanceMeters(latitude, longitude, card.lat, card.lng) <= card.radius
  );

  if (nearby.length === 0) return;

  // Schedule local notifications for nearby businesses
  await LocalNotifications.schedule({
    notifications: nearby.map((card, i) => ({
      id: i + 1000,
      title: `📍 Estás cerca de ${card.businessName}`,
      body:
        card.stampsLeft === 1
          ? `¡Te falta 1 sello para ${card.benefitDescription}!`
          : `Te faltan ${card.stampsLeft} sellos para ${card.benefitDescription}. ¡Visítanos!`,
      schedule: { at: new Date(Date.now() + 500) },
    })),
  });
}

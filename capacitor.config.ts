import type { CapacitorConfig } from '@capacitor/cli';

// DEV: usa NEXT_PUBLIC_APP_URL (ngrok). Requiere `pnpm dev` + `ngrok http 3000`.
// PROD: cambia server.url al dominio de producción antes de cualquier build de store.
const isProd = process.env.CAPACITOR_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'co.fidelitap.app',
  appName: 'FideliTap',
  webDir: 'public',
  server: {
    url: isProd
      ? 'https://TU_DOMINIO_PRODUCCION.com'  // reemplazar antes del build
      : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://frail-enunciate-eatery.ngrok-free.dev'),
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

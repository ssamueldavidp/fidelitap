import 'server-only';
import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Message, type BatchResponse } from 'firebase-admin/messaging';
import type { ServiceAccount } from 'firebase-admin';

let _app: App | undefined;

function getFirebaseApp(): App {
  if (_app) return _app;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set');
  }

  const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;

  if (getApps().length > 0) {
    _app = getApp();
  } else {
    _app = initializeApp({ credential: cert(serviceAccount) });
  }
  return _app;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to one or more FCM tokens.
 * Silently ignores invalid/expired tokens (logs them).
 * Returns the number of successfully sent messages.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<number> {
  if (tokens.length === 0) return 0;

  const messaging = getMessaging(getFirebaseApp());

  const messages: Message[] = tokens.map(token => ({
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data ?? {},
    apns: {
      payload: {
        aps: { sound: 'default' },
      },
    },
    android: {
      priority: 'high' as const,
    },
  }));

  const batchSize = 500; // FCM sendEach limit
  let successCount = 0;

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const response: BatchResponse = await messaging.sendEach(batch);
    successCount += response.successCount;

    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          console.warn('[push] stale token, should be pruned:', (batch[idx] as { token: string }).token);
        } else {
          console.error('[push] FCM error for token:', (batch[idx] as { token: string }).token, res.error);
        }
      }
    });
  }

  return successCount;
}

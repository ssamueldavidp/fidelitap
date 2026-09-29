import 'server-only'
import webpush from 'web-push'

// The browser Web Push half of notifications (customer opted in from the
// public /c/[slug] success screen, no app installed). This was previously
// missing entirely: push_subscriptions rows were written by
// /api/push/subscribe but nothing ever read them to send — every
// send-side function in send.ts only reached FCM device_tokens (the mobile
// app). This is the counterpart to firebase.ts's sendPushToTokens.
let configured = false
function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey || publicKey === 'dummy' || privateKey === 'dummy') return
  webpush.setVapidDetails('mailto:soporte@fidelitap.co', publicKey, privateKey)
  configured = true
}

export type WebPushSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type WebPushPayload = { title: string; body: string; url?: string }

/**
 * Sends to a batch of browser subscriptions. Returns how many succeeded and
 * the ids of subscriptions that are gone (410/404 — caller should deactivate
 * them) so a stale subscription doesn't get retried forever.
 */
export async function sendWebPush(
  subs: WebPushSubscription[],
  payload: WebPushPayload
): Promise<{ sent: number; expired: string[] }> {
  ensureConfigured()
  if (!configured || subs.length === 0) return { sent: 0, expired: [] }

  const body = JSON.stringify(payload)
  let sent = 0
  const expired: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
        sent++
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) expired.push(sub.id)
      }
    })
  )

  return { sent, expired }
}

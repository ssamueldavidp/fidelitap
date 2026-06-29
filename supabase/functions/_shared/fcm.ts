// FCM HTTP v1 helper using a service account JSON stored in FCM_SERVICE_ACCOUNT_JSON secret.
// Set the secret: supabase secrets set FCM_SERVICE_ACCOUNT_JSON='<json contents>'

interface ServiceAccountKey {
  project_id: string
  client_email: string
  private_key: string
}

interface FcmMessage {
  token: string
  notification: { title: string; body: string }
  data?: Record<string, string>
  android?: object
  apns?: object
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`

  // Import the PEM private key for RS256 signing
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const keyBytes = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  )
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
  const jwt = `${unsigned}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const tokenJson = await tokenRes.json() as { access_token: string }
  return tokenJson.access_token
}

export async function sendFcmPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const saJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  if (!saJson) {
    console.warn('[FCM] FCM_SERVICE_ACCOUNT_JSON not set — skipping push')
    return
  }
  const sa = JSON.parse(saJson) as ServiceAccountKey
  const accessToken = await getAccessToken(sa)
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

  await Promise.allSettled(
    tokens.map(async (token) => {
      const msg: FcmMessage = {
        token,
        notification: { title, body },
        ...(data ? { data } : {}),
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: msg }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error(`[FCM] send failed for token ${token.slice(0, 10)}...: ${err}`)
      }
    })
  )
}

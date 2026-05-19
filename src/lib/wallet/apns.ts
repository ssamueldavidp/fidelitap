import apn from '@parse/node-apn'

let _provider: apn.Provider | null = null

function getProvider(): apn.Provider | null {
  if (
    !process.env.APPLE_APN_KEY_BASE64 ||
    !process.env.APPLE_APN_KEY_ID ||
    !process.env.APPLE_TEAM_ID
  ) {
    return null
  }

  if (!_provider) {
    const keyBuffer = Buffer.from(process.env.APPLE_APN_KEY_BASE64, 'base64')
    _provider = new apn.Provider({
      token: {
        key: keyBuffer,
        keyId: process.env.APPLE_APN_KEY_ID,
        teamId: process.env.APPLE_TEAM_ID,
      },
      production: process.env.NODE_ENV === 'production',
    })
  }

  return _provider
}

export async function sendApnsPush(pushTokens: string[]): Promise<void> {
  if (pushTokens.length === 0) return
  if (!process.env.APPLE_PASS_TYPE_ID) return

  const provider = getProvider()
  if (!provider) return

  const notification = new apn.Notification()
  notification.topic = process.env.APPLE_PASS_TYPE_ID
  notification.payload = {}
  notification.pushType = 'background'

  // Safe to reuse notification across sends — @parse/node-apn does not mutate it
  const results = await Promise.allSettled(
    pushTokens.map((token) => provider.send(notification, token))
  )

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`APNs push failed for token ${pushTokens[i]}:`, result.reason)
    }
  })
}

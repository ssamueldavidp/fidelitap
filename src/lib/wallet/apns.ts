import apn from '@parse/node-apn'

export async function sendApnsPush(pushTokens: string[]): Promise<void> {
  if (pushTokens.length === 0) return

  if (
    !process.env.APPLE_APN_KEY_BASE64 ||
    !process.env.APPLE_APN_KEY_ID ||
    !process.env.APPLE_TEAM_ID ||
    !process.env.APPLE_PASS_TYPE_ID
  ) {
    // APNs not configured — skip silently until Apple Developer account is set up
    return
  }

  const keyBuffer = Buffer.from(process.env.APPLE_APN_KEY_BASE64, 'base64')

  const provider = new apn.Provider({
    token: {
      key: keyBuffer,
      keyId: process.env.APPLE_APN_KEY_ID,
      teamId: process.env.APPLE_TEAM_ID,
    },
    production: process.env.NODE_ENV === 'production',
  })

  const notification = new apn.Notification()
  notification.topic = process.env.APPLE_PASS_TYPE_ID
  notification.payload = {}
  notification.pushType = 'background'

  await Promise.allSettled(pushTokens.map((token) => provider.send(notification, token)))

  provider.shutdown()
}

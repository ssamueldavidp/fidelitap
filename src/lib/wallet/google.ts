import { createSign } from 'crypto'

const GOOGLE_WALLET_BASE_URL = 'https://walletobjects.googleapis.com/walletobjects/v1'

interface ServiceAccount {
  email: string
  privateKey: string
}

function getServiceAccount(): ServiceAccount {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Missing Google Wallet service account env vars')
  }
  return {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
  }
}

function signRS256JWT(payload: Record<string, unknown>, privateKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const data = `${header}.${body}`
  const sign = createSign('RSA-SHA256')
  sign.update(data)
  const signature = sign.sign(privateKey, 'base64url')
  return `${data}.${signature}`
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = {
    iss: sa.email,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const jwt = signRS256JWT(jwtPayload, sa.privateKey)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google OAuth error: ${res.status} ${text}`)
  }

  const data = await res.json() as { access_token: string }
  return data.access_token
}

export interface LoyaltyPassData {
  issuerId: string
  loyaltyCardId: string
  customerCardId: string
  businessName: string
  cardName: string
  benefitDescription: string
  stampsRequired: number
  stampsCurrent: number
  uniqueCode: string
  appUrl: string
}

async function upsertLoyaltyClass(accessToken: string, data: LoyaltyPassData): Promise<void> {
  const classId = `${data.issuerId}.card-${data.loyaltyCardId}`

  const loyaltyClass = {
    id: classId,
    issuerName: 'FideliTap',
    programName: data.cardName,
    programLogo: {
      sourceUri: { uri: `${data.appUrl}/wallet-icon.png` },
      contentDescription: { defaultValue: { language: 'es', value: data.cardName } },
    },
    rewardsTierLabel: 'Sellos',
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'CO',
  }

  const getRes = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyClass/${classId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!getRes.ok && getRes.status !== 404) {
    const text = await getRes.text()
    throw new Error(`Google Wallet API error checking resource: ${getRes.status} ${text}`)
  }

  if (getRes.status === 404) {
    const res = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyClass`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loyaltyClass),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Google Wallet API error: ${res.status} ${text}`)
    }
  } else {
    const res = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyClass/${classId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ programName: data.cardName }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Google Wallet API error: ${res.status} ${text}`)
    }
  }
}

async function upsertLoyaltyObject(accessToken: string, data: LoyaltyPassData): Promise<void> {
  const classId = `${data.issuerId}.card-${data.loyaltyCardId}`
  const objectId = `${data.issuerId}.cc-${data.customerCardId}`

  const loyaltyObject = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    loyaltyPoints: {
      label: 'Sellos',
      balance: { int: data.stampsCurrent },
    },
    barcode: {
      type: 'QR_CODE',
      value: data.uniqueCode,
    },
    textModulesData: [
      {
        header: 'Premio al completar',
        body: data.benefitDescription,
        id: 'benefit',
      },
      {
        header: 'Sellos requeridos',
        body: String(data.stampsRequired),
        id: 'required',
      },
    ],
  }

  const getRes = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyObject/${objectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!getRes.ok && getRes.status !== 404) {
    const text = await getRes.text()
    throw new Error(`Google Wallet API error checking resource: ${getRes.status} ${text}`)
  }

  if (getRes.status === 404) {
    const res = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyObject`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loyaltyObject),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Google Wallet API error: ${res.status} ${text}`)
    }
  } else {
    const res = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyObject/${objectId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loyaltyPoints: { label: 'Sellos', balance: { int: data.stampsCurrent } },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Google Wallet API error: ${res.status} ${text}`)
    }
  }
}

export async function getGoogleWalletSaveUrl(data: LoyaltyPassData): Promise<string> {
  const sa = getServiceAccount()
  const accessToken = await getAccessToken(sa)

  await upsertLoyaltyClass(accessToken, data)
  await upsertLoyaltyObject(accessToken, data)

  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = {
    iss: sa.email,
    aud: 'google',
    typ: 'savetowallet',
    iat: now,
    origins: [data.appUrl],
    payload: {
      loyaltyObjects: [
        {
          id: `${data.issuerId}.cc-${data.customerCardId}`,
          classId: `${data.issuerId}.card-${data.loyaltyCardId}`,
        },
      ],
    },
  }

  const jwt = signRS256JWT(jwtPayload, sa.privateKey)
  return `https://pay.google.com/gp/v/save/${jwt}`
}

export async function updateGoogleWalletStamps(
  customerCardId: string,
  _loyaltyCardId: string, // reserved — objectId is sufficient for PATCH
  newStampCount: number
): Promise<void> {
  if (!process.env.GOOGLE_WALLET_ISSUER_ID) return

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
  const sa = getServiceAccount()
  const accessToken = await getAccessToken(sa)
  const objectId = `${issuerId}.cc-${customerCardId}`

  const res = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyObject/${objectId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      loyaltyPoints: { label: 'Sellos', balance: { int: newStampCount } },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Wallet PATCH error: ${res.status} ${text}`)
  }
}

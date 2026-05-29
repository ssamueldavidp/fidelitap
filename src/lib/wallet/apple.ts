import { PKPass } from 'passkit-generator'
import { readFileSync } from 'fs'
import { join } from 'path'

interface ApplePassData {
  passTypeIdentifier: string
  teamIdentifier: string
  serialNumber: string
  authenticationToken: string
  organizationName: string
  description: string
  stampsCurrent: number
  stampsRequired: number
  benefitDescription: string
  uniqueCode: string
  appUrl: string
  color?: string | null
  logoUrl?: string | null
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  // Perceived luminance
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

export async function generateApplePass(data: ApplePassData): Promise<Buffer> {
  if (!process.env.APPLE_WWDR_BASE64 || !process.env.APPLE_CERT_BASE64 || !process.env.APPLE_KEY_BASE64) {
    throw new Error('Missing Apple Wallet certificate env vars')
  }

  const wwdr = Buffer.from(process.env.APPLE_WWDR_BASE64, 'base64')
  const signerCert = Buffer.from(process.env.APPLE_CERT_BASE64, 'base64')
  const signerKey = Buffer.from(process.env.APPLE_KEY_BASE64, 'base64')
  const signerKeyPassphrase = process.env.APPLE_CERT_PASSPHRASE ?? ''

  let iconBuffer: Buffer
  try {
    iconBuffer = readFileSync(join(process.cwd(), 'public', 'wallet-icon.png'))
  } catch {
    // Minimal valid 1x1 PNG fallback
    iconBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=',
      'base64'
    )
  }

  // Attempt to fetch business logo for the pass
  let logoBuffer: Buffer = iconBuffer // fallback to icon
  if (data.logoUrl && data.logoUrl.startsWith('https')) {
    try {
      const logoRes = await fetch(data.logoUrl, { signal: AbortSignal.timeout(3000) })
      if (logoRes.ok) {
        const arrayBuf = await logoRes.arrayBuffer()
        logoBuffer = Buffer.from(arrayBuf)
      }
    } catch {
      // Logo fetch failed — use icon fallback silently
    }
  }

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: data.passTypeIdentifier,
    serialNumber: data.serialNumber,
    teamIdentifier: data.teamIdentifier,
    organizationName: data.organizationName,
    description: data.description,
    backgroundColor: data.color && /^#[0-9A-Fa-f]{6}$/.test(data.color)
      ? hexToRgb(data.color)
      : 'rgb(15, 23, 42)',
    foregroundColor: data.color && /^#[0-9A-Fa-f]{6}$/.test(data.color) && isLightColor(data.color)
      ? 'rgb(15, 23, 42)'
      : 'rgb(255, 255, 255)',
    labelColor: data.color && /^#[0-9A-Fa-f]{6}$/.test(data.color) && isLightColor(data.color)
      ? 'rgb(80, 80, 80)'
      : 'rgb(200, 210, 220)',
    webServiceURL: `${data.appUrl}/api/wallet/apple/updates`,
    authenticationToken: data.authenticationToken,
    storeCard: {
      primaryFields: [
        {
          key: 'stamps',
          label: 'Sellos',
          value: `${data.stampsCurrent} / ${data.stampsRequired}`,
        },
      ],
      secondaryFields: [
        {
          key: 'benefit',
          label: 'Premio',
          value: data.benefitDescription,
        },
      ],
      auxiliaryFields: [
        {
          key: 'business',
          label: 'Negocio',
          value: data.organizationName,
        },
      ],
      backFields: [
        {
          key: 'code',
          label: 'Tu código único',
          value: data.uniqueCode,
        },
      ],
    },
    barcodes: [
      {
        message: data.uniqueCode,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      },
    ],
    barcode: {
      message: data.uniqueCode,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
    },
  }

  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': iconBuffer,
      'icon@2x.png': iconBuffer,
      'logo.png': logoBuffer,
      'logo@2x.png': logoBuffer,
    },
    {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase,
    }
  )

  return pass.getAsBuffer()
}

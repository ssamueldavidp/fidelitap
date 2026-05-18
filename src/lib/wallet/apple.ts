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
}

export async function generateApplePass(data: ApplePassData): Promise<Buffer> {
  const wwdr = Buffer.from(process.env.APPLE_WWDR_BASE64!, 'base64')
  const signerCert = Buffer.from(process.env.APPLE_CERT_BASE64!, 'base64')
  const signerKey = Buffer.from(process.env.APPLE_KEY_BASE64!, 'base64')
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

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: data.passTypeIdentifier,
    serialNumber: data.serialNumber,
    teamIdentifier: data.teamIdentifier,
    organizationName: data.organizationName,
    description: data.description,
    backgroundColor: 'rgb(15, 23, 42)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(148, 163, 184)',
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
        {
          key: 'instructions',
          label: 'Cómo funciona',
          value: 'Muestra el QR en cada visita. El negocio lo escanea para agregar un sello.',
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

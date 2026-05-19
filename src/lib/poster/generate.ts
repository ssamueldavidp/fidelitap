import path from 'path'
import fs from 'fs'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { VerticalPosterTemplate, HorizontalPosterTemplate, PosterData } from './template'

// Font buffers — read once at module load
const interRegular = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/poster/fonts/Inter-Regular.ttf')
)
const interBold = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/poster/fonts/Inter-Bold.ttf')
)

const FONTS = [
  { name: 'Inter', data: interRegular.buffer.slice(interRegular.byteOffset, interRegular.byteOffset + interRegular.byteLength) as ArrayBuffer, weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: interBold.buffer.slice(interBold.byteOffset, interBold.byteOffset + interBold.byteLength) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
]

async function buildPng(data: PosterData): Promise<Buffer> {
  const isVertical = data.orientation === 'vertical'
  const width = isVertical ? 794 : 1123
  const height = isVertical ? 1123 : 794

  const element = isVertical
    ? VerticalPosterTemplate(data)
    : HorizontalPosterTemplate(data)

  const svg = await satori(element, { width, height, fonts: FONTS })

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
  return Buffer.from(resvg.render().asPng())
}

export async function generatePosterPng(data: PosterData): Promise<Buffer> {
  return buildPng(data)
}

export async function generatePosterPdf(data: PosterData): Promise<Buffer> {
  const pngBuffer = await buildPng(data)

  const pdfDoc = await PDFDocument.create()
  const pngImage = await pdfDoc.embedPng(pngBuffer)

  // A4 in PDF points: portrait 595×842, landscape 842×595
  const isVertical = data.orientation === 'vertical'
  const pageWidth = isVertical ? 595.28 : 841.89
  const pageHeight = isVertical ? 841.89 : 595.28
  const page = pdfDoc.addPage([pageWidth, pageHeight])
  page.drawImage(pngImage, { x: 0, y: 0, width: pageWidth, height: pageHeight })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export async function buildQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
}

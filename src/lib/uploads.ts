// Validación de imágenes subidas: no se confía en el tipo ni en el nombre que declara el cliente
// (un .html/.svg con Content-Type de imagen serviría contenido activo desde el bucket público).
// Se verifica el contenido real (firma binaria) y se fija la extensión a partir de él.

export type ImageKind = { contentType: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' }

export function sniffImage(head: Uint8Array): ImageKind | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { contentType: 'image/jpeg', ext: 'jpg' }
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return { contentType: 'image/png', ext: 'png' }
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) return { contentType: 'image/webp', ext: 'webp' }
  return null
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export async function readValidatedImage(
  file: File,
  maxBytes = MAX_IMAGE_BYTES
): Promise<{ bytes: ArrayBuffer; kind: ImageKind } | { error: string }> {
  if (file.size === 0) return { error: 'El archivo está vacío' }
  if (file.size > maxBytes) return { error: `La imagen no puede superar ${Math.round(maxBytes / 1024 / 1024)} MB` }
  const bytes = await file.arrayBuffer()
  const kind = sniffImage(new Uint8Array(bytes.slice(0, 12)))
  if (!kind) return { error: 'El archivo no es una imagen válida (JPEG, PNG o WebP)' }
  return { bytes, kind }
}

// Las URLs de imágenes (logo, fondo) que guarda un negocio solo pueden apuntar al Storage público
// de nuestro propio Supabase. Evita que el servidor haga peticiones a URLs arbitrarias o internas
// (SSRF, p. ej. al generar el pase de Apple Wallet) y que se incrusten imágenes de terceros.

function allowedHosts(): string[] {
  const hosts: string[] = []
  for (const raw of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    try {
      if (raw) hosts.push(new URL(raw).host)
    } catch { /* ignorar */ }
  }
  return hosts
}

export function isTrustedStorageUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false
  let u: URL
  try { u = new URL(value) } catch { return false }
  if (u.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && u.protocol === 'http:')) return false
  if (u.username || u.password) return false
  if (!u.pathname.startsWith('/storage/v1/object/public/') && !u.pathname.startsWith('/storage/')) return false
  return allowedHosts().includes(u.host)
}

/** null/vacío es válido (sin imagen); cualquier otro valor debe ser una URL de nuestro Storage. */
export function isOptionalTrustedStorageUrl(value: unknown): boolean {
  return value === null || value === undefined || value === '' || isTrustedStorageUrl(value)
}

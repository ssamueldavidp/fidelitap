// Rewrites local Supabase Storage URLs to use the public app URL when accessed externally
export function resolveStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  // Replace local Supabase storage URL with the public app URL
  if (url.includes('127.0.0.1:54321') || url.includes('localhost:54321')) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    if (appUrl && !appUrl.includes('localhost')) {
      return url.replace(/http:\/\/(127\.0\.0\.1|localhost):54321/, appUrl)
    }
  }
  return url
}

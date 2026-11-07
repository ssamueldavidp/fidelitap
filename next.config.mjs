const isProd = process.env.NODE_ENV === 'production'

// Orígenes solo de desarrollo (Supabase local, ngrok): no deben existir en producción.
const devImg = isProd ? '' : ' http://127.0.0.1:* http://localhost:* https://*.ngrok-free.dev https://*.ngrok.io'
const devConnect = isProd ? '' : ' http://127.0.0.1:* http://localhost:* ws://localhost:* ws://127.0.0.1:*'

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['@resvg/resvg-js', 'firebase-admin'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  // Proxy local Supabase Storage so images work via ngrok on any device
  // Solo en desarrollo: en producción este proxy apuntaría a localhost.
  async rewrites() {
    if (isProd) return []
    return [
      {
        source: '/storage/:path*',
        destination: 'http://127.0.0.1:54321/storage/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js inyecta scripts en línea; 'unsafe-eval' solo se necesita en desarrollo (HMR).
              `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isProd ? '' : " 'unsafe-eval'"}`,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://*.supabase.co${devImg}`,
              `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com${devConnect}`,
              "frame-src https://challenges.cloudflare.com",
              "font-src 'self'",
              "worker-src 'self'",
              "manifest-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              ...(isProd ? ['upgrade-insecure-requests'] : []),
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig

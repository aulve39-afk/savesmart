import type { NextConfig } from 'next'

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=self, microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      // API routes stay same-origin; Supabase + Google auth + analytics-free
      "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://*.supabase.co https://gmail.googleapis.com",
      "frame-ancestors 'none'",
      // Allow service worker on same origin
      "worker-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    output: 'export',
    trailingSlash: true,
  }),
  images: {
    unoptimized: isCapacitorBuild,
  },
  ...(!isCapacitorBuild && {
    async headers() {
      return [{ source: '/(.*)', headers: securityHeaders }]
    },
  }),
}

export default nextConfig
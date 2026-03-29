import type { NextConfig } from 'next'

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true'
const isGithubPages   = process.env.GITHUB_PAGES === 'true'
const isStaticExport  = isCapacitorBuild || isGithubPages

const AUDIT_API_BACKEND = process.env.AUDIT_API_BACKEND_URL ?? 'http://localhost:8000'

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
      "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://*.supabase.co https://gmail.googleapis.com",
      "frame-ancestors 'none'",
      "worker-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  ...(isStaticExport && {
    output: 'export',
    trailingSlash: true,
  }),
  ...(!isStaticExport && process.env.NODE_ENV === 'production' && {
    output: 'standalone',
  }),
  images: {
    unoptimized: isStaticExport,
  },
  ...(!isStaticExport && {
    async rewrites() {
      return [
        {
          source: '/api/v1/:path*',
          destination: `${AUDIT_API_BACKEND}/api/v1/:path*`,
        },
      ]
    },
    async headers() {
      return [{ source: '/(.*)', headers: securityHeaders }]
    },
  }),
}

export default nextConfig

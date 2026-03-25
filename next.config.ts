import type { NextConfig } from 'next'

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true'

// URL du backend FastAPI (pour le proxy Next.js en dev et prod)
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
      // 'self' couvre les appels proxifiés /api/v1/* → backend
      // Les autres origines: Supabase, Google auth, audit backend direct (si besoin)
      "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://*.supabase.co https://gmail.googleapis.com",
      "frame-ancestors 'none'",
      "worker-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    output: 'export',
    trailingSlash: true,
  }),
  // output: 'standalone' en prod web → image Docker optimisée (inclut uniquement les dépendances nécessaires)
  ...(!isCapacitorBuild && process.env.NODE_ENV === 'production' && {
    output: 'standalone',
  }),
  images: {
    unoptimized: isCapacitorBuild,
  },
  ...(!isCapacitorBuild && {
    // ── Proxy transparent vers le backend FastAPI ─────────────────────────────
    // Le frontend appelle /api/v1/* → Next.js rewrite → http://backend:8000/api/v1/*
    // Avantages: same-origin (CSP OK), pas de CORS en prod, URL stable
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
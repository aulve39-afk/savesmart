import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import Providers from './providers'
import PwaSetup from './components/PwaSetup'
import InstallBanner from './components/InstallBanner'

const geistSans = GeistSans
const geistMono = GeistMono

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#1e293b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',   // Extend into the notch / dynamic island
}

export const metadata: Metadata = {
  title: 'SaveSmart — Gérez vos abonnements',
  description: 'Analysez, optimisez et maîtrisez vos abonnements grâce à l\'IA Claude.',
  applicationName: 'SaveSmart',
  generator: 'Next.js',
  keywords: ['abonnements', 'budget', 'économies', 'netflix', 'spotify', 'finances'],
  authors: [{ name: 'SaveSmart' }],
  creator: 'SaveSmart',

  // ── PWA manifest ────────────────────────────────────────────────────────────
  manifest: '/manifest.json',

  // ── Open Graph ──────────────────────────────────────────────────────────────
  openGraph: {
    title: 'SaveSmart — Gérez vos abonnements',
    description: 'Analysez et optimisez vos abonnements grâce à l\'IA.',
    type: 'website',
    locale: 'fr_FR',
  },

  // ── iOS / Apple ──────────────────────────────────────────────────────────────
  appleWebApp: {
    capable: true,
    title: 'SaveSmart',
    // "default" = shows the status bar (white bar on top)
    // "black-translucent" = overlays the status bar (needs top padding)
    statusBarStyle: 'default',
  },

  // ── Icons ────────────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/icon.svg' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon.svg', color: '#4f46e5' },
    ],
  },

  // Prevent search engines from indexing the app itself
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {/*
          Couleur de fond inline AVANT que le CSS soit parsé.
          Les variables CSS (--bg) ne sont pas disponibles à ce stade,
          donc on code les valeurs en dur ici.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          html,body{background:#f8fafc}
          @media(prefers-color-scheme:dark){html,body{background:#0f172a}}
        `}} />

        {/* iOS: run full-screen without the Safari chrome */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* MS Tiles (legacy but harmless) */}
        <meta name="msapplication-TileColor" content="#4f46e5" />
        <meta name="msapplication-TileImage" content="/icons/icon.svg" />

        {/* Prevent iOS from auto-detecting phone numbers as links */}
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
      </head>
      {/*
        onTouchStart={} vide sur body = fix iOS Safari :active.
      */}
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        {/* PWA: service worker + Capacitor native setup */}
        <PwaSetup />
        {/* Install banner (iOS & Android Chrome) */}
        <InstallBanner />
      </body>
    </html>
  )
}

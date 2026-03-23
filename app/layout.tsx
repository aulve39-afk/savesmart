import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import Providers from './providers'

const geistSans = GeistSans
const geistMono = GeistMono

export const metadata: Metadata = {
  title: 'SaveSmart',
  description: 'Analysez vos abonnements et économisez',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/*
        onTouchStart={} vide sur body = fix iOS Safari :
        sans ça, CSS :active ne se déclenche pas sur les éléments tactiles.
        C'est la solution recommandée par Apple pour activer les états :active.
      */}
      <body className="min-h-full flex flex-col" onTouchStart={() => {}}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
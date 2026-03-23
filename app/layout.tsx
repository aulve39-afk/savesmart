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
      <head>
        {/*
          Couleur de fond inline AVANT que le CSS soit parsé.
          Sans ça, le navigateur affiche un flash blanc (fond par défaut)
          pendant les ~50ms entre le premier paint et le chargement du CSS.
          Les variables CSS (--bg) ne sont pas disponibles à ce stade,
          donc on code les valeurs en dur ici.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          html,body{background:#f8fafc}
          @media(prefers-color-scheme:dark){html,body{background:#0f172a}}
        `}} />
      </head>
      {/*
        onTouchStart={} vide sur body = fix iOS Safari :
        sans ça, CSS :active ne se déclenche pas sur les éléments tactiles.
        C'est la solution recommandée par Apple pour activer les états :active.
      */}
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
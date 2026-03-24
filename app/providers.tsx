'use client'
import { SessionProvider } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import TopProgressBar from './components/TopProgressBar'
import OfflineBanner from './components/OfflineBanner'

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <SessionProvider>
      {/* onTouchStart vide = fix iOS Safari : active CSS states on touch elements */}
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }} onTouchStart={() => {}}>
        <TopProgressBar />
        <OfflineBanner />
        <div key={pathname} className="page-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </SessionProvider>
  )
}

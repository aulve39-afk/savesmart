'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import TopProgressBar from './components/TopProgressBar'
import OfflineBanner from './components/OfflineBanner'

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // QueryClient dans useState: évite le partage d'état entre les requêtes SSR
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  )
}

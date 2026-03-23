'use client'
import { usePathname } from 'next/navigation'
import TopProgressBar from './components/TopProgressBar'

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    // onTouchStart vide = fix iOS Safari : active CSS states on touch elements
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }} onTouchStart={() => {}}>
      <TopProgressBar />
      <div key={pathname} className="page-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

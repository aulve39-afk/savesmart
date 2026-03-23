'use client'
import TopProgressBar from './components/TopProgressBar'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // onTouchStart vide = fix iOS Safari : active CSS states on touch elements
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }} onTouchStart={() => {}}>
      <TopProgressBar />
      {children}
    </div>
  )
}

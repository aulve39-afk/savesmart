'use client'
import { useEffect } from 'react'

// Fixed positions — no Math.random() to avoid SSR/hydration mismatch
const PIECES = [
  { left: '8%',  color: '#6366f1', size: 8,  delay: 0,    rot: 120,  dur: 2.8 },
  { left: '14%', color: '#f59e0b', size: 6,  delay: 0.15, rot: -160, dur: 2.5 },
  { left: '21%', color: '#ec4899', size: 10, delay: 0.05, rot: 280,  dur: 3.0 },
  { left: '28%', color: '#10b981', size: 7,  delay: 0.3,  rot: -80,  dur: 2.7 },
  { left: '35%', color: '#7c3aed', size: 9,  delay: 0.1,  rot: 400,  dur: 2.4 },
  { left: '42%', color: '#f59e0b', size: 6,  delay: 0.4,  rot: -280, dur: 3.1 },
  { left: '50%', color: '#6366f1', size: 8,  delay: 0.2,  rot: 200,  dur: 2.6 },
  { left: '57%', color: '#ec4899', size: 7,  delay: 0.45, rot: -120, dur: 2.9 },
  { left: '64%', color: '#10b981', size: 11, delay: 0.08, rot: 320,  dur: 2.5 },
  { left: '71%', color: '#f59e0b', size: 6,  delay: 0.35, rot: -400, dur: 3.2 },
  { left: '78%', color: '#7c3aed', size: 8,  delay: 0.12, rot: 160,  dur: 2.7 },
  { left: '85%', color: '#6366f1', size: 9,  delay: 0.5,  rot: -240, dur: 2.4 },
  { left: '92%', color: '#ec4899', size: 7,  delay: 0.22, rot: 360,  dur: 3.0 },
  { left: '5%',  color: '#10b981', size: 6,  delay: 0.6,  rot: -200, dur: 2.8 },
  { left: '18%', color: '#7c3aed', size: 10, delay: 0.18, rot: 480,  dur: 2.5 },
  { left: '32%', color: '#f59e0b', size: 7,  delay: 0.55, rot: -320, dur: 3.1 },
  { left: '46%', color: '#6366f1', size: 8,  delay: 0.28, rot: 120,  dur: 2.6 },
  { left: '60%', color: '#ec4899', size: 9,  delay: 0.42, rot: -440, dur: 2.9 },
  { left: '74%', color: '#10b981', size: 6,  delay: 0.08, rot: 240,  dur: 3.2 },
  { left: '88%', color: '#7c3aed', size: 7,  delay: 0.65, rot: -160, dur: 2.7 },
  { left: '11%', color: '#f59e0b', size: 11, delay: 0.32, rot: 360,  dur: 2.4 },
  { left: '39%', color: '#6366f1', size: 6,  delay: 0.48, rot: -280, dur: 3.0 },
  { left: '66%', color: '#ec4899', size: 8,  delay: 0.14, rot: 200,  dur: 2.8 },
  { left: '95%', color: '#10b981', size: 9,  delay: 0.58, rot: -360, dur: 2.5 },
]

export default function Confetti({ show, onDone }: { show: boolean; onDone?: () => void }) {
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => onDone?.(), 3600)
    return () => clearTimeout(t)
  }, [show, onDone])

  if (!show) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {PIECES.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '-12px',
            left: c.left,
            width: `${c.size}px`,
            height: `${c.size * 0.45}px`,
            background: c.color,
            borderRadius: '2px',
            animation: `confettiShared ${c.dur}s ease-in ${c.delay}s both`,
            ['--rot' as string]: `${c.rot}deg`,
            pointerEvents: 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes confettiShared {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1 }
          80%  { opacity: 1 }
          100% { transform: translateY(110vh) rotate(var(--rot)); opacity: 0 }
        }
      `}</style>
    </div>
  )
}

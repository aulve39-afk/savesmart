'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

// 24 confettis avec des propriétés variées fixes (évite le randomness côté serveur)
const CONFETTI = [
  { left: '8%',  color: '#6366f1', size: 8,  delay: 0,    rot: 15,  dur: 2.8 },
  { left: '14%', color: '#f59e0b', size: 6,  delay: 0.15, rot: -20, dur: 2.5 },
  { left: '21%', color: '#ec4899', size: 10, delay: 0.05, rot: 35,  dur: 3.0 },
  { left: '28%', color: '#10b981', size: 7,  delay: 0.3,  rot: -10, dur: 2.7 },
  { left: '35%', color: '#7c3aed', size: 9,  delay: 0.1,  rot: 50,  dur: 2.4 },
  { left: '42%', color: '#f59e0b', size: 6,  delay: 0.4,  rot: -35, dur: 3.1 },
  { left: '50%', color: '#6366f1', size: 8,  delay: 0.2,  rot: 25,  dur: 2.6 },
  { left: '57%', color: '#ec4899', size: 7,  delay: 0.45, rot: -15, dur: 2.9 },
  { left: '64%', color: '#10b981', size: 11, delay: 0.08, rot: 40,  dur: 2.5 },
  { left: '71%', color: '#f59e0b', size: 6,  delay: 0.35, rot: -50, dur: 3.2 },
  { left: '78%', color: '#7c3aed', size: 8,  delay: 0.12, rot: 20,  dur: 2.7 },
  { left: '85%', color: '#6366f1', size: 9,  delay: 0.5,  rot: -30, dur: 2.4 },
  { left: '92%', color: '#ec4899', size: 7,  delay: 0.22, rot: 45,  dur: 3.0 },
  { left: '5%',  color: '#10b981', size: 6,  delay: 0.6,  rot: -25, dur: 2.8 },
  { left: '18%', color: '#7c3aed', size: 10, delay: 0.18, rot: 60,  dur: 2.5 },
  { left: '32%', color: '#f59e0b', size: 7,  delay: 0.55, rot: -40, dur: 3.1 },
  { left: '46%', color: '#6366f1', size: 8,  delay: 0.28, rot: 15,  dur: 2.6 },
  { left: '60%', color: '#ec4899', size: 9,  delay: 0.42, rot: -55, dur: 2.9 },
  { left: '74%', color: '#10b981', size: 6,  delay: 0.08, rot: 30,  dur: 3.2 },
  { left: '88%', color: '#7c3aed', size: 7,  delay: 0.65, rot: -20, dur: 2.7 },
  { left: '11%', color: '#f59e0b', size: 11, delay: 0.32, rot: 45,  dur: 2.4 },
  { left: '39%', color: '#6366f1', size: 6,  delay: 0.48, rot: -35, dur: 3.0 },
  { left: '66%', color: '#ec4899', size: 8,  delay: 0.14, rot: 25,  dur: 2.8 },
  { left: '95%', color: '#10b981', size: 9,  delay: 0.58, rot: -45, dur: 2.5 },
]

export default function WelcomePage() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [autoRedirectIn, setAutoRedirectIn] = useState(4)
  const [addedName, setAddedName] = useState('')

  useEffect(() => {
    // Récupère le nom du dernier abonnement ajouté (passé depuis ajouter/page.tsx)
    try {
      const n = localStorage.getItem('savesmart_last_added') || ''
      if (n) { setAddedName(n); localStorage.removeItem('savesmart_last_added') }
    } catch {}

    // Légère pause avant d'afficher — laisse le temps au moteur de render
    const t1 = setTimeout(() => setVisible(true), 80)

    // Compte à rebours
    const interval = setInterval(() => {
      setAutoRedirectIn(n => {
        if (n <= 1) { clearInterval(interval); router.push('/'); return 0 }
        return n - 1
      })
    }, 1000)

    return () => { clearTimeout(t1); clearInterval(interval) }
  }, [router])

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '0 24px' }}>

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1 }
          80%  { opacity: 1 }
          100% { transform: translateY(110vh) rotate(var(--rot)); opacity: 0 }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 100 }
          to   { stroke-dashoffset: 0 }
        }
        @keyframes circlePop {
          0%   { transform: scale(0); opacity: 0 }
          60%  { transform: scale(1.15) }
          80%  { transform: scale(0.95) }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes fadeSlideUp {
          from { transform: translateY(24px); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);    opacity: 0.6 }
          100% { transform: scale(1.55); opacity: 0 }
        }
      `}</style>

      {/* ── CONFETTIS ── */}
      {CONFETTI.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            top: '-12px',
            left: c.left,
            width: `${c.size}px`,
            height: `${c.size * 0.45}px`,
            background: c.color,
            borderRadius: '2px',
            animation: `confettiFall ${c.dur}s ease-in ${c.delay}s both`,
            ['--rot' as string]: `${c.rot * 8}deg`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      ))}

      {/* ── CONTENU ── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>

        {/* Cercle animé avec checkmark SVG */}
        <div style={{ position: 'relative', marginBottom: '32px' }}>
          {/* Ring pulsé */}
          <div style={{
            position: 'absolute', inset: '-16px',
            borderRadius: '50%',
            border: '3px solid #4f46e5',
            animation: `pulseRing 1.4s ease-out ${visible ? '0.5s' : '99s'} both`,
          }} />
          {/* Cercle vert */}
          <div style={{
            width: '100px', height: '100px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: visible ? 'circlePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both' : 'none',
            boxShadow: '0 12px 40px rgba(79,70,229,0.35)',
          }}>
            {/* Checkmark SVG avec stroke-dasharray pour l'animation de tracé */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ overflow: 'visible' }}>
              <polyline
                points="10,26 20,36 38,14"
                stroke="white"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray="100"
                style={{
                  strokeDashoffset: 0,
                  animation: visible ? 'checkDraw 0.5s ease-out 0.55s both' : 'none',
                }}
              />
            </svg>
          </div>
        </div>

        {/* Titre */}
        <h1 style={{
          fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)',
          letterSpacing: '-0.5px', margin: '0 0 10px', textAlign: 'center',
          animation: visible ? 'fadeSlideUp 0.5s ease-out 0.7s both' : 'none',
        }}>
          {addedName ? `${addedName} est suivi ! 🎉` : "C\u2019est parti ! 🎉"}
        </h1>

        {/* Sous-titre */}
        <p style={{
          fontSize: '16px', color: 'var(--text-secondary)', textAlign: 'center',
          margin: '0 0 8px', lineHeight: '1.5',
          animation: visible ? 'fadeSlideUp 0.5s ease-out 0.85s both' : 'none',
        }}>
          {addedName
            ? <><strong style={{ color: 'var(--text-primary)' }}>{addedName}</strong> a été ajouté à ta liste.<br />SaveSmart veille pour toi maintenant.</>
            : <>Ton premier abonnement est suivi.<br /><strong style={{ color: 'var(--text-primary)' }}>SaveSmart veille pour toi maintenant.</strong></>
          }
        </p>

        {/* Message secondaire */}
        <p style={{
          fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center',
          margin: '0 0 40px', lineHeight: '1.5',
          animation: visible ? 'fadeSlideUp 0.5s ease-out 0.95s both' : 'none',
        }}>
          On détectera chaque renouvellement, chaque doublon,<br />
          et chaque économie possible — automatiquement.
        </p>

        {/* Bouton CTA */}
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: 'white', border: 'none', borderRadius: '16px',
            padding: '16px 40px', fontWeight: '700', fontSize: '16px',
            cursor: 'pointer', width: '100%', maxWidth: '320px',
            boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
            animation: visible ? 'fadeSlideUp 0.5s ease-out 1.05s both' : 'none',
          }}
        >
          Découvrir mon espace →
        </button>

        {/* Compte à rebours discret */}
        <p style={{
          fontSize: '12px', color: 'var(--text-muted)', margin: '16px 0 0',
          animation: visible ? 'fadeSlideUp 0.5s ease-out 1.2s both' : 'none',
        }}>
          Redirection automatique dans {autoRedirectIn}s…
        </p>
      </div>
    </main>
  )
}

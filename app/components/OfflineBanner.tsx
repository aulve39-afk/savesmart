'use client'
import { useEffect, useState } from 'react'

/**
 * Bandeau discret affiché en haut de l'écran quand la connexion est coupée.
 * Disparaît automatiquement 2 s après le retour en ligne.
 *
 * Stratégie :
 *  - navigator.onLine pour l'état initial (hydratation)
 *  - Événements 'offline' / 'online' pour les changements en direct
 *  - Animation slide-down à l'apparition, slide-up à la disparition
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [backOnline, setBackOnline] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Pas de rendu côté serveur
    if (typeof window === 'undefined') return

    const handleOffline = () => {
      setBackOnline(false)
      setOffline(true)
      setVisible(true)
    }

    const handleOnline = () => {
      setBackOnline(true)
      // Laisse le message "Connexion rétablie" visible 2 s puis disparaît
      setTimeout(() => {
        setVisible(false)
        setTimeout(() => { setOffline(false); setBackOnline(false) }, 350)
      }, 2000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <>
      <style>{`
        @keyframes bannerSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes bannerSlideUp {
          from { transform: translateY(0);     opacity: 1; }
          to   { transform: translateY(-100%); opacity: 0; }
        }
      `}</style>
      <div
        role="alert"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          background: backOnline
            ? 'linear-gradient(90deg, #064e3b, #065f46)'
            : 'linear-gradient(90deg, #1e293b, #0f172a)',
          color: 'white',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          animation: visible
            ? 'bannerSlideDown 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) both'
            : 'bannerSlideUp 0.28s cubic-bezier(0.55, 0, 1, 0.45) both',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}
      >
        <span style={{ fontSize: '15px' }}>{backOnline ? '✅' : '📡'}</span>
        {backOnline
          ? 'Connexion rétablie'
          : 'Pas de connexion — les modifications seront sauvegardées dès le retour en ligne'
        }
      </div>
    </>
  )
}

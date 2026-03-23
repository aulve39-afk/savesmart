'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Barre de progression fine en haut de l'écran, déclenchée à chaque
 * changement de route. Mimique le comportement de NProgress sans dépendance.
 *
 * Comportement :
 *  - Au changement de pathname → démarre à 0%, monte rapidement à 30%,
 *    puis progresse doucement jusqu'à 85%, puis complète à 100%.
 *  - La barre disparaît avec un fondu après la complétion.
 */
export default function TopProgressBar() {
  const pathname = usePathname()
  const [width, setWidth]     = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef              = useRef<NodeJS.Timeout[]>([])

  const clear = () => {
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
  }

  useEffect(() => {
    clear()

    // Phase 1 — démarrage visible immédiat
    setWidth(0)
    setVisible(true)

    const t1 = setTimeout(() => setWidth(30),  60)   // saut rapide à 30%
    const t2 = setTimeout(() => setWidth(60),  200)  // progression douce
    const t3 = setTimeout(() => setWidth(85),  450)  // ralentit volontairement
    const t4 = setTimeout(() => setWidth(100), 600)  // complétion
    const t5 = setTimeout(() => setVisible(false), 900) // fondu de sortie

    timerRef.current = [t1, t2, t3, t4, t5]
    return clear
  }, [pathname])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: visible ? 'none' : 'opacity 0.25s ease',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7)',
          backgroundSize: '200% 100%',
          borderRadius: '0 3px 3px 0',
          boxShadow: '0 0 8px rgba(79, 70, 229, 0.6)',
          transition: width === 0
            ? 'none'
            : width === 100
              ? 'width 0.18s ease-out'
              : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  )
}

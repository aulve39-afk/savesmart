'use client'
import { useEffect } from 'react'

/**
 * Hook partagé : fait défiler automatiquement le champ actif en vue
 * quand le clavier virtuel (iOS / Android) s'ouvre.
 *
 * Stratégie :
 *  1. window.visualViewport 'resize' — API moderne qui reflète exactement
 *     la zone visible hors clavier. Réagit à l'animation d'ouverture du clavier.
 *  2. Fallback 'focusin' + setTimeout(350ms) pour les anciens navigateurs
 *     sans visualViewport (< iOS 13, Android WebView).
 */
export function useKeyboardScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // ── Stratégie 1 : visualViewport (iOS 13+, Chrome 61+) ──
    if (window.visualViewport) {
      const handleResize = () => {
        const el = document.activeElement as HTMLElement | null
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
          setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
        }
      }
      window.visualViewport.addEventListener('resize', handleResize)
      return () => window.visualViewport?.removeEventListener('resize', handleResize)
    }

    // ── Stratégie 2 : focusin + timeout (fallback) ──
    const handleFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350)
      }
    }
    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
  }, [])
}

'use client'
import { useEffect } from 'react'

/**
 * Runs once on the client:
 *  1. Registers the Service Worker (web PWA)
 *  2. Configures native Status Bar + Keyboard when running inside Capacitor
 *  3. Prevents the iOS rubber-band scroll on the body (keeps it on scrollable containers)
 */
export default function PwaSetup() {
  useEffect(() => {
    // ── 1. Service Worker ────────────────────────────────────────────────────
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Notify the user when a new version is ready
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing
            if (!worker) return
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available — reload to activate
                // (could also show a toast here)
                worker.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          })
        })
        .catch(() => {
          // SW registration failure is non-critical
        })

      // Auto-reload when a new SW takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }

    // ── 2. Capacitor native plugins ──────────────────────────────────────────
    // Dynamic import avoids bundling Capacitor in the web build
    const setupCapacitor = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return

        // Status Bar
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
        await StatusBar.setBackgroundColor({ color: isDark ? '#1e293b' : '#ffffff' })
        await StatusBar.setOverlaysWebView({ overlay: false })

        // Keyboard: resize the body so content isn't hidden behind the keyboard
        const { Keyboard } = await import('@capacitor/keyboard')
        await Keyboard.setAccessoryBarVisible({ isVisible: false })
        await Keyboard.setScroll({ isDisabled: false })

        // Splash Screen: hide after the app is ready
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide({ fadeOutDuration: 300 })

        // Sync status bar color when the user changes colour scheme
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
          await StatusBar.setStyle({ style: e.matches ? Style.Dark : Style.Light })
          await StatusBar.setBackgroundColor({ color: e.matches ? '#1e293b' : '#ffffff' })
        })
      } catch {
        // Not in Capacitor or plugin not available — silently ignore
      }
    }

    setupCapacitor()

    // ── 3. iOS bounce-scroll fix ─────────────────────────────────────────────
    // Prevent the elastic over-scroll on <body> that makes the app feel "webby"
    const preventBodyScroll = (e: TouchEvent) => {
      if ((e.target as Element)?.closest('[data-scroll]')) return
      if (document.documentElement.scrollHeight <= window.innerHeight) {
        e.preventDefault()
      }
    }
    document.addEventListener('touchmove', preventBodyScroll, { passive: false })
    return () => document.removeEventListener('touchmove', preventBodyScroll)
  }, [])

  return null
}

'use client'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'klyp_install_dismissed'

export default function InstallBanner() {
  const [show, setShow] = useState<'android' | 'ios' | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Don't show if already dismissed or already running as PWA
    if (localStorage.getItem(DISMISSED_KEY)) return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return

    const ua = navigator.userAgent

    // Android Chrome — capture the native install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow('android')
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari — show manual instructions
    const isIos = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua)
    if (isIos && isSafari) {
      // Delay slightly so it doesn't compete with page load
      const t = setTimeout(() => setShow('ios'), 3000)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', handler) }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setShow(null)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
  }

  const installAndroid = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') dismiss()
    else setDeferredPrompt(null)
  }

  if (!show) return null

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  if (show === 'ios') {
    return (
      <div
        role="dialog"
        aria-label="Installer KLYP"
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '430px', zIndex: 9999,
          background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
          padding: '18px 20px calc(18px + env(safe-area-inset-bottom))',
          fontFamily: font,
          animation: 'slideUp 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <img src="/icons/icon.svg" alt="" width={48} height={48} style={{ borderRadius: '12px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: '800', fontSize: '15px', margin: '0 0 4px', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Installer KLYP
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: '1.45' }}>
              Appuie sur <strong>Partager</strong> <span style={{ fontSize: '15px' }}>⬆️</span> puis <strong>"Sur l'écran d'accueil"</strong> pour accéder à l'app comme une vraie application.
            </p>
            <button
              onClick={dismiss}
              style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
            >
              Ne plus afficher
            </button>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fermer"
            style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
        <style>{`
          @keyframes slideUp {
            from { transform: translateX(-50%) translateY(100%); opacity: 0; }
            to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // Android
  return (
    <div
      role="dialog"
      aria-label="Installer KLYP"
      style={{
        position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)', maxWidth: '398px', zIndex: 9999,
        background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border)',
        padding: '16px 18px',
        fontFamily: font,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        animation: 'slideUp 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <img src="/icons/icon.svg" alt="" width={44} height={44} style={{ borderRadius: '11px', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: '800', fontSize: '14px', margin: '0 0 2px', color: 'var(--text-primary)' }}>Installer KLYP</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Accès rapide depuis l'écran d'accueil</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={dismiss}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            Plus tard
          </button>
          <button
            onClick={installAndroid}
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: 'white' }}
          >
            Installer
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}

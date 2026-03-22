'use client'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') router.push('/')
  }, [status, router])

  const handleGoogle = async () => {
    setLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={{ fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <main style={{ fontFamily: font, minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

      {/* Logo + titre */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '22px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(79,70,229,0.3)' }}>
          💡
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px', color: 'var(--text-primary)', letterSpacing: '-0.8px' }}>SaveSmart</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.5' }}>
          Ton conseiller personnel en abonnements
        </p>
      </div>

      {/* Carte login */}
      <div style={{ width: '100%', maxWidth: '360px', background: 'var(--bg-card)', borderRadius: '24px', padding: '32px 28px', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <p style={{ fontWeight: '700', fontSize: '18px', margin: '0 0 6px', color: 'var(--text-primary)', textAlign: 'center' }}>Connecte-toi</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 28px', textAlign: 'center', lineHeight: '1.5' }}>
          Tes abonnements sont sauvegardés et accessibles partout
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? 'var(--bg-secondary)' : 'white',
            color: '#1e293b',
            border: '1.5px solid #e2e8f0',
            borderRadius: '14px',
            padding: '14px 20px',
            fontWeight: '700',
            fontSize: '15px',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'all 0.15s',
            fontFamily: font,
          }}
        >
          {loading ? (
            <span style={{ display: 'inline-block', width: '18px', height: '18px', border: '2px solid #94a3b8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
              <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
              <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
              <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.815 44 30.295 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
            </svg>
          )}
          {loading ? 'Connexion...' : 'Continuer avec Google'}
        </button>

        <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>SÉCURISÉ</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { icon: '🔒', text: 'Connexion via Google — aucun mot de passe' },
            { icon: '☁️', text: 'Abonnements synchronisés sur tous tes appareils' },
            { icon: '🚫', text: 'Tes données ne sont jamais revendues' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.4' }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features preview */}
      <div style={{ width: '100%', maxWidth: '360px', marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {[
          { icon: '📊', label: 'Dashboard', desc: 'Tous tes abonnements en un clin d\'œil' },
          { icon: '📎', label: 'Scan IA', desc: 'Analyse tes factures automatiquement' },
          { icon: '✂️', label: 'Résiliation', desc: 'Lettres juridiques générées par IA' },
          { icon: '👨‍👩‍👧‍👦', label: 'Partage', desc: 'Divise les coûts en famille' },
        ].map(f => (
          <div key={f.label} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '22px', display: 'block', marginBottom: '8px' }}>{f.icon}</span>
            <p style={{ fontWeight: '700', fontSize: '13px', margin: '0 0 3px', color: 'var(--text-primary)' }}>{f.label}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.4' }}>{f.desc}</p>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}

'use client'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Si déjà connecté → dashboard
  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={{ fontFamily: font, minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <main style={{ fontFamily: font, minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

      {/* Logo KLYP */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '24px',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 12px 40px rgba(79,70,229,0.4)',
        }}>
          <svg viewBox="0 0 512 512" width="44" height="44">
            <rect x="138" y="144" width="62" height="224" rx="18" fill="white"/>
            <path d="M194 256 L344 144 L382 144 L242 256 Z" fill="white"/>
            <path d="M194 256 L344 368 L382 368 L242 256 Z" fill="white"/>
            <circle cx="390" cy="182" r="20" fill="rgba(255,255,255,0.35)"/>
            <circle cx="390" cy="182" r="12" fill="white"/>
            <rect x="385" y="202" width="10" height="108" rx="5" fill="rgba(255,255,255,0.35)"/>
            <circle cx="390" cy="330" r="20" fill="rgba(255,255,255,0.35)"/>
            <circle cx="390" cy="330" r="12" fill="white"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.6px' }}>KLYP</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: '0' }}>Maîtrise tous tes abonnements</p>
      </div>

      {/* Value props */}
      <div style={{ width: '100%', maxWidth: '340px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[
          { icon: '📊', text: 'Vois tous tes abonnements en un coup d\'œil' },
          { icon: '🤖', text: 'L\'IA détecte et analyse tes factures' },
          { icon: '💡', text: 'Économise en moyenne 200 € par an' },
          { icon: '🔒', text: 'Données chiffrées, zéro revente' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', borderRadius: '12px', padding: '12px 16px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>{item.icon}</span>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontWeight: '500', lineHeight: '1.4' }}>{item.text}</p>
          </div>
        ))}
      </div>

      {/* Google Sign-In button */}
      <div style={{ width: '100%', maxWidth: '340px' }}>
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? 'var(--bg-secondary)' : 'white',
            border: '1.5px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px 20px',
            fontSize: '15px',
            fontWeight: '700',
            fontFamily: font,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#1e293b',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            transition: 'all 0.15s',
          }}
        >
          {loading ? (
            <div style={{ width: '20px', height: '20px', border: '2px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
          )}
          {loading ? 'Connexion...' : 'Continuer avec Google'}
        </button>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: '16px 0 0', lineHeight: '1.6' }}>
          En continuant, tu acceptes nos{' '}
          <a href="/cgu" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: '600' }}>CGU</a>
          {' '}et notre{' '}
          <a href="/confidentialite" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: '600' }}>politique de confidentialité</a>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}

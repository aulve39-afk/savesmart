'use client'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function LoginContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl)
    }
  }, [status, router, callbackUrl])

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div style={{ fontFamily: font, minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton" style={{ width: '280px', height: '52px', borderRadius: '14px' }} />
      </div>
    )
  }

  return (
    <main style={{ fontFamily: font, minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '360px', width: '100%' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>💰</div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.5px', fontFamily: font }}>SaveSmart</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '0 0 40px', fontFamily: font }}>Gérez vos abonnements intelligemment</p>

        <button
          onClick={() => signIn('google', { callbackUrl })}
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            borderRadius: '14px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            fontFamily: font,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
            <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/>
            <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
            <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
          </svg>
          Continuer avec Google
        </button>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '20px 0 0', lineHeight: '1.5', fontFamily: font }}>
          En vous connectant, vous acceptez nos{' '}
          <a href="/cgu" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>CGU</a>
          {' '}et notre{' '}
          <a href="/confidentialite" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>politique de confidentialité</a>.
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

'use client'
import { useRouter } from 'next/navigation'
import { useUserId } from '../hooks/useUserId'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export default function OnboardingPage() {
  const { user, isLoading } = useUserId()
  const router = useRouter()

  if (isLoading) {
    return (
      <div style={{ fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] ?? 'toi'

  return (
    <main style={{ fontFamily: font, minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '22px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(79,70,229,0.3)' }}>
          💡
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 8px', color: 'var(--text-primary)', letterSpacing: '-0.6px' }}>
          Bienvenue, {firstName} !
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.5', maxWidth: '300px' }}>
          Pour accéder à ton espace, importe d&apos;abord tes abonnements via l&apos;une de ces méthodes
        </p>
      </div>

      {/* Options */}
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <button
          onClick={() => router.push('/scan')}
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            borderRadius: '20px',
            padding: '24px 20px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s',
            fontFamily: font,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f46e5')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
              📎
            </div>
            <div>
              <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Scanner une facture</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.5' }}>
                Prends en photo ou importe une facture PDF — l&apos;IA détecte automatiquement l&apos;abonnement
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push('/releve')}
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            borderRadius: '20px',
            padding: '24px 20px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s',
            fontFamily: font,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f46e5')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
              🏦
            </div>
            <div>
              <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Analyser un relevé bancaire</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.5' }}>
                Importe ton relevé de compte — l&apos;IA identifie tous tes prélèvements récurrents
              </p>
            </div>
          </div>
        </button>

      </div>

      <p style={{ marginTop: '28px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '280px', lineHeight: '1.5' }}>
        Tes données restent privées et ne sont jamais revendues
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}

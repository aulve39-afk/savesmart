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

  return (
    <main style={{ fontFamily: font, minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

      {/* Barre de progression — Étape 1/2 */}
      <div style={{ width: '100%', maxWidth: '360px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Étape 1 sur 2</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Importer mes abonnements</span>
        </div>
        <div style={{ height: '4px', borderRadius: '4px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          <div style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '22px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(79,70,229,0.3)' }}>
          💡
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 10px', color: 'var(--text-primary)', letterSpacing: '-0.6px' }}>
          Économise 200 € par an
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: '1.5', maxWidth: '300px' }}>
          en moyenne sur tes abonnements — sans effort
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.5', maxWidth: '300px', opacity: 0.75 }}>
          Commence par importer tes abonnements via l&apos;une de ces méthodes
        </p>
      </div>

      {/* Comment ça marche — 3 étapes */}
      <div style={{ width: '100%', maxWidth: '360px', marginBottom: '28px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 14px', textAlign: 'center' }}>Comment ça marche</p>
        <div style={{ display: 'flex', gap: '0', position: 'relative' }}>
          {/* Ligne de connexion */}
          <div style={{ position: 'absolute', top: '20px', left: 'calc(16.66% + 10px)', right: 'calc(16.66% + 10px)', height: '2px', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', opacity: 0.2, zIndex: 0 }} />
          {[
            { icon: '📤', label: 'Importe', desc: 'Facture, photo ou relevé bancaire' },
            { icon: '🤖', label: "L'IA analyse", desc: 'Détection auto du montant et du service' },
            { icon: '💡', label: 'Tu économises', desc: 'Couper, comparer, partager' },
          ].map((step, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 4px 12px rgba(79,70,229,0.25)' }}>
                {step.icon}
              </div>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', margin: '0', textAlign: 'center' }}>{step.label}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0', textAlign: 'center', lineHeight: '1.4', padding: '0 4px' }}>{step.desc}</p>
            </div>
          ))}
        </div>
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

        <button
          onClick={() => router.push('/ajouter')}
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
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
              ✏️
            </div>
            <div>
              <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Ajouter manuellement</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.5' }}>
                Saisis directement le nom, le montant et la date de ton abonnement
              </p>
            </div>
          </div>
        </button>

      </div>

      {/* Badge sécurité */}
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '10px 16px', maxWidth: '360px', width: '100%' }}>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>🔒</span>
        <div>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 1px' }}>Données chiffrées · Zéro revente</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>Tes infos ne quittent jamais ton appareil et ne sont jamais partagées</p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}

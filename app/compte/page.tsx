'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSubscriptions, type Subscription } from '../store'
import { useUserId } from '../hooks/useUserId'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const MONTHS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']

function fmtDate(d: Date) {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export default function ComptePage() {
  const router = useRouter()
  const { userId, user, isLoading } = useUserId()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [showConfirmSignOut, setShowConfirmSignOut] = useState(false)

  useEffect(() => {
    if (userId) getSubscriptions(userId).then(setSubscriptions)
  }, [userId])

  if (isLoading || !userId) {
    return (
      <div style={{ fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)
  const annualTotal = total * 12
  const categories = [...new Set(subscriptions.map(s => s.category))]
  const initials = (user?.name ?? user?.email ?? '?').slice(0, 2).toUpperCase()
  const memberSince = subscriptions.length > 0
    ? fmtDate(new Date(subscriptions[subscriptions.length - 1].detected_at))
    : "Aujourd'hui"

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '52px 24px 28px', position: 'relative' }}>
        <button
          onClick={() => router.push('/')}
          style={{ position: 'absolute', top: '52px', left: '24px', width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >←</button>

        <div style={{ textAlign: 'center' }}>
          {/* Avatar */}
          {user?.image ? (
            <img
              src={user.image}
              alt="Avatar"
              style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', display: 'block', margin: '0 auto 14px', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '28px', fontWeight: '800', color: 'white', border: '3px solid rgba(255,255,255,0.3)' }}>
              {initials}
            </div>
          )}
          <p style={{ fontWeight: '800', fontSize: '20px', color: 'white', margin: '0 0 4px', letterSpacing: '-0.3px' }}>{user?.name ?? 'Utilisateur'}</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 14px' }}>{user?.email}</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '20px', padding: '4px 14px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>Membre depuis {memberSince}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[
            { value: subscriptions.length.toString(), label: 'Abonnements', icon: '📋' },
            { value: `${total.toFixed(0)} €`, label: 'Par mois', icon: '💳' },
            { value: `${annualTotal.toFixed(0)} €`, label: 'Par an', icon: '📅' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px 12px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <span style={{ fontSize: '22px', display: 'block', marginBottom: '8px' }}>{stat.icon}</span>
              <p style={{ fontWeight: '800', fontSize: '18px', margin: '0 0 3px', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{stat.value}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Catégories possédées */}
        {categories.length > 0 && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px', marginBottom: '12px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Mes catégories</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {categories.map(cat => {
                const icons: Record<string, string> = { streaming: '▶', telecom_box: '🌐', telecom_mobile: '📱', telecom: '📶', energie: '⚡', assurance: '🛡️', saas: '☁️', other: '●' }
                const labels: Record<string, string> = { streaming: 'Streaming', telecom_box: 'Box/Fibre', telecom_mobile: 'Mobile', telecom: 'Telecom', energie: 'Énergie', assurance: 'Assurance', saas: 'SaaS', other: 'Autre' }
                const total = subscriptions.filter(s => s.category === cat).reduce((sum, s) => sum + s.amount, 0)
                return (
                  <div key={cat} style={{ background: 'var(--bg-secondary)', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>{icons[cat] ?? '●'}</span>
                    {labels[cat] ?? cat}
                    <span style={{ opacity: 0.6 }}>· {total.toFixed(0)}€</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', margin: '0', padding: '14px 16px 10px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>Mon compte</p>
          {[
            { icon: '📊', label: 'Voir mes statistiques', action: () => router.push('/stats') },
            { icon: '📅', label: 'Calendrier des renouvellements', action: () => router.push('/calendrier') },
            { icon: '👨‍👩‍👧‍👦', label: 'Module partage famille', action: () => router.push('/partage') },
            { icon: '📋', label: 'Historique des économies', action: () => router.push('/historique') },
          ].map((item, i, arr) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
              <p style={{ flex: 1, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: '0' }}>{item.label}</p>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>›</span>
            </button>
          ))}
        </div>

        {/* Sign out */}
        {showConfirmSignOut ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <p style={{ fontWeight: '700', fontSize: '15px', color: '#dc2626', margin: '0 0 6px' }}>Se déconnecter ?</p>
            <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 16px' }}>Tu devras te reconnecter pour accéder à tes abonnements.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowConfirmSignOut(false)}
                style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >Annuler</button>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{ flex: 1, background: '#dc2626', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', color: 'white' }}
              >Se déconnecter</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmSignOut(true)}
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '18px' }}>🚪</span>
            <p style={{ flex: 1, fontSize: '14px', fontWeight: '600', color: '#dc2626', margin: '0' }}>Se déconnecter</p>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>›</span>
          </button>
        )}

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0 0' }}>
          SaveSmart · Tes données sont privées et sécurisées
        </p>
      </div>
    </main>
  )
}

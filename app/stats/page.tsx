'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSubscriptions, type Subscription } from '../store'
import { useOnboarding as useUserId } from '../hooks/useOnboarding'

const categoryConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  streaming:      { label: 'Streaming', icon: '▶', color: '#7c3aed', bg: '#f5f3ff' },
  telecom:        { label: 'Telecom',   icon: '📶', color: '#0284c7', bg: '#f0f9ff' },
  telecom_mobile: { label: 'Mobile',    icon: '📱', color: '#0284c7', bg: '#f0f9ff' },
  telecom_box:    { label: 'Box/Fibre', icon: '🌐', color: '#0369a1', bg: '#e0f2fe' },
  energie:        { label: 'Energie',   icon: '⚡', color: '#d97706', bg: '#fffbeb' },
  assurance:      { label: 'Assurance', icon: '🛡', color: '#059669', bg: '#f0fdf4' },
  saas:           { label: 'SaaS',      icon: '☁', color: '#db2777', bg: '#fdf2f8' },
  other:          { label: 'Autre',     icon: '●',  color: '#6b7280', bg: '#f9fafb' },
}

export default function StatsPage() {
  const router = useRouter()
  const { userId, isLoading } = useUserId()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  useEffect(() => {
  if (userId) getSubscriptions(userId).then(setSubscriptions)
}, [userId])

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)
  const totalYear = total * 12

  const byCategory = Object.entries(
    subscriptions.reduce((acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + s.amount
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  const maxAmount = byCategory[0]?.[1] || 1

  const mostExpensive = [...subscriptions].sort((a, b) => b.amount - a.amount)[0]

  if (isLoading || !userId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Statistiques</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Vue globale de tes depenses</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {subscriptions.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '32px', margin: '0 0 8px' }}>📊</p>
            <p style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Aucune donnee</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Scanne des factures pour voir tes stats</p>
          </div>
        ) : (
          <>
            {/* Cartes résumé */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '16px', padding: '18px', color: 'white' }}>
                <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Par mois</p>
                <p style={{ fontSize: '24px', fontWeight: '800', margin: '0', letterSpacing: '-0.5px' }}>{total.toFixed(0)} €</p>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', borderRadius: '16px', padding: '18px', color: 'white' }}>
                <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Par an</p>
                <p style={{ fontSize: '24px', fontWeight: '800', margin: '0', letterSpacing: '-0.5px' }}>{totalYear.toFixed(0)} €</p>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '18px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Abonnements</p>
                <p style={{ fontSize: '24px', fontWeight: '800', margin: '0', color: 'var(--text-primary)' }}>{subscriptions.length}</p>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '18px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Moyenne</p>
                <p style={{ fontSize: '24px', fontWeight: '800', margin: '0', color: 'var(--text-primary)' }}>{(total / subscriptions.length).toFixed(0)} €</p>
              </div>
            </div>

            {/* Graphique par catégorie */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 16px' }}>Par categorie</p>
              {byCategory.map(([cat, amount]) => {
                const config = categoryConfig[cat] || categoryConfig.other
                const pct = Math.round((amount / maxAmount) * 100)
                return (
                  <div key={cat} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{config.icon}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{config.label}</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{amount.toFixed(2)} €</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: config.color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Plus cher */}
            {mostExpensive && (
              <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 12px' }}>Abonnement le plus couteux</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{mostExpensive.company_name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
                      {((mostExpensive.amount / total) * 100).toFixed(0)}% de ton budget mensuel
                    </p>
                  </div>
                  <p style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626', margin: '0' }}>
                    {mostExpensive.amount.toFixed(2)} €
                  </p>
                </div>
              </div>
            )}

            {/* Répartition visuelle */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 14px' }}>Repartition du budget</p>
              <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
                {byCategory.map(([cat, amount]) => {
                  const config = categoryConfig[cat] || categoryConfig.other
                  const pct = (amount / total) * 100
                  return (
                    <div key={cat} style={{ width: pct + '%', background: config.color }} />
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {byCategory.map(([cat, amount]) => {
                  const config = categoryConfig[cat] || categoryConfig.other
                  const pct = ((amount / total) * 100).toFixed(0)
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.color }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{config.label} {pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
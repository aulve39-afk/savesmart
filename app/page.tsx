'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions, removeSubscription, type Subscription } from './store'

const categoryConfig: Record<string, { label: string; icon: string; color: string; bg: string; darkBg: string }> = {
  streaming: { label: 'Streaming', icon: '▶', color: '#7c3aed', bg: '#f5f3ff', darkBg: '#2e1065' },
  telecom:   { label: 'Telecom',   icon: '📶', color: '#0284c7', bg: '#f0f9ff', darkBg: '#0c4a6e' },
  energie:   { label: 'Energie',   icon: '⚡', color: '#d97706', bg: '#fffbeb', darkBg: '#451a03' },
  assurance: { label: 'Assurance', icon: '🛡', color: '#059669', bg: '#f0fdf4', darkBg: '#052e16' },
  saas:      { label: 'SaaS',      icon: '☁', color: '#db2777', bg: '#fdf2f8', darkBg: '#4a044e' },
  other:     { label: 'Autre',     icon: '●',  color: '#6b7280', bg: '#f9fafb', darkBg: '#1f2937' },
}

const cycleLabel: Record<string, string> = {
  monthly: '/mois', yearly: '/an', quarterly: '/trim.', one_time: '', unknown: '',
}

export default function Home() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const router = useRouter()

  useEffect(() => {
    setSubscriptions(getSubscriptions())
  }, [])

  const handleRemove = (id: string) => {
    removeSubscription(id)
    setSubscriptions(getSubscriptions())
  }

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 2px' }}>Bonjour 👋</p>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>SaveSmart</h1>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '20px', padding: '28px 24px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: '-30px', right: '40px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total mensuel</p>
          <p style={{ fontSize: '42px', fontWeight: '800', margin: '0 0 4px', letterSpacing: '-1px' }}>
            {total.toFixed(2)}<span style={{ fontSize: '20px', fontWeight: '400', opacity: 0.7 }}> €</span>
          </p>
          <p style={{ fontSize: '13px', opacity: 0.5, margin: '0' }}>
            {subscriptions.length} abonnement{subscriptions.length !== 1 ? 's' : ''} detecte{subscriptions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={{ padding: '16px 16px 4px' }}>
        <button onClick={() => router.push('/scan')} style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📷</span>
          Scanner une facture
        </button>
      </div>

      <div style={{ padding: '8px 16px 16px' }}>
        <button onClick={() => router.push('/gmail')} style={{ width: '100%', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '16px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📧</span>
          Scanner mes emails Gmail
        </button>
      </div>

      <div style={{ padding: '0 16px' }}>
        {subscriptions.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>📄</div>
            <p style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Aucun abonnement</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Scanne une facture pour commencer</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '8px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Abonnements
            </p>
            {subscriptions.map((sub) => {
              const config = categoryConfig[sub.category] || categoryConfig.other
              return (
                <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {config.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: config.color, background: config.bg, padding: '2px 8px', borderRadius: '6px' }}>
                        {config.label}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: '700', fontSize: '16px', margin: '0', color: 'var(--text-primary)' }}>{sub.amount.toFixed(2)} €</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>{cycleLabel[sub.billing_cycle] || ''}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => router.push('/compare?name=' + sub.company_name + '&amount=' + sub.amount + '&category=' + sub.category + '&details=' + encodeURIComponent(JSON.stringify(sub.details || {})))}
                      style={{ flex: 1, background: '#f5f3ff', border: 'none', borderRadius: '10px', padding: '9px', color: '#7c3aed', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Comparer
                    </button>
                    <button
                      onClick={() => router.push('/resiliation?name=' + sub.company_name)}
                      style={{ flex: 1, background: '#fef2f2', border: 'none', borderRadius: '10px', padding: '9px', color: '#dc2626', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Resilier
                    </button>
                    <button
                      onClick={() => handleRemove(sub.id)}
                      style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '10px', padding: '9px 12px', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </main>
  )
}
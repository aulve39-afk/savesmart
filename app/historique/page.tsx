'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSubscriptions, type Subscription } from '../store'

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

const alternatives: Record<string, { price: number }[]> = {
  telecom:   [{ price: 9.99 }, { price: 7.99 }, { price: 6.99 }],
  streaming: [{ price: 5.99 }, { price: 4.99 }, { price: 5.99 }],
  energie:   [{ price: 74.00 }, { price: 71.00 }, { price: 68.00 }],
  assurance: [{ price: 4.90 }, { price: 5.90 }, { price: 6.90 }],
  saas:      [{ price: 0 }, { price: 5.75 }, { price: 3.00 }],
  other:     [{ price: 0 }],
}

export default function HistoriquePage() {
  const router = useRouter()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  useEffect(() => {
  getSubscriptions().then(setSubscriptions)
}, [])

  const economies = subscriptions.map(sub => {
    const offers = alternatives[sub.category] || alternatives.other
    const bestPrice = Math.min(...offers.map(o => o.price))
    const saving = sub.amount - bestPrice
    return { ...sub, bestPrice, saving: saving > 0 ? saving : 0 }
  }).filter(s => s.saving > 0)

  const totalSavingMonthly = economies.reduce((sum, s) => sum + s.saving, 0)
  const totalSavingYearly = totalSavingMonthly * 12

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Economies potentielles</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Si tu switches vers les meilleures offres</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {economies.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '32px', margin: '0 0 8px' }}>💰</p>
            <p style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Aucune economie detectee</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Tes abonnements sont deja optimaux !</p>
          </div>
        ) : (
          <>
            {/* Carte total économies */}
            <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', borderRadius: '20px', padding: '28px 24px', color: 'white', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Tu pourrais economiser</p>
              <p style={{ fontSize: '42px', fontWeight: '800', margin: '0 0 4px', letterSpacing: '-1px' }}>
                {totalSavingMonthly.toFixed(2)}<span style={{ fontSize: '20px', fontWeight: '400', opacity: 0.7 }}> €/mois</span>
              </p>
              <p style={{ fontSize: '15px', opacity: 0.7, margin: '0' }}>
                soit {totalSavingYearly.toFixed(0)} € par an
              </p>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Detail par abonnement
            </p>

            {economies.map(sub => {
              const config = categoryConfig[sub.category] || categoryConfig.other
              return (
                <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {config.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
                        Actuel : {sub.amount.toFixed(2)} € → Meilleur : {sub.bestPrice.toFixed(2)} €
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: '700', fontSize: '16px', margin: '0', color: '#16a34a' }}>
                        -{sub.saving.toFixed(2)} €
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>/mois</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/compare?name=' + sub.company_name + '&amount=' + sub.amount + '&category=' + sub.category + '&details=' + encodeURIComponent(JSON.stringify(sub.details || {})))}
                    style={{ width: '100%', background: '#f5f3ff', border: 'none', borderRadius: '10px', padding: '10px', color: '#7c3aed', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Voir les alternatives
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>
    </main>
  )
}
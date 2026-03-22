'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions, removeSubscription, type Subscription } from './store'

const competitorGroups: { name: string; keywords: string[] }[] = [
  { name: 'Musique', keywords: ['spotify', 'deezer', 'apple music', 'tidal', 'amazon music', 'youtube music', 'qobuz'] },
  { name: 'Streaming video', keywords: ['netflix', 'disney', 'amazon prime', 'canal+', 'hulu', 'apple tv', 'paramount', 'salto', 'ocs', 'max'] },
  { name: 'Stockage cloud', keywords: ['dropbox', 'google drive', 'icloud', 'onedrive', 'box', 'mega'] },
  { name: 'Bureautique', keywords: ['microsoft 365', 'google workspace', 'notion', 'zoho', 'office'] },
  { name: 'Telecom mobile', keywords: ['free', 'sfr', 'orange', 'bouygues', 'sosh', 'red', 'prixtel', 'nrj mobile'] },
  { name: 'Energie', keywords: ['edf', 'engie', 'totalenergies', 'vattenfall', 'ohm', 'ekwateur'] },
  { name: 'Livraison repas', keywords: ['deliveroo', 'uber eats', 'just eat', 'frichti'] },
]

function detectDoublons(subs: Subscription[]): { group: string; names: string[] }[] {
  const alerts: { group: string; names: string[] }[] = []
  for (const group of competitorGroups) {
    const matches = subs.filter(s => group.keywords.some(kw => s.company_name.toLowerCase().includes(kw)))
    if (matches.length >= 2) alerts.push({ group: group.name, names: matches.map(m => m.company_name) })
  }
  return alerts
}

const categoryConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  streaming:      { label: 'Streaming',  icon: '▶', color: '#7c3aed', bg: '#f5f3ff' },
  telecom:        { label: 'Telecom',    icon: '📶', color: '#0284c7', bg: '#f0f9ff' },
  telecom_mobile: { label: 'Mobile',     icon: '📱', color: '#0284c7', bg: '#f0f9ff' },
  telecom_box:    { label: 'Box/Fibre',  icon: '🌐', color: '#0369a1', bg: '#e0f2fe' },
  energie:        { label: 'Energie',    icon: '⚡', color: '#d97706', bg: '#fffbeb' },
  assurance:      { label: 'Assurance',  icon: '🛡', color: '#059669', bg: '#f0fdf4' },
  saas:           { label: 'SaaS',       icon: '☁', color: '#db2777', bg: '#fdf2f8' },
  other:          { label: 'Autre',      icon: '●',  color: '#6b7280', bg: '#f9fafb' },
}

const cycleLabel: Record<string, string> = {
  monthly: '/mois', yearly: '/an', quarterly: '/trim.', one_time: '', unknown: '',
}

type SortOption = 'amount_desc' | 'amount_asc' | 'name_asc' | 'recent'
type FilterOption = 'all' | 'streaming' | 'telecom' | 'telecom_mobile' | 'telecom_box' | 'energie' | 'assurance' | 'saas' | 'other'

export default function Home() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [sort, setSort] = useState<SortOption>('amount_desc')
  const [filter, setFilter] = useState<FilterOption>('all')
  const [showFilters, setShowFilters] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getSubscriptions().then(setSubscriptions)
  }, [])

  const handleRemove = async (id: string) => {
    await removeSubscription(id)
    getSubscriptions().then(setSubscriptions)
  }

  const filtered = subscriptions
    .filter(s => filter === 'all' || s.category === filter)
    .sort((a, b) => {
      if (sort === 'amount_desc') return b.amount - a.amount
      if (sort === 'amount_asc') return a.amount - b.amount
      if (sort === 'name_asc') return a.company_name.localeCompare(b.company_name)
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    })

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  const categories = [...new Set(subscriptions.map(s => s.category))]
  const doublons = detectDoublons(subscriptions)

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 2px' }}>Bonjour 👋</p>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>SaveSmart</h1>
          </div>
          <button onClick={() => router.push('/stats')} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>📊</span>
            Stats
          </button>
        </div>
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

      <div style={{ padding: '4px 16px' }}>
        <button onClick={() => router.push('/gmail')} style={{ width: '100%', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '14px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📧</span>
          Scanner mes emails Gmail
        </button>
      </div>

      <div style={{ padding: '4px 16px 16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => router.push('/ajouter')} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '12px 6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '14px' }}>➕</span>
          Ajouter
        </button>
        <button onClick={() => router.push('/releve')} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '12px 6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '14px' }}>🏦</span>
          Releve
        </button>
        <button onClick={() => router.push('/historique')} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '12px 6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '14px' }}>💰</span>
          Economies
        </button>
        <button onClick={() => router.push('/partage')} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '12px 6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '14px' }}>👨‍👩‍👧‍👦</span>
          Partage
        </button>
      </div>

      <div style={{ padding: '0 16px' }}>
        {doublons.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', color: '#d97706', fontWeight: '700', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Doublons detectes</p>
            {doublons.map((d, i) => (
              <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '700', fontSize: '14px', color: '#92400e', margin: '0 0 4px' }}>{d.group} — services en double</p>
                  <p style={{ fontSize: '13px', color: '#b45309', margin: '0 0 10px' }}>Tu paies pour : {d.names.join(' et ')}</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => router.push('/compare?name=' + d.names[0] + '&amount=0&category=streaming&details=%7B%7D')} style={{ background: '#fef3c7', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#92400e', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Comparer</button>
                    <button onClick={() => router.push('/resiliation?name=' + d.names[1])} style={{ background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#dc2626', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Resilier un doublon</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {subscriptions.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>📄</div>
            <p style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Aucun abonnement</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Scanne une facture pour commencer</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {filtered.length} abonnement{filtered.length !== 1 ? 's' : ''}
              </p>
              <button onClick={() => setShowFilters(!showFilters)} style={{ background: showFilters ? '#4f46e5' : 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: showFilters ? 'white' : 'var(--text-primary)' }}>
                Filtrer / Trier
              </button>
            </div>

            {showFilters && (
              <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '16px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Trier par</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {([['amount_desc', 'Plus cher'], ['amount_asc', 'Moins cher'], ['name_asc', 'A Z'], ['recent', 'Recent']] as [SortOption, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => setSort(val)} style={{ background: sort === val ? '#4f46e5' : 'var(--bg-secondary)', color: sort === val ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Filtrer par</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button onClick={() => setFilter('all')} style={{ background: filter === 'all' ? '#4f46e5' : 'var(--bg-secondary)', color: filter === 'all' ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Tous</button>
                  {categories.map(cat => {
                    const config = categoryConfig[cat] || categoryConfig.other
                    return (
                      <button key={cat} onClick={() => setFilter(cat as FilterOption)} style={{ background: filter === cat ? config.color : 'var(--bg-secondary)', color: filter === cat ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                        {config.icon} {config.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {filtered.map((sub) => {
              const config = categoryConfig[sub.category] || categoryConfig.other
              return (
                <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{config.icon}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: config.color, background: config.bg, padding: '2px 8px', borderRadius: '6px' }}>{config.label}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: '700', fontSize: '16px', margin: '0', color: 'var(--text-primary)' }}>{sub.amount.toFixed(2)} €</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>{cycleLabel[sub.billing_cycle] || ''}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => router.push('/compare?name=' + sub.company_name + '&amount=' + sub.amount + '&category=' + sub.category + '&details=' + encodeURIComponent(JSON.stringify(sub.details || {})))} style={{ flex: 1, background: '#f5f3ff', border: 'none', borderRadius: '10px', padding: '9px', color: '#7c3aed', fontSize: '12px', cursor: 'pointer', fontWeight: '600', minWidth: '70px' }}>Comparer</button>
                    <button onClick={() => router.push('/resiliation?name=' + sub.company_name)} style={{ flex: 1, background: '#fef2f2', border: 'none', borderRadius: '10px', padding: '9px', color: '#dc2626', fontSize: '12px', cursor: 'pointer', fontWeight: '600', minWidth: '70px' }}>Resilier</button>
                    <button onClick={() => handleRemove(sub.id)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '10px', padding: '9px 12px', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>✕</button>
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
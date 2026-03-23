'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions, removeSubscription, addSubscription, type Subscription } from './store'
import { useOnboarding as useUserId } from './hooks/useOnboarding'

const competitorGroups: { name: string; keywords: string[] }[] = [
  { name: 'Musique', keywords: ['spotify', 'deezer', 'apple music', 'tidal', 'amazon music', 'youtube music', 'qobuz'] },
  { name: 'Streaming video', keywords: ['netflix', 'disney', 'amazon prime', 'canal+', 'hulu', 'apple tv', 'paramount', 'salto', 'ocs', 'max'] },
  { name: 'Stockage cloud', keywords: ['dropbox', 'google drive', 'icloud', 'onedrive', 'box', 'mega'] },
  { name: 'Bureautique', keywords: ['microsoft 365', 'google workspace', 'notion', 'zoho', 'office'] },
  { name: 'Telecom mobile', keywords: ['free', 'sfr', 'orange', 'bouygues', 'sosh', 'red', 'prixtel', 'nrj mobile'] },
  { name: 'Energie', keywords: ['edf', 'engie', 'totalenergies', 'vattenfall', 'ohm', 'ekwateur'] },
  { name: 'Livraison repas', keywords: ['deliveroo', 'uber eats', 'just eat', 'frichti'] },
]

type DoublonAlert = { group: string; names: string[]; subIds: string[]; type: 'same_operator' | 'competitors' }

function detectDoublons(subs: Subscription[]): DoublonAlert[] {
  const alerts: DoublonAlert[] = []
  for (const group of competitorGroups) {
    const matches = subs.filter(s => group.keywords.some(kw => s.company_name.toLowerCase().includes(kw)))
    if (matches.length >= 2) {
      // Si tous les abonnements partagent le même mot-clé → même opérateur (ex: Bouygues Box + Bouygues Mobile)
      // Sinon → services concurrents (ex: Spotify + Deezer)
      const matchedKws = matches.map(m => group.keywords.find(kw => m.company_name.toLowerCase().includes(kw)))
      const uniqueKws = new Set(matchedKws.filter(Boolean))
      alerts.push({
        group: group.name,
        names: matches.map(m => m.company_name),
        subIds: matches.map(m => m.id),
        type: uniqueKws.size === 1 ? 'same_operator' : 'competitors',
      })
    }
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

const MONTHS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']

function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

function daysUntil(d: Date): number {
  const now = new Date(); now.setHours(0,0,0,0)
  return Math.ceil((d.getTime() - now.getTime()) / 86400000)
}

function getNextRenewal(sub: Subscription): Date | null {
  if (sub.billing_cycle === 'one_time' || sub.billing_cycle === 'unknown') return null
  const now = new Date(); now.setHours(0,0,0,0)
  const d = new Date(sub.detected_at)
  if (sub.billing_cycle === 'monthly')   { while (d <= now) d.setMonth(d.getMonth() + 1) }
  if (sub.billing_cycle === 'yearly')    { while (d <= now) d.setFullYear(d.getFullYear() + 1) }
  if (sub.billing_cycle === 'quarterly') { while (d <= now) d.setMonth(d.getMonth() + 3) }
  return d
}

// Catalogue partage pour les suggestions contextuelles
const SHAREABLE_CATALOG = [
  { keywords: ['spotify'],                   label: 'Spotify',         tip: 'jusqu\'à 3 €/mois/personne avec la formule Famille' },
  { keywords: ['netflix'],                   label: 'Netflix',         tip: 'partage avec 1 proche hors foyer (+5.99 €/mois)' },
  { keywords: ['disney'],                    label: 'Disney+',         tip: 'jusqu\'à 4 profils simultanés dans le foyer' },
  { keywords: ['deezer'],                    label: 'Deezer',          tip: 'jusqu\'à 3 €/mois/personne avec la formule Famille' },
  { keywords: ['youtube premium'],           label: 'YouTube Premium', tip: 'jusqu\'à 3.83 €/mois/personne avec la formule Famille' },
  { keywords: ['apple tv', 'icloud'],        label: 'Apple',           tip: 'partage automatique via le Partage familial Apple' },
  { keywords: ['microsoft 365', 'office 365'], label: 'Microsoft 365', tip: 'jusqu\'à 1.67 €/mois/personne avec la formule Famille' },
  { keywords: ['amazon prime'],              label: 'Amazon Prime',    tip: 'partage inclus avec 1 membre adulte du foyer' },
  { keywords: ['canal+', 'canal plus'],      label: 'Canal+',          tip: 'jusqu\'à 4 profils dans le foyer' },
]

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxSize = 1024
      let w = img.width, h = img.height
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = (h * maxSize) / w; w = maxSize }
        else { w = (w * maxSize) / h; h = maxSize }
      }
      canvas.width = w; canvas.height = h
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = url
  })
}

export default function Home() {
  const { userId, user, isLoading } = useUserId()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [sort, setSort] = useState<SortOption>('amount_desc')
  const [filter, setFilter] = useState<FilterOption>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [scanExpanded, setScanExpanded] = useState(false)
  const [groupedDoublons, setGroupedDoublons] = useState<number[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanAdded, setScanAdded] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  useEffect(() => { if (userId) getSubscriptions(userId).then(setSubscriptions) }, [userId])

  const reload = () => { if (userId) getSubscriptions(userId).then(setSubscriptions) }

  const handleRemove = async (id: string) => {
    if (!userId) return
    await removeSubscription(id, userId)
    reload()
  }

  const handleScanFile = async (file: File) => {
    setScanResult(null)
    setScanError(null)
    setScanAdded(false)
    setScanning(true)
    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setScanResult(data)
    } catch {
      setScanError("Impossible d'analyser ce fichier. Réessaie avec une image plus nette.")
    } finally {
      setScanning(false)
    }
  }

  const handleAddFromScan = async () => {
    if (!scanResult || !userId) return
    await addSubscription({
      company_name: scanResult.company_name,
      amount: scanResult.amount,
      billing_cycle: scanResult.billing_cycle,
      category: scanResult.category,
      details: scanResult.details || {},
    }, userId)
    setScanAdded(true)
    reload()
  }

  if (isLoading || !userId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const filtered = subscriptions
    .filter(s => filter === 'all' || s.category === filter)
    .sort((a, b) => {
      if (sort === 'amount_desc') return b.amount - a.amount
      if (sort === 'amount_asc') return a.amount - b.amount
      if (sort === 'name_asc') return a.company_name.localeCompare(b.company_name)
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    })

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)
  const categories = [...new Set(subscriptions.map(s => s.category))]
  const doublons = detectDoublons(subscriptions)

  // Économies potentielles via partage famille (estimation ~50% pour les services éligibles)
  const ecoSavings = subscriptions.reduce((sum, sub) => {
    const match = SHAREABLE_CATALOG.find(e => e.keywords.some(kw => sub.company_name.toLowerCase().includes(kw)))
    return match ? sum + sub.amount * 0.5 : sum
  }, 0)

  // Widget conseillère — alerte la plus urgente
  const nextAlert = (() => {
    // 1. Essai gratuit qui se termine bientôt
    const trials = subscriptions
      .filter(s => s.details?.is_trial && s.details?.trial_end_date)
      .map(s => ({ sub: s, date: new Date(s.details!.trial_end_date), type: 'trial' as const }))
      .filter(t => daysUntil(t.date) >= 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    if (trials.length > 0) return trials[0]
    // 2. Prochain prélèvement
    const renewals = subscriptions
      .map(s => ({ sub: s, date: getNextRenewal(s), type: 'renewal' as const }))
      .filter((r): r is { sub: Subscription; date: Date; type: 'renewal' } => r.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    if (renewals.length > 0) return renewals[0]
    return null
  })()

  // Suggestion de partage — premier abonnement compatible trouvé
  const shareableSuggestion = (() => {
    for (const entry of SHAREABLE_CATALOG) {
      const match = subscriptions.find(s =>
        entry.keywords.some(kw => s.company_name.toLowerCase().includes(kw))
      )
      if (match) return { sub: match, label: entry.label, tip: entry.tip }
    }
    return null
  })()

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 2px' }}>Bonjour 👋</p>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>SaveSmart</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => router.push('/stats')} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px' }}>📊</span>Stats
            </button>
            <button
              onClick={() => router.push('/compte')}
              style={{ width: '38px', height: '38px', borderRadius: '50%', border: '2px solid #4f46e5', cursor: 'pointer', padding: '0', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <span style={{ color: 'white', fontSize: '14px', fontWeight: '800' }}>👤</span>
            </button>
          </div>
        </div>
      </div>

      {/* Total card */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '20px', padding: '28px 24px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: '-30px', right: '40px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total mensuel</p>
          <p style={{ fontSize: '42px', fontWeight: '800', margin: '0 0 4px', letterSpacing: '-1px' }}>
            {total.toFixed(2)}<span style={{ fontSize: '20px', fontWeight: '400', opacity: 0.7 }}> €</span>
          </p>
          <p style={{ fontSize: '13px', opacity: 0.75, margin: '0', fontWeight: '700' }}>
            {subscriptions.length} abonnement{subscriptions.length !== 1 ? 's' : ''} · {(total * 12).toFixed(0)} €/an
          </p>
        </div>
      </div>

      {/* ── WIDGET CONSEILLÈRE ── */}
      {nextAlert && (
        <div style={{ padding: '12px 16px 0' }}>
          {nextAlert.type === 'trial' ? (
            <div
              onClick={() => router.push('/calendrier')}
              style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <span style={{ fontSize: '22px', flexShrink: 0 }}>🚨</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Alerte essai gratuit</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', margin: '0' }}>
                  Ton essai <strong>{nextAlert.sub.company_name}</strong> se termine le {fmtDate(nextAlert.date)}
                  {' '}({nextAlert.sub.amount.toFixed(2)} €{cycleLabel[nextAlert.sub.billing_cycle] || ''})
                </p>
                <p style={{ fontSize: '11px', color: '#b91c1c', margin: '3px 0 0' }}>
                  {daysUntil(nextAlert.date) === 0 ? "Aujourd'hui !" : daysUntil(nextAlert.date) === 1 ? 'Demain !' : `Dans ${daysUntil(nextAlert.date)} jours`} · Tape pour agir →
                </p>
              </div>
            </div>
          ) : (
            <div
              onClick={() => router.push('/calendrier')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <span style={{ fontSize: '20px', flexShrink: 0 }}>📅</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Prochain prélèvement</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '0' }}>
                  <strong>{nextAlert.sub.company_name}</strong> — {nextAlert.sub.amount.toFixed(2)} €
                  {cycleLabel[nextAlert.sub.billing_cycle] || ''}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                  Le {fmtDate(nextAlert.date)} · {daysUntil(nextAlert.date) === 0 ? "Aujourd'hui" : daysUntil(nextAlert.date) === 1 ? 'Demain' : `Dans ${daysUntil(nextAlert.date)} jours`} · Voir le calendrier →
                </p>
              </div>
              <p style={{ fontWeight: '800', fontSize: '16px', color: '#4f46e5', margin: '0', flexShrink: 0 }}>{nextAlert.sub.amount.toFixed(2)} €</p>
            </div>
          )}
        </div>
      )}

      {/* ── SUGGESTION PARTAGE ── */}
      {shareableSuggestion && (
        <div style={{ padding: '8px 16px 0' }}>
          <div
            onClick={() => router.push('/partage')}
            style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <span style={{ fontSize: '20px', flexShrink: 0 }}>💡</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Astuce partage</p>
              <p style={{ fontSize: '13px', fontWeight: '600', color: '#166534', margin: '0' }}>
                Partage ton <strong>{shareableSuggestion.label}</strong> avec ta famille
              </p>
              <p style={{ fontSize: '11px', color: '#16a34a', margin: '3px 0 0' }}>
                {shareableSuggestion.tip} · Voir le module →
              </p>
            </div>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>👨‍👩‍👧‍👦</span>
          </div>
        </div>
      )}

      {/* ── SUPER-BARRE DE SCAN ── */}
      <div style={{ padding: '16px 16px 4px' }}>

        {/* Compact row when subscriptions exist and bar not expanded */}
        {subscriptions.length > 0 && !scanExpanded && !scanning && (
          <button
            onClick={() => setScanExpanded(true)}
            style={{ width: '100%', background: 'var(--bg-card)', border: '1.5px dashed var(--border)', borderRadius: '16px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', marginBottom: '0' }}
          >
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>📎</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '700', fontSize: '13px', margin: '0', color: 'var(--text-primary)' }}>Scanner une facture</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>PDF, screenshot ou photo</p>
            </div>
            <span style={{ fontSize: '20px', color: '#4f46e5', fontWeight: '300' }}>+</span>
          </button>
        )}

        {/* Full scan bar */}
        {(subscriptions.length === 0 || scanExpanded || scanning) && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault(); setIsDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleScanFile(file)
          }}
          style={{
            background: isDragging ? '#ede9fe' : 'var(--bg-card)',
            borderRadius: '20px',
            border: isDragging ? '2px dashed #7c3aed' : '2px dashed var(--border)',
            padding: '18px 20px',
            transition: 'all 0.15s',
          }}
        >
          {/* Bar header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📎</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 2px', color: isDragging ? '#7c3aed' : 'var(--text-primary)' }}>
                {isDragging ? 'Relâche pour analyser' : 'Glisse ta facture ici'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
                {scanning ? '⏳ Analyse en cours par IA...' : 'PDF, screenshot, photo — ou utilise les boutons'}
              </p>
            </div>
          </div>

          {/* Action chips */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => { if (cameraRef.current) { cameraRef.current.accept = 'image/*'; cameraRef.current.setAttribute('capture', 'environment'); cameraRef.current.click() } }}
              style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '11px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span style={{ fontSize: '15px' }}>📷</span> Appareil photo
            </button>
            <button
              onClick={() => { if (galleryRef.current) { galleryRef.current.accept = 'image/*'; galleryRef.current.removeAttribute('capture'); galleryRef.current.click() } }}
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '11px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span style={{ fontSize: '15px' }}>🖼️</span> Galerie
            </button>
            <button
              onClick={() => { if (filesRef.current) { filesRef.current.accept = 'image/*,application/pdf,.pdf'; filesRef.current.removeAttribute('capture'); filesRef.current.click() } }}
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '11px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span style={{ fontSize: '15px' }}>📄</span> Fichier / PDF
            </button>
            <button
              onClick={() => router.push('/ajouter')}
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '11px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span style={{ fontSize: '15px' }}>✏️</span> Ajouter manuellement
            </button>
          </div>

          {/* Hidden inputs */}
          <input ref={cameraRef}  type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleScanFile(e.target.files[0])} />
          <input ref={galleryRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleScanFile(e.target.files[0])} />
          <input ref={filesRef}   type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleScanFile(e.target.files[0])} />
        </div>
        )}

        {/* Scan loading */}
        {scanning && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '20px 24px', marginTop: '10px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🔍</div>
            <div>
              <p style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 2px', color: 'var(--text-primary)' }}>Analyse par IA en cours...</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Détection automatique du service et du montant</p>
            </div>
          </div>
        )}

        {/* Scan error */}
        {scanError && !scanning && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '14px 16px', marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#dc2626', margin: '0', fontSize: '13px', fontWeight: '600' }}>{scanError}</p>
            </div>
            <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
        )}

        {/* Scan result inline */}
        {scanResult && !scanning && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '18px', padding: '20px', marginTop: '10px', border: '2px solid #a5b4fc' }}>
            {scanResult.is_invoice === false ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0', fontSize: '14px' }}>Ce document ne semble pas être une facture.</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                  <p style={{ fontSize: '12px', color: '#22c55e', fontWeight: '700', margin: '0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Facture détectée</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: (categoryConfig[scanResult.category] || categoryConfig.other).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                    {(categoryConfig[scanResult.category] || categoryConfig.other).icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '700', fontSize: '17px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{scanResult.company_name}</p>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: (categoryConfig[scanResult.category] || categoryConfig.other).color, background: (categoryConfig[scanResult.category] || categoryConfig.other).bg, padding: '2px 8px', borderRadius: '6px' }}>
                      {(categoryConfig[scanResult.category] || categoryConfig.other).label}
                    </span>
                  </div>
                  <p style={{ fontWeight: '800', fontSize: '22px', color: '#4f46e5', margin: '0' }}>
                    {scanResult.amount} €<span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--text-muted)' }}>{cycleLabel[scanResult.billing_cycle] || ''}</span>
                  </p>
                </div>
                {scanAdded ? (
                  <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>✅</span>
                    <p style={{ color: '#16a34a', fontWeight: '700', fontSize: '14px', margin: '0' }}>Ajouté au dashboard !</p>
                    <button onClick={() => { setScanResult(null); setScanAdded(false); setScanExpanded(false) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleAddFromScan} style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '13px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                      Ajouter au dashboard
                    </button>
                    <button onClick={() => setScanResult(null)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '13px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}>✕</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Nav secondaire */}
      <div style={{ padding: '8px 16px 4px', display: 'flex', gap: '8px' }}>
        <button onClick={() => router.push('/ajouter')} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '11px 6px', fontWeight: '600', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '13px' }}>➕</span> Ajouter
        </button>
        <button onClick={() => router.push('/releve')} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '11px 6px', fontWeight: '600', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '13px' }}>🏦</span> Relevé
        </button>
        <button onClick={() => router.push('/historique')} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '11px 6px', fontWeight: '600', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', position: 'relative' }}>
          <span style={{ fontSize: '13px' }}>💰</span> Éco.
          {ecoSavings > 1 && (
            <span style={{ position: 'absolute', top: '-5px', right: '-3px', background: '#16a34a', color: 'white', fontSize: '9px', fontWeight: '800', borderRadius: '6px', padding: '1px 4px', lineHeight: '14px' }}>
              -{ecoSavings.toFixed(0)}€
            </span>
          )}
        </button>
        <button onClick={() => router.push('/partage')} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '11px 6px', fontWeight: '600', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '13px' }}>👨‍👩‍👧‍👦</span> Partage
        </button>
      </div>
      <div style={{ padding: '4px 16px 16px' }}>
        <button onClick={() => router.push('/calendrier')} style={{ width: '100%', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '11px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>📅</span> Calendrier & Coût annuel
        </button>
      </div>

      {/* Subscription list */}
      <div style={{ padding: '0 16px' }}>

        {/* Trial end alerts */}
        {subscriptions.filter(s => {
          if (!s.details?.is_trial || !s.details?.trial_end_date) return false
          const diff = Math.ceil((new Date(s.details.trial_end_date).getTime() - Date.now()) / 86400000)
          return diff <= 2 && diff >= 0
        }).map(s => {
          const diff = Math.ceil((new Date(s.details!.trial_end_date).getTime() - Date.now()) / 86400000)
          return (
            <div key={s.id} style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '14px', padding: '14px 16px', marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>🚨</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '700', fontSize: '13px', color: '#991b1b', margin: '0 0 2px' }}>Fin d'essai {diff === 0 ? "aujourd'hui" : diff === 1 ? 'demain' : `dans ${diff} jours`}</p>
                <p style={{ fontSize: '12px', color: '#dc2626', margin: '0' }}>{s.company_name} — tu vas être prélevé !</p>
              </div>
              <button onClick={() => router.push('/resiliation?name=' + s.company_name)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap' }}>
                Résilier
              </button>
            </div>
          )
        })}

        {/* Doublons */}
        {doublons.filter((_, i) => !groupedDoublons.includes(i)).length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', color: '#d97706', fontWeight: '700', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>⚠️ Doublons détectés</p>
            {doublons.map((d, i) => {
              if (groupedDoublons.includes(i)) return null
              const isSameOp = d.type === 'same_operator'
              return (
                <div key={i} style={{ background: isSameOp ? '#eff6ff' : '#fffbeb', border: `1px solid ${isSameOp ? '#bfdbfe' : '#fde68a'}`, borderRadius: '14px', padding: '14px 16px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>{isSameOp ? '🔵' : '⚠️'}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '700', fontSize: '14px', color: isSameOp ? '#1d4ed8' : '#92400e', margin: '0 0 2px' }}>
                        {isSameOp ? `Deux abonnements ${d.group}` : `Services ${d.group} en double`}
                      </p>
                      <p style={{ fontSize: '12px', color: isSameOp ? '#3b82f6' : '#b45309', margin: '0' }}>
                        {isSameOp
                          ? `Tu as ${d.names.join(' et ')} chez le même opérateur — abonnements distincts légitimes ?`
                          : `Tu paies ${d.names.join(' et ')} — deux services similaires`}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {isSameOp ? (
                      <>
                        <button
                          onClick={() => setGroupedDoublons(prev => [...prev, i])}
                          style={{ background: '#dbeafe', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#1d4ed8', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                        >
                          👁️ Grouper les abonnements
                        </button>
                        <button onClick={() => router.push('/resiliation?name=' + encodeURIComponent(d.names[0]))} style={{ background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#dc2626', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Résilier l'un</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => router.push('/compare?name=' + encodeURIComponent(d.names[0]) + '&amount=0&category=streaming&details=%7B%7D')} style={{ background: '#fef3c7', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#92400e', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>🔍 Comparer</button>
                        <button onClick={() => router.push('/resiliation?name=' + encodeURIComponent(d.names[1]))} style={{ background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#dc2626', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>✂️ Résilier un doublon</button>
                        <button onClick={() => setGroupedDoublons(prev => [...prev, i])} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Ignorer</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {subscriptions.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>📄</div>
            <p style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Aucun abonnement</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Glisse une facture dans la barre ci-dessus</p>
          </div>
        ) : (
          <>
            {/* Category filter chips — always visible */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '10px', scrollbarWidth: 'none' }}>
              <button onClick={() => setFilter('all')} style={{ flexShrink: 0, background: filter === 'all' ? '#4f46e5' : 'var(--bg-secondary)', color: filter === 'all' ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '20px', padding: '5px 13px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                Tous ({subscriptions.length})
              </button>
              {categories.map(cat => {
                const cfg = categoryConfig[cat] || categoryConfig.other
                const count = subscriptions.filter(s => s.category === cat).length
                const catTotal = subscriptions.filter(s => s.category === cat).reduce((sum, s) => sum + s.amount, 0)
                return (
                  <button key={cat} onClick={() => setFilter(filter === cat ? 'all' : cat as FilterOption)} style={{ flexShrink: 0, background: filter === cat ? cfg.color : 'var(--bg-secondary)', color: filter === cat ? 'white' : 'var(--text-secondary)', border: `1px solid ${filter === cat ? cfg.color : 'var(--border)'}`, borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '12px' }}>{cfg.icon}</span>
                    {cfg.label}
                    <span style={{ opacity: 0.75, fontWeight: '400' }}>{catTotal.toFixed(0)}€</span>
                  </button>
                )
              })}
              <button onClick={() => setShowFilters(!showFilters)} style={{ flexShrink: 0, background: showFilters ? '#f5f3ff' : 'var(--bg-secondary)', color: showFilters ? '#7c3aed' : 'var(--text-muted)', border: `1px solid ${showFilters ? '#c4b5fd' : 'var(--border)'}`, borderRadius: '20px', padding: '5px 11px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                ↕ Trier
              </button>
            </div>

            {showFilters && (
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '10px 14px', marginBottom: '10px', border: '1px solid var(--border)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {([['amount_desc', '💰 Plus cher'], ['amount_asc', '🪙 Moins cher'], ['name_asc', '🔤 A→Z'], ['recent', '🕐 Récent']] as [SortOption, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => { setSort(val); setShowFilters(false) }} style={{ background: sort === val ? '#4f46e5' : 'var(--bg-secondary)', color: sort === val ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            )}

            {filtered.map((sub) => {
              const config = categoryConfig[sub.category] || categoryConfig.other
              return (
                <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                  {/* Service info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
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

                  {/* ── MICRO-DÉTAILS TECHNIQUES ── */}
                  {(() => {
                    const details = sub.details || {}
                    const rows: { icon: string; text: string; color?: string }[] = []
                    if (details.engagement_end_date) {
                      const engDate = new Date(details.engagement_end_date)
                      const engDays = daysUntil(engDate)
                      const canCancel = engDays <= 0
                      rows.push({
                        icon: '📋',
                        text: canCancel
                          ? `Engagement terminé — résiliation sans frais`
                          : `Engagement jusqu'au ${fmtDate(engDate)} (${engDays} j)`,
                        color: canCancel ? '#16a34a' : engDays <= 60 ? '#d97706' : undefined,
                      })
                    }
                    if (details.is_trial && details.trial_end_date) {
                      const trialDate = new Date(details.trial_end_date)
                      const trialDays = daysUntil(trialDate)
                      rows.push({
                        icon: '⏱',
                        text: trialDays <= 0 ? `Essai terminé` : `Essai gratuit — fin le ${fmtDate(trialDate)} (${trialDays} j)`,
                        color: trialDays <= 2 ? '#dc2626' : '#d97706',
                      })
                    }
                    const renewal = getNextRenewal(sub)
                    if (renewal) {
                      const days = daysUntil(renewal)
                      rows.push({
                        icon: '🔄',
                        text: `Renouvellement le ${fmtDate(renewal)} · ${days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} j`}`,
                        color: days <= 3 ? '#d97706' : undefined,
                      })
                    }
                    if (rows.length === 0) return null
                    return (
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '9px 12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {rows.map((row, i) => (
                          <p key={i} style={{ fontSize: '11px', color: row.color || 'var(--text-muted)', margin: '0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: row.color ? '600' : '400' }}>
                            <span style={{ fontSize: '12px', flexShrink: 0 }}>{row.icon}</span>{row.text}
                          </p>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Action buttons */}
                  {(() => {
                    const shareMatch = SHAREABLE_CATALOG.find(e => e.keywords.some(kw => sub.company_name.toLowerCase().includes(kw)))
                    const shareSavings = shareMatch ? sub.amount * 0.5 : 0
                    return (
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <button onClick={() => router.push('/compare?name=' + encodeURIComponent(sub.company_name) + '&amount=' + sub.amount + '&category=' + sub.category + '&details=' + encodeURIComponent(JSON.stringify(sub.details || {})))} style={{ flex: 1, background: '#f5f3ff', border: 'none', borderRadius: '10px', padding: '9px', color: '#7c3aed', fontSize: '12px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          🔍 Comparer
                          {shareSavings > 0 && <span style={{ background: '#ede9fe', borderRadius: '5px', padding: '1px 5px', fontSize: '10px', fontWeight: '800', color: '#7c3aed' }}>-{shareSavings.toFixed(0)}€</span>}
                        </button>
                        <button onClick={() => handleRemove(sub.id)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '10px', padding: '9px 12px', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>✕</button>
                      </div>
                    )
                  })()}

                  {/* ── BOUTON RÉSILIER PROÉMINENT ── */}
                  <button
                    onClick={() => router.push('/resiliation?name=' + sub.company_name)}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '13px',
                      fontWeight: '700',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      letterSpacing: '0.1px',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>✂️</span>
                    Résilier cet abonnement
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

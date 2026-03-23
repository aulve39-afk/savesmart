'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions, updateSubscriptionDetails, type Subscription } from '../store'
import { useOnboarding as useUserId } from '../hooks/useOnboarding'
import { useKeyboardScroll } from '../hooks/useKeyboardScroll'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const categoryConfig: Record<string, { icon: string; color: string; bg: string }> = {
  streaming:      { icon: '▶', color: '#7c3aed', bg: '#f5f3ff' },
  telecom:        { icon: '📶', color: '#0284c7', bg: '#f0f9ff' },
  telecom_mobile: { icon: '📱', color: '#0284c7', bg: '#f0f9ff' },
  telecom_box:    { icon: '🌐', color: '#0369a1', bg: '#e0f2fe' },
  energie:        { icon: '⚡', color: '#d97706', bg: '#fffbeb' },
  assurance:      { icon: '🛡', color: '#059669', bg: '#f0fdf4' },
  saas:           { icon: '☁', color: '#db2777', bg: '#fdf2f8' },
  other:          { icon: '●',  color: '#6b7280', bg: '#f9fafb' },
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function getNextRenewalDate(sub: Subscription): Date | null {
  if (sub.billing_cycle === 'one_time' || sub.billing_cycle === 'unknown') return null
  const base = new Date(sub.detected_at)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const next = new Date(base)
  if (sub.billing_cycle === 'monthly') {
    while (next <= now) next.setMonth(next.getMonth() + 1)
  } else if (sub.billing_cycle === 'yearly') {
    while (next <= now) next.setFullYear(next.getFullYear() + 1)
  } else if (sub.billing_cycle === 'quarterly') {
    while (next <= now) next.setMonth(next.getMonth() + 3)
  }
  return next
}

function getAnnualCost(sub: Subscription): number {
  if (sub.billing_cycle === 'yearly')    return sub.amount
  if (sub.billing_cycle === 'quarterly') return sub.amount * 4
  if (sub.billing_cycle === 'monthly')   return sub.amount * 12
  return sub.amount
}

function daysUntil(date: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(date: Date): string {
  return `${DAYS_FR[date.getDay()]} ${date.getDate()} ${MONTHS_FR[date.getMonth()]}`
}

type Tab = 'calendrier' | 'annuel'

export default function CalendrierPage() {
  const router = useRouter()
  const { userId, isLoading } = useUserId()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [tab, setTab] = useState<Tab>('calendrier')
  const [editTrialId, setEditTrialId] = useState<string | null>(null)
  const [trialDate, setTrialDate] = useState('')

  useKeyboardScroll()

  useEffect(() => {
    if (userId) getSubscriptions(userId).then(setSubscriptions)
  }, [userId])

  const reload = () => { if (userId) getSubscriptions(userId).then(setSubscriptions) }

  // --- Trial logic ---
  const trials = subscriptions.filter(s => s.details?.is_trial && s.details?.trial_end_date)
  const urgentTrials = trials.filter(s => {
    const d = new Date(s.details!.trial_end_date)
    return daysUntil(d) <= 7
  })

  async function saveTrial(sub: Subscription) {
    if (!trialDate || !userId) return
    await updateSubscriptionDetails(sub.id, { ...sub.details, is_trial: true, trial_end_date: trialDate }, userId)
    setEditTrialId(null)
    setTrialDate('')
    reload()
  }

  async function removeTrial(sub: Subscription) {
    if (!userId) return
    const newDetails = { ...sub.details }
    delete newDetails.is_trial
    delete newDetails.trial_end_date
    await updateSubscriptionDetails(sub.id, newDetails, userId)
    reload()
  }

  // --- Calendar logic ---
  const renewals = subscriptions
    .map(sub => ({ sub, date: getNextRenewalDate(sub) }))
    .filter(({ date }) => date !== null) as { sub: Subscription; date: Date }[]

  renewals.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Group by month (next 4 months)
  const now = new Date()
  const monthGroups: { label: string; key: string; items: { sub: Subscription; date: Date }[]; total: number }[] = []
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const label = i === 0 ? `Ce mois • ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
                : i === 1 ? `Mois prochain • ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
                : `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
    const items = renewals.filter(r => {
      return r.date.getFullYear() === d.getFullYear() && r.date.getMonth() === d.getMonth()
    })
    const total = items.reduce((s, r) => s + r.sub.amount, 0)
    if (items.length > 0 || i === 0) monthGroups.push({ label, key, items, total })
  }

  // --- Annual cost logic ---
  const annualSubs = [...subscriptions].sort((a, b) => getAnnualCost(b) - getAnnualCost(a))
  const totalAnnual = subscriptions.reduce((s, sub) => s + getAnnualCost(sub), 0)
  const totalMonthly = subscriptions.reduce((s, sub) => s + sub.amount, 0)

  if (isLoading || !userId) return (
    <div style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header skeleton */}
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="skeleton" style={{ width: '120px', height: '20px' }} />
          <div className="skeleton" style={{ width: '170px', height: '13px' }} />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div style={{ background: 'var(--bg-card)', padding: '0 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
        <div className="skeleton" style={{ flex: 1, height: '44px', borderRadius: '6px', margin: '8px 0' }} />
        <div className="skeleton" style={{ flex: 1, height: '44px', borderRadius: '6px', margin: '8px 0' }} />
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Month label skeleton */}
        <div className="skeleton" style={{ width: '140px', height: '13px', borderRadius: '4px' }} />
        {/* Calendar items skeleton */}
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '14px 16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="skeleton" style={{ width: '45%', height: '14px' }} />
              <div className="skeleton" style={{ width: '30%', height: '11px' }} />
            </div>
            <div className="skeleton" style={{ width: '50px', height: '16px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, color: 'var(--text-primary)' }}>←</button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Calendrier & Coûts</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Renouvellements et budget annuel</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Urgent trial alerts */}
        {urgentTrials.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {urgentTrials.map(sub => {
              const d = new Date(sub.details!.trial_end_date)
              const days = daysUntil(d)
              const isToday = days === 0
              const isTomorrow = days === 1
              return (
                <div key={sub.id} style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>🚨</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '700', fontSize: '14px', color: '#991b1b', margin: '0 0 2px' }}>
                      {sub.company_name} — essai gratuit
                    </p>
                    <p style={{ fontSize: '13px', color: '#dc2626', margin: '0 0 8px' }}>
                      {isToday ? 'Se termine aujourd\'hui !' : isTomorrow ? 'Se termine demain !' : `Se termine dans ${days} jours (${formatDate(d)})`}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => router.push('/resiliation?name=' + sub.company_name)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>
                        Résilier maintenant
                      </button>
                      <button onClick={() => removeTrial(sub)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: '600' }}>
                        Ignorer
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {subscriptions.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '32px', margin: '0 0 12px' }}>📅</div>
            <p style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Aucun abonnement</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Scanne une facture pour commencer</p>
          </div>
        ) : (
          <>
            {/* Tab toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '4px', marginBottom: '16px', gap: '4px' }}>
              {([['calendrier', '📅 Calendrier'], ['annuel', '💰 Coût annuel']] as [Tab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: tab === t ? 'var(--bg-card)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: tab === t ? '700' : '500', fontSize: '13px', cursor: 'pointer', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── TAB CALENDRIER ── */}
            {tab === 'calendrier' && (
              <>
                {/* Next payment highlight */}
                {renewals.length > 0 && (() => {
                  const next = renewals[0]
                  const days = daysUntil(next.date)
                  return (
                    <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '18px', padding: '20px 24px', color: 'white', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Prochain prélèvement</p>
                        <p style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 2px' }}>{next.sub.company_name}</p>
                        <p style={{ fontSize: '13px', opacity: 0.7, margin: '0' }}>{formatDate(next.date)} · {days === 0 ? 'aujourd\'hui' : days === 1 ? 'demain' : `dans ${days} jours`}</p>
                      </div>
                      <p style={{ fontSize: '26px', fontWeight: '800', margin: '0', letterSpacing: '-0.5px' }}>{next.sub.amount.toFixed(2)} €</p>
                    </div>
                  )
                })()}

                {/* Monthly groups */}
                {monthGroups.map(group => (
                  <div key={group.key} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '0', textTransform: 'uppercase', letterSpacing: '1px' }}>{group.label}</p>
                      {group.items.length > 0 && (
                        <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: '0' }}>{group.total.toFixed(2)} €</p>
                      )}
                    </div>

                    {group.items.length === 0 ? (
                      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Aucun prélèvement ce mois</p>
                      </div>
                    ) : (
                      group.items.map(({ sub, date }) => {
                        const cfg = categoryConfig[sub.category] || categoryConfig.other
                        const days = daysUntil(date)
                        const isTrial = !!sub.details?.is_trial
                        const isEditing = editTrialId === sub.id
                        const trialEnd = sub.details?.trial_end_date ? new Date(sub.details.trial_end_date) : null
                        const trialDays = trialEnd ? daysUntil(trialEnd) : null

                        return (
                          <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', border: '1px solid var(--border)' }}>
                            {/* Row principale */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                                {cfg.icon}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                  <p style={{ fontWeight: '600', fontSize: '14px', margin: '0', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                                  {isTrial && <span style={{ fontSize: '10px', fontWeight: '700', background: '#fef3c7', color: '#92400e', borderRadius: '5px', padding: '1px 6px' }}>ESSAI</span>}
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
                                  {formatDate(date)} · {days === 0 ? 'aujourd\'hui' : days === 1 ? 'demain' : `dans ${days} j`}
                                </p>
                                {isTrial && trialEnd && (
                                  <p style={{ fontSize: '11px', color: trialDays !== null && trialDays <= 2 ? '#dc2626' : '#d97706', margin: '2px 0 0', fontWeight: '600' }}>
                                    ⏱ Fin essai : {formatDate(trialEnd)} {trialDays !== null && trialDays <= 2 ? '🚨' : ''}
                                  </p>
                                )}
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{ fontWeight: '700', fontSize: '15px', margin: '0', color: 'var(--text-primary)' }}>{sub.amount.toFixed(2)} €</p>
                                <button
                                  onClick={() => { setEditTrialId(isEditing ? null : sub.id); setTrialDate(sub.details?.trial_end_date || '') }}
                                  style={{ fontSize: '10px', color: isTrial ? '#d97706' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontWeight: '600', marginTop: '2px' }}
                                >
                                  {isTrial ? '⏱ Essai' : '+ Essai?'}
                                </button>
                              </div>
                            </div>

                            {/* Trial date editor */}
                            {isEditing && (
                              <div style={{ marginTop: '12px', padding: '12px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                                <p style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', margin: '0 0 8px' }}>Date de fin d'essai gratuit</p>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input
                                    type="date"
                                    value={trialDate}
                                    onChange={e => setTrialDate(e.target.value)}
                                    style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #fde68a', background: 'white', fontSize: '13px', color: '#92400e', fontFamily: font }}
                                  />
                                  <button onClick={() => saveTrial(sub)} style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>OK</button>
                                  {isTrial && (
                                    <button onClick={() => removeTrial(sub)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                                  )}
                                </div>
                                <p style={{ fontSize: '11px', color: '#b45309', margin: '8px 0 0' }}>Tu seras alerté 2 jours avant la fin de l'essai</p>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                ))}

                {/* Non-recurring subscriptions */}
                {(() => {
                  const nonRecurring = subscriptions.filter(s => s.billing_cycle === 'one_time' || s.billing_cycle === 'unknown')
                  if (nonRecurring.length === 0) return null
                  return (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Paiements uniques</p>
                      {nonRecurring.map(sub => {
                        const cfg = categoryConfig[sub.category] || categoryConfig.other
                        return (
                          <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.7 }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{cfg.icon}</div>
                            <p style={{ flex: 1, fontWeight: '600', fontSize: '14px', margin: '0', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                            <p style={{ fontWeight: '700', fontSize: '14px', margin: '0', color: 'var(--text-secondary)' }}>{sub.amount.toFixed(2)} €</p>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </>
            )}

            {/* ── TAB COÛT ANNUEL ── */}
            {tab === 'annuel' && (
              <>
                {/* Hero choc annuel */}
                <div style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)', borderRadius: '20px', padding: '24px', color: 'white', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '110px', height: '110px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                  <div style={{ position: 'absolute', bottom: '-20px', right: '50px', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                  <p style={{ fontSize: '12px', opacity: 0.65, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ce que tu dépenses vraiment par an</p>
                  <p style={{ fontSize: '44px', fontWeight: '800', margin: '0 0 4px', letterSpacing: '-1.5px' }}>
                    {totalAnnual.toFixed(0)}<span style={{ fontSize: '22px', fontWeight: '400', opacity: 0.7 }}> €</span>
                  </p>
                  <p style={{ fontSize: '14px', opacity: 0.65, margin: '0' }}>
                    soit {totalMonthly.toFixed(2)} €/mois × 12
                  </p>
                </div>

                {/* Breakdown per subscription */}
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Détail par abonnement
                </p>

                {annualSubs.map(sub => {
                  const cfg = categoryConfig[sub.category] || categoryConfig.other
                  const annual = getAnnualCost(sub)
                  const isActuallyMonthly = sub.billing_cycle === 'monthly'
                  const isActuallyYearly = sub.billing_cycle === 'yearly'

                  return (
                    <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isActuallyMonthly ? '10px' : '0' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{cfg.icon}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '600', fontSize: '14px', margin: '0 0 1px', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
                            {isActuallyYearly ? 'Annuel' : isActuallyMonthly ? `${sub.amount.toFixed(2)} €/mois × 12` : `${sub.amount.toFixed(2)} €/trim. × 4`}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontWeight: '800', fontSize: '17px', margin: '0', color: annual >= 100 ? '#dc2626' : 'var(--text-primary)' }}>
                            {annual.toFixed(2)} €
                          </p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0' }}>/an</p>
                        </div>
                      </div>

                      {/* Choc visuel mensuel → annuel */}
                      {isActuallyMonthly && (
                        <div style={{ background: annual >= 100 ? '#fef2f2' : 'var(--bg-secondary)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{sub.amount.toFixed(2)} €/mois</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: annual >= 100 ? '#dc2626' : '#d97706', flex: 1 }}>
                            {annual.toFixed(2)} €/an
                          </span>
                          {annual >= 120 && <span style={{ fontSize: '11px' }}>😬</span>}
                          {annual >= 60 && annual < 120 && <span style={{ fontSize: '11px' }}>💸</span>}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Total footer */}
                <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '16px', marginTop: '4px', border: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 2px' }}>Total annuel</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{subscriptions.length} abonnement{subscriptions.length > 1 ? 's' : ''}</p>
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: '800', margin: '0', color: '#dc2626' }}>{totalAnnual.toFixed(0)} €</p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

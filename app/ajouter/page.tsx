'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { addSubscription } from '../store'
import { useUserId } from '../hooks/useUserId'

const DRAFT_KEY = 'savesmart_form_draft'

const haptic = (ms = 8) => { try { navigator?.vibrate?.(ms) } catch {} }

const categories = [
  { value: 'streaming', label: 'Streaming', icon: '▶' },
  { value: 'telecom_mobile', label: 'Mobile', icon: '📱' },
  { value: 'telecom_box', label: 'Box/Fibre', icon: '🌐' },
  { value: 'energie', label: 'Énergie', icon: '⚡' },
  { value: 'assurance', label: 'Assurance', icon: '🛡' },
  { value: 'saas', label: 'Logiciels', icon: '☁' },
  { value: 'other', label: 'Autre', icon: '●' },
]

const cycles = [
  { value: 'monthly', label: 'Mensuel' },
  { value: 'yearly', label: 'Annuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'one_time', label: 'Unique' },
]

export default function AjouterPage() {
  const router = useRouter()
  const { userId, isLoading } = useUserId()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('other')
  const [cycle, setCycle] = useState('monthly')
  const [engagementDate, setEngagementDate] = useState('')
  const [isTrial, setIsTrial] = useState(false)
  const [trialEndDate, setTrialEndDate] = useState('')
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [amountError, setAmountError] = useState('')
  const [trialDateError, setTrialDateError] = useState('')
  const [nameShake, setNameShake] = useState(false)
  const [amountShake, setAmountShake] = useState(false)
  const [trialShake, setTrialShake] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)

  const shake = (setter: (v: boolean) => void) => {
    setter(true)
    setTimeout(() => setter(false), 400)
  }

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  // ── Restauration du brouillon ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.name)            setName(d.name)
      if (d.amount)          setAmount(d.amount)
      if (d.category)        setCategory(d.category)
      if (d.cycle)           setCycle(d.cycle)
      if (d.engagementDate)  setEngagementDate(d.engagementDate)
      if (d.isTrial)         setIsTrial(true)
      if (d.trialEndDate)    setTrialEndDate(d.trialEndDate)
      if (d.name || d.amount) setHasDraft(true)
    } catch {}
  }, [])

  // ── Sauvegarde automatique du brouillon ──
  useEffect(() => {
    if (!name && !amount) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, amount, category, cycle, engagementDate, isTrial, trialEndDate }))
    } catch {}
  }, [name, amount, category, cycle, engagementDate, isTrial, trialEndDate])

  // ── Scroll au bouton "Ajouter" quand le clavier remonte ──
  const scrollSubmitIntoView = () => {
    setTimeout(() => {
      submitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 350)
  }

  // ── Scroll au champ actif quand le clavier apparaît ──
  const scrollToFocused = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 320)
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border-input)',
    fontSize: '16px', /* 16px minimum — évite le zoom automatique iOS */
    marginBottom: '10px',
    boxSizing: 'border-box' as const,
    fontFamily: font,
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    outline: 'none',
  }

  const validateName = (val: string) => {
    if (!val.trim()) { setNameError('Entre le nom du service'); haptic(20); shake(setNameShake); return false }
    if (val.trim().length > 100) { setNameError('Nom trop long (100 caractères max)'); haptic(20); shake(setNameShake); return false }
    setNameError(''); return true
  }
  const validateAmount = (val: string) => {
    const n = parseFloat(val)
    if (!val || isNaN(n) || n <= 0) { setAmountError('Entre un montant valide (ex: 9.99)'); haptic(20); shake(setAmountShake); return false }
    if (n > 9999) { setAmountError('Montant trop élevé (max 9 999 €)'); haptic(20); shake(setAmountShake); return false }
    setAmountError(''); return true
  }
  const validateTrialDate = (val: string, trialEnabled: boolean) => {
    if (!trialEnabled) { setTrialDateError(''); return true }
    if (!val) { setTrialDateError('Indique la date de fin d\'essai'); haptic(20); shake(setTrialShake); return false }
    if (new Date(val) < new Date()) { setTrialDateError('La date est déjà passée — essai terminé ?'); haptic(20); shake(setTrialShake); return false }
    setTrialDateError(''); return true
  }

  const handleSubmit = async () => {
    if (!userId) return
    const nameOk = validateName(name)
    const amountOk = validateAmount(amount)
    const trialOk = validateTrialDate(trialEndDate, isTrial)
    if (!nameOk || !amountOk || !trialOk) return
    haptic(12)
    setIsSubmitting(true)
    const details: Record<string, any> = {}
    if (engagementDate) details.engagement_end_date = engagementDate
    if (isTrial && trialEndDate) { details.is_trial = true; details.trial_end_date = trialEndDate }
    await addSubscription({
      company_name: name.trim(),
      amount: parseFloat(amount),
      billing_cycle: cycle,
      category,
      details,
    }, userId)
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    // Rediriger vers la page de succès si c'est le premier ajout (venant de l'onboarding)
    const fromOnboarding = localStorage.getItem('savesmart_onboarding_active') === '1'
    try { localStorage.removeItem('savesmart_onboarding_active') } catch {}
    router.push(fromOnboarding ? '/welcome' : '/')
  }
  

  if (isLoading || !userId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '200px' }}>
      {/* paddingBottom généreux = espace pour que le clavier virtuel ne cache pas le bouton Ajouter */}

      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => router.push('/')}
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Ajouter manuellement</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Saisis les détails de ton abonnement</p>
        </div>
      </div>

      {/* Bannière brouillon récupéré */}
      {hasDraft && (
        <div style={{ margin: '12px 16px 0', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📝</span>
          <p style={{ fontSize: '12px', color: '#92400e', fontWeight: '600', margin: '0', flex: 1 }}>
            Brouillon récupéré — tu avais commencé à remplir ce formulaire
          </p>
          <button
            onClick={() => {
              setName(''); setAmount(''); setCategory('other'); setCycle('monthly')
              setEngagementDate(''); setIsTrial(false); setTrialEndDate('')
              setHasDraft(false)
              try { localStorage.removeItem(DRAFT_KEY) } catch {}
            }}
            style={{ background: 'none', border: 'none', color: '#d97706', cursor: 'pointer', fontSize: '16px', padding: '0' }}
          >✕</button>
        </div>
      )}

      <div style={{ padding: '20px 16px' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ color: '#dc2626', fontSize: '13px', margin: '0', fontWeight: '500' }}>{error}</p>
          </div>
        )}

        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 16px', color: 'var(--text-primary)' }}>Informations</p>

          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nom du service</p>
          <div className={nameShake ? 'field-shake' : undefined}>
            <input
              style={{ ...inputStyle, ...(nameError ? { borderColor: '#ef4444', marginBottom: '4px' } : {}) }}
              placeholder="Ex: Netflix, Free Mobile, EDF..."
              value={name}
              maxLength={100}
              autoComplete="off"
              autoCapitalize="words"
              onFocus={scrollToFocused}
              onChange={e => { setName(e.target.value); if (nameError) setNameError('') }}
            />
          </div>
          {nameError && <p style={{ fontSize: '12px', color: '#ef4444', margin: '0 0 10px', fontWeight: '500' }}>{nameError}</p>}

          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Montant</p>
          <div className={amountShake ? 'field-shake' : undefined} style={{ position: 'relative', marginBottom: amountError ? '4px' : '10px' }}>
            <input
              style={{ ...inputStyle, marginBottom: '0', paddingRight: '40px', ...(amountError ? { borderColor: '#ef4444' } : {}) }}
              placeholder="0.00"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="9999"
              step="0.01"
              value={amount}
              onFocus={scrollToFocused}
              onBlur={scrollSubmitIntoView}
              onChange={e => { setAmount(e.target.value); if (amountError) setAmountError('') }}
            />
            <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px', fontWeight: '600' }}>€</span>
          </div>
          {amountError && <p style={{ fontSize: '12px', color: '#ef4444', margin: '0 0 6px', fontWeight: '500' }}>{amountError}</p>}
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 14px', color: 'var(--text-primary)' }}>Catégorie</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                style={{
                  background: category === cat.value ? '#4f46e5' : 'var(--bg-secondary)',
                  color: category === cat.value ? 'white' : 'var(--text-secondary)',
                  border: category === cat.value ? 'none' : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{cat.icon}</div>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '20px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 14px', color: 'var(--text-primary)' }}>Fréquence de paiement</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {cycles.map(c => (
              <button
                key={c.value}
                onClick={() => setCycle(c.value)}
                style={{
                  background: cycle === c.value ? '#4f46e5' : 'var(--bg-secondary)',
                  color: cycle === c.value ? 'white' : 'var(--text-secondary)',
                  border: cycle === c.value ? 'none' : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Détails optionnels */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Détails optionnels</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Pour des alertes et conseils personnalisés</p>

          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Fin d'engagement</p>
          <input
            type="date"
            style={{ ...inputStyle, marginBottom: '14px' }}
            value={engagementDate}
            onChange={e => setEngagementDate(e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isTrial ? '10px' : '0' }}>
            <button
              onClick={() => setIsTrial(!isTrial)}
              style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: isTrial ? '#4f46e5' : 'var(--bg-secondary)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', transition: 'left 0.2s', left: isTrial ? '23px' : '3px' }} />
            </button>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '0' }}>⏱ C'est un essai gratuit</p>
          </div>

          {isTrial && (
            <>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date de fin de l'essai</p>
              <div className={trialShake ? 'field-shake' : undefined}>
                <input
                  type="date"
                  style={{ ...inputStyle, marginBottom: '0', ...(trialDateError ? { borderColor: '#ef4444' } : {}) }}
                  value={trialEndDate}
                  onChange={e => { setTrialEndDate(e.target.value); if (trialDateError) setTrialDateError('') }}
                />
              </div>
              {trialDateError
                ? <p style={{ fontSize: '11px', color: '#ef4444', margin: '6px 0 0', fontWeight: '600' }}>⚠ {trialDateError}</p>
                : <p style={{ fontSize: '11px', color: '#d97706', margin: '6px 0 0' }}>Tu seras alerté 2 jours avant la fin</p>
              }
            </>
          )}
        </div>

        <button
          ref={submitRef}
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{ width: '100%', background: isSubmitting ? '#a5b4fc' : '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          {isSubmitting
            ? <><div style={{ width: '18px', height: '18px', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />Ajout en cours...</>
            : 'Ajouter à mon espace'}
        </button>
      </div>
    </main>
  )
}
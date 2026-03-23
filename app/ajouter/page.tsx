'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addSubscription } from '../store'
import { useUserId } from '../hooks/useUserId'

const categories = [
  { value: 'streaming', label: 'Streaming', icon: '▶' },
  { value: 'telecom_mobile', label: 'Mobile', icon: '📱' },
  { value: 'telecom_box', label: 'Box/Fibre', icon: '🌐' },
  { value: 'energie', label: 'Energie', icon: '⚡' },
  { value: 'assurance', label: 'Assurance', icon: '🛡' },
  { value: 'saas', label: 'SaaS', icon: '☁' },
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border-input)',
    fontSize: '15px',
    marginBottom: '10px',
    boxSizing: 'border-box' as const,
    fontFamily: font,
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    outline: 'none',
  }

  const validateName = (val: string) => {
    if (!val.trim()) { setNameError('Entre le nom du service'); return false }
    setNameError(''); return true
  }
  const validateAmount = (val: string) => {
    if (!val || isNaN(parseFloat(val)) || parseFloat(val) <= 0) { setAmountError('Entre un montant valide (ex: 9.99)'); return false }
    setAmountError(''); return true
  }

  const handleSubmit = async () => {
    if (!userId) return
    const nameOk = validateName(name)
    const amountOk = validateAmount(amount)
    if (!nameOk || !amountOk) return
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
    router.push('/')
  }
  

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
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Ajouter manuellement</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Saisis les details de ton abonnement</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ color: '#dc2626', fontSize: '13px', margin: '0', fontWeight: '500' }}>{error}</p>
          </div>
        )}

        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 16px', color: 'var(--text-primary)' }}>Informations</p>

          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nom du service</p>
          <input
            style={{ ...inputStyle, ...(nameError ? { borderColor: '#ef4444', marginBottom: '4px' } : {}) }}
            placeholder="Ex: Netflix, Free Mobile, EDF..."
            value={name}
            onChange={e => { setName(e.target.value); if (nameError) setNameError('') }}
          />
          {nameError && <p style={{ fontSize: '12px', color: '#ef4444', margin: '0 0 10px', fontWeight: '500' }}>{nameError}</p>}

          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Montant</p>
          <div style={{ position: 'relative', marginBottom: amountError ? '4px' : '10px' }}>
            <input
              style={{ ...inputStyle, marginBottom: '0', paddingRight: '40px', ...(amountError ? { borderColor: '#ef4444' } : {}) }}
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => { setAmount(e.target.value); if (amountError) setAmountError('') }}
            />
            <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px', fontWeight: '600' }}>€</span>
          </div>
          {amountError && <p style={{ fontSize: '12px', color: '#ef4444', margin: '0 0 6px', fontWeight: '500' }}>{amountError}</p>}
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 14px', color: 'var(--text-primary)' }}>Categorie</p>
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
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 14px', color: 'var(--text-primary)' }}>Frequence</p>
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
              <input
                type="date"
                style={{ ...inputStyle, marginBottom: '0' }}
                value={trialEndDate}
                onChange={e => setTrialEndDate(e.target.value)}
              />
              <p style={{ fontSize: '11px', color: '#d97706', margin: '6px 0 0' }}>Tu seras alerté 2 jours avant la fin</p>
            </>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{ width: '100%', background: isSubmitting ? '#a5b4fc' : '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
        >
          {isSubmitting ? 'Ajout en cours...' : 'Ajouter au dashboard'}
        </button>
      </div>
    </main>
  )
}
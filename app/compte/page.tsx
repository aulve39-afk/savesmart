'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSubscriptions, getUserPlan, getPayments, type Subscription, type UserPlan, type Payment } from '../store'
import { useOnboarding as useUserId } from '../hooks/useOnboarding'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const MONTHS_FR = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc']

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

const PLAN_FEATURES = {
  free: ['5 abonnements max', 'Scan de factures', 'Analyse de relevés'],
  premium: ['Abonnements illimités', 'Connexion Gmail', 'Partage famille', 'Export PDF', 'Alertes renouvellements', 'Comparateur d\'offres'],
}

type Section = 'profil' | 'abonnement' | 'paiements' | 'danger'

export default function ComptePage() {
  const router = useRouter()
  const { userId, user, isLoading } = useUserId()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [plan, setPlan] = useState<UserPlan | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [activeSection, setActiveSection] = useState<Section>('profil')
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!userId) return
    getSubscriptions(userId).then(setSubscriptions)
    getUserPlan(userId).then(setPlan)
    getPayments(userId).then(setPayments)
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
  const isPremium = plan?.plan === 'premium'

  async function handleDeleteAccount() {
    if (deleteInput !== 'SUPPRIMER') return
    setDeleting(true)
    await fetch('/api/delete-account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    localStorage.removeItem('savesmart_user_id')
    router.push('/')
  }

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'profil', label: 'Mon profil', icon: '👤' },
    { id: 'abonnement', label: 'Mon abonnement', icon: '⭐' },
    { id: 'paiements', label: 'Paiements', icon: '💳' },
    { id: 'danger', label: 'Zone danger', icon: '⚠️' },
  ]

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '52px 24px 28px', position: 'relative' }}>
        <button
          onClick={() => router.push('/')}
          style={{ position: 'absolute', top: '52px', left: '24px', width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >←</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '32px', border: '3px solid rgba(255,255,255,0.3)' }}>
            👤
          </div>
          <p style={{ fontWeight: '800', fontSize: '18px', color: 'white', margin: '0 0 12px', letterSpacing: '-0.3px' }}>Mon espace</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: isPremium ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.12)', borderRadius: '20px', padding: '4px 14px', border: isPremium ? '1px solid rgba(250,204,21,0.4)' : 'none' }}>
            <span style={{ fontSize: '11px' }}>{isPremium ? '⭐' : '🆓'}</span>
            <span style={{ fontSize: '11px', color: isPremium ? '#fcd34d' : 'rgba(255,255,255,0.8)', fontWeight: '700' }}>{isPremium ? 'Premium' : 'Gratuit'}</span>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 10 }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeSection === item.id ? '2px solid #4f46e5' : '2px solid transparent',
              padding: '12px 4px 10px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              color: activeSection === item.id ? '#4f46e5' : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: '16px' }}>{item.icon}</span>
            <span style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label.split(' ')[1] ?? item.label}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* === SECTION PROFIL === */}
        {activeSection === 'profil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { value: subscriptions.length.toString(), label: 'Abonnements', icon: '📋' },
                { value: `${total.toFixed(0)} €`, label: 'Par mois', icon: '💳' },
                { value: `${(total * 12).toFixed(0)} €`, label: 'Par an', icon: '📅' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px 12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <span style={{ fontSize: '20px', display: 'block', marginBottom: '6px' }}>{stat.icon}</span>
                  <p style={{ fontWeight: '800', fontSize: '17px', margin: '0 0 2px', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{stat.value}</p>
                  <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: '0', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Infos compte */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', margin: '0', padding: '14px 16px 10px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>Informations</p>
              {[
                { label: 'Plan', value: isPremium ? 'Premium' : 'Gratuit' },
                { label: 'Membre depuis', value: plan?.plan_started_at ? fmtDate(plan.plan_started_at) : fmtDate(new Date().toISOString()) },
                { label: 'Abonnements suivis', value: `${subscriptions.length}` },
                { label: 'Total mensuel', value: `${total.toFixed(2)} €` },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === SECTION ABONNEMENT === */}
        {activeSection === 'abonnement' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Plan actuel */}
            <div style={{ background: isPremium ? 'linear-gradient(135deg, #1e1b4b, #312e81)' : 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: isPremium ? 'none' : '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
              {isPremium && <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(250,204,21,0.1)', borderRadius: '50%' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: isPremium ? 'rgba(250,204,21,0.2)' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  {isPremium ? '⭐' : '🆓'}
                </div>
                <div>
                  <p style={{ fontWeight: '800', fontSize: '18px', margin: '0', color: isPremium ? 'white' : 'var(--text-primary)' }}>Plan {isPremium ? 'Premium' : 'Gratuit'}</p>
                  {isPremium && plan?.plan_expires_at && (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>Renouvellement le {fmtDate(plan.plan_expires_at)}</p>
                  )}
                  {!isPremium && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Actif depuis le {plan?.plan_started_at ? fmtDate(plan.plan_started_at) : fmtDate(new Date().toISOString())}</p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {PLAN_FEATURES[plan?.plan ?? 'free'].map(feature => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', color: isPremium ? '#86efac' : '#4f46e5' }}>✓</span>
                    <span style={{ fontSize: '13px', color: isPremium ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)', fontWeight: '500' }}>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade / downgrade */}
            {!isPremium ? (
              <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', border: '1.5px solid #4f46e5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <p style={{ fontWeight: '800', fontSize: '17px', margin: '0 0 3px', color: 'var(--text-primary)' }}>Passer Premium</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Débloquer toutes les fonctionnalités</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: '800', fontSize: '22px', margin: '0', color: '#4f46e5' }}>4,99 €</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>par mois</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '16px' }}>
                  {PLAN_FEATURES.premium.map(feature => (
                    <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#4f46e5' }}>✓</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  style={{ width: '100%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: '700', fontSize: '15px', color: 'white', cursor: 'pointer', fontFamily: font }}
                  onClick={() => alert('Paiement bientôt disponible')}
                >
                  Passer Premium — 4,99 €/mois
                </button>
              </div>
            ) : (
              <button
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', borderRadius: '14px', padding: '13px', fontWeight: '600', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: font }}
                onClick={() => alert('Pour résilier, contacte-nous à support@savesmart.fr')}
              >
                Résilier mon abonnement Premium
              </button>
            )}
          </div>
        )}

        {/* === SECTION PAIEMENTS === */}
        {activeSection === 'paiements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', margin: '0', padding: '14px 16px 10px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>
                Historique des paiements
              </p>

              {payments.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>💳</span>
                  <p style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 6px' }}>Aucun paiement</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Ton historique de paiements apparaîtra ici</p>
                </div>
              ) : (
                payments.map((p, i) => (
                  <div key={p.id} style={{ padding: '14px 16px', borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: p.status === 'paid' ? '#f0fdf4' : p.status === 'failed' ? '#fef2f2' : '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '16px' }}>{p.status === 'paid' ? '✅' : p.status === 'failed' ? '❌' : '⏳'}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{fmtDate(p.created_at)}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 2px' }}>{p.amount.toFixed(2)} {p.currency.toUpperCase()}</p>
                      {p.invoice_url && (
                        <a href={p.invoice_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#4f46e5', fontWeight: '600', textDecoration: 'none' }}>Facture ↗</a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* === SECTION DANGER === */}
        {activeSection === 'danger' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '16px', padding: '16px' }}>
              <p style={{ fontWeight: '700', fontSize: '13px', color: '#c2410c', margin: '0 0 6px' }}>⚠️ Zone sensible</p>
              <p style={{ fontSize: '13px', color: '#9a3412', margin: '0', lineHeight: '1.5' }}>Les actions ci-dessous sont irréversibles. Procède avec précaution.</p>
            </div>

            {/* Supprimer le compte */}
            {!showConfirmDelete ? (
              <button
                onClick={() => setShowConfirmDelete(true)}
                style={{ width: '100%', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', textAlign: 'left', fontFamily: font }}
              >
                <span style={{ fontSize: '20px' }}>🗑️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '700', fontSize: '14px', color: '#dc2626', margin: '0 0 3px' }}>Supprimer mon compte</p>
                  <p style={{ fontSize: '12px', color: '#ef4444', margin: '0' }}>Supprime définitivement toutes tes données</p>
                </div>
                <span style={{ fontSize: '14px', color: '#ef4444' }}>›</span>
              </button>
            ) : (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '20px' }}>
                <p style={{ fontWeight: '800', fontSize: '16px', color: '#dc2626', margin: '0 0 8px' }}>Supprimer mon compte ?</p>
                <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 16px', lineHeight: '1.5' }}>
                  Cette action supprimera <strong>définitivement</strong> tous tes abonnements, données et historique. Cette action est irréversible.
                </p>
                <p style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600', margin: '0 0 8px' }}>Tape <strong>SUPPRIMER</strong> pour confirmer :</p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="SUPPRIMER"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #fca5a5', borderRadius: '10px', padding: '11px 14px', fontSize: '14px', fontWeight: '600', marginBottom: '12px', background: 'white', color: '#dc2626', fontFamily: font, outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setShowConfirmDelete(false); setDeleteInput('') }}
                    style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: font }}
                  >Annuler</button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== 'SUPPRIMER' || deleting}
                    style={{ flex: 1, background: deleteInput === 'SUPPRIMER' ? '#dc2626' : '#fca5a5', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: '700', fontSize: '14px', cursor: deleteInput === 'SUPPRIMER' ? 'pointer' : 'not-allowed', color: 'white', fontFamily: font, transition: 'background 0.15s' }}
                  >{deleting ? 'Suppression…' : 'Supprimer définitivement'}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}

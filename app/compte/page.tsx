'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { getSubscriptions, getUserPlan, getPayments, type Subscription, type UserPlan, type Payment } from '../store'
import { useOnboarding as useUserId } from '../hooks/useOnboarding'
import { useKeyboardScroll } from '../hooks/useKeyboardScroll'
import Confetti from '../components/Confetti'

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

type Section = 'profil' | 'abonnement' | 'paiements'

export default function ComptePage() {
  const router = useRouter()
  const { userId, user, isLoading, isAuthenticated } = useUserId()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [plan, setPlan] = useState<UserPlan | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [activeSection, setActiveSection] = useState<Section>('profil')
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useKeyboardScroll()

  useEffect(() => {
    if (!userId) return
    getSubscriptions(userId).then(setSubscriptions)
    getUserPlan(userId).then(setPlan)
    getPayments(userId).then(setPayments)
    // Pré-remplir avec le nom Google si pas encore sauvegardé
    const storedPrenom = localStorage.getItem('klyp_prenom')
    const storedNom = localStorage.getItem('klyp_nom')
    if (!storedPrenom && !storedNom && user?.name) {
      const parts = user.name.split(' ')
      setPrenom(parts[0] ?? '')
      setNom(parts.slice(1).join(' ') ?? '')
    } else {
      setPrenom(storedPrenom ?? '')
      setNom(storedNom ?? '')
    }
  }, [userId])

  if (isLoading || !userId) {
    return (
      <div style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>
        {/* Header skeleton */}
        <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton" style={{ width: '100px', height: '20px' }} />
            <div className="skeleton" style={{ width: '150px', height: '13px' }} />
          </div>
        </div>
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Section tabs skeleton */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[100, 90, 80].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: '36px', borderRadius: '10px', flex: 1 }} />
            ))}
          </div>
          {/* Profile card skeleton */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton" style={{ width: '55%', height: '16px' }} />
                <div className="skeleton" style={{ width: '70%', height: '12px' }} />
              </div>
            </div>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ padding: '14px 16px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton" style={{ width: '35%', height: '13px' }} />
                <div className="skeleton" style={{ width: '25%', height: '13px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)
  const isPremium = plan?.plan === 'premium'

  function exportCSV() {
    if (subscriptions.length === 0) return
    const cycleLabels: Record<string, string> = { monthly: 'Mensuel', yearly: 'Annuel', quarterly: 'Trimestriel', one_time: 'Unique', unknown: '' }
    const headers = ['Service', 'Montant (€)', 'Fréquence', 'Catégorie', 'Ajouté le']
    const rows = subscriptions.map(s => [
      s.company_name,
      s.amount.toFixed(2),
      cycleLabels[s.billing_cycle] || s.billing_cycle,
      s.category,
      new Date(s.detected_at).toLocaleDateString('fr-FR'),
    ])
    // \uFEFF = BOM UTF-8 pour que Excel reconnaisse les accents
    const csv = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subly-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'SUPPRIMER') return
    setDeleting(true)
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/delete-account`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    await signOut({ callbackUrl: '/login' })
  }

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'profil', label: 'Mon profil', icon: '👤' },
    { id: 'abonnement', label: 'Mon abonnement', icon: '⭐' },
    { id: 'paiements', label: 'Paiements', icon: '💳' },
  ]

  function saveName() {
    localStorage.setItem('klyp_prenom', prenom)
    localStorage.setItem('klyp_nom', nom)
    setEditingName(false)
    // Micro-récompense quand le profil est complété (prénom + nom renseignés)
    if (prenom.trim() && nom.trim()) setShowConfetti(true)
  }

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      <Confetti show={showConfetti} onDone={() => setShowConfetti(false)} />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '52px 24px 28px', position: 'relative' }}>
        <button
          onClick={() => router.push('/')}
          style={{ position: 'absolute', top: '52px', left: '24px', width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >←</button>

        <div style={{ textAlign: 'center' }}>
          {user?.image ? (
            <img
              src={user.image}
              alt="Avatar"
              width={76}
              height={76}
              style={{ width: '76px', height: '76px', borderRadius: '50%', margin: '0 auto 12px', display: 'block', border: '3px solid rgba(255,255,255,0.3)', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '32px', border: '3px solid rgba(255,255,255,0.3)' }}>
              👤
            </div>
          )}
          <p style={{ fontWeight: '800', fontSize: '18px', color: 'white', margin: '0 0 4px', letterSpacing: '-0.3px' }}>{user?.name || (prenom ? `${prenom}${nom ? ' ' + nom : ''}` : 'Mon espace')}</p>
          {user?.email
            ? <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '0 0 12px' }}>{user.email}</p>
            : <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>Mode invité · cet appareil uniquement</p>
          }
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

            {/* Bannière connexion — uniquement pour les utilisateurs anonymes */}
            {!isAuthenticated && (
              <div style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '1.5px solid #c4b5fd', borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>🔗</span>
                  <div>
                    <p style={{ fontWeight: '800', fontSize: '14px', color: '#4f46e5', margin: '0 0 4px' }}>Sync multi-appareils</p>
                    <p style={{ fontSize: '12px', color: '#5b21b6', margin: '0', lineHeight: '1.5' }}>
                      Actuellement, tes données sont uniquement sur <strong>cet appareil</strong>. Connecte-toi pour y accéder depuis ton téléphone, ton ordi, n'importe où.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Sauvegarder l'UUID local pour migration après connexion
                    try {
                      const localId = localStorage.getItem('klyp_user_id')
                      if (localId) localStorage.setItem('klyp_pending_migration', localId)
                    } catch {}
                    router.push('/login')
                  }}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: '12px', padding: '12px', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: font }}
                >
                  <svg width="16" height="16" viewBox="0 0 48 48">
                    <path fill="white" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" opacity="0.9"/>
                    <path fill="white" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" opacity="0.9"/>
                    <path fill="white" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" opacity="0.9"/>
                    <path fill="white" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" opacity="0.9"/>
                  </svg>
                  Connecter mon compte Google
                </button>
              </div>
            )}

            {/* Nom / Prénom */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', margin: '0', textTransform: 'uppercase', letterSpacing: '1px' }}>Identité</p>
                <button onClick={() => editingName ? saveName() : setEditingName(true)} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: '700', color: '#4f46e5', cursor: 'pointer', padding: '0', fontFamily: font }}>
                  {editingName ? 'Enregistrer' : 'Modifier'}
                </button>
              </div>
              {editingName ? (
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 5px', fontWeight: '600' }}>Prénom</p>
                    <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Ton prénom" autoComplete="given-name" autoCapitalize="words" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #4f46e5', borderRadius: '10px', padding: '10px 12px', fontSize: '16px', fontFamily: font, background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 5px', fontWeight: '600' }}>Nom</p>
                    <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom" autoComplete="family-name" autoCapitalize="words" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #4f46e5', borderRadius: '10px', padding: '10px 12px', fontSize: '16px', fontFamily: font, background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none' }} />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Prénom</span>
                    <span style={{ fontSize: '13px', color: prenom ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: '600', fontStyle: prenom ? 'normal' : 'italic' }}>{prenom || 'Non renseigné'}</span>
                  </div>
                  <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Nom</span>
                    <span style={{ fontSize: '13px', color: nom ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: '600', fontStyle: nom ? 'normal' : 'italic' }}>{nom || 'Non renseigné'}</span>
                  </div>
                </>
              )}
            </div>

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

            {/* Déconnexion — uniquement si connecté */}
            {isAuthenticated && (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', textAlign: 'left', fontFamily: font }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🚪</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#dc2626', margin: '0 0 2px' }}>Se déconnecter</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>Tes données restent sauvegardées sur ton compte</p>
                </div>
                <span style={{ fontSize: '16px', color: '#dc2626' }}>›</span>
              </button>
            )}

            {/* Réinitialiser */}
            <button
              onClick={() => { localStorage.removeItem('klyp_prenom'); localStorage.removeItem('klyp_nom'); router.push('/onboarding') }}
              style={{ width: '100%', background: 'var(--bg-card)', border: '1.5px solid #4f46e5', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', textAlign: 'left', fontFamily: font }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🔄</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#4f46e5', margin: '0 0 2px' }}>Réinitialiser mon espace</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>Effacer mes données et recommencer</p>
              </div>
              <span style={{ fontSize: '16px', color: '#4f46e5' }}>›</span>
            </button>

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

            {/* Export CSV */}
            {subscriptions.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={exportCSV}
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: font }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📊</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 2px', color: 'var(--text-primary)' }}>Exporter en CSV</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{subscriptions.length} abonnement{subscriptions.length > 1 ? 's' : ''} · compatible Excel &amp; Numbers</p>
                  </div>
                  <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>↓</span>
                </button>
              </div>
            )}

            {/* Zone danger — discrète */}
            <div style={{ marginTop: '8px', textAlign: 'center' }}>
              {!showConfirmDelete ? (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: font, textDecoration: 'underline', opacity: 0.6 }}
                >
                  Supprimer définitivement mon compte
                </button>
              ) : (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '16px', textAlign: 'left' }}>
                  <p style={{ fontWeight: '700', fontSize: '14px', color: '#dc2626', margin: '0 0 8px' }}>Supprimer mon compte ?</p>
                  <p style={{ fontSize: '12px', color: '#ef4444', margin: '0 0 12px', lineHeight: '1.5' }}>
                    Toutes tes données seront <strong>définitivement supprimées</strong>. Action irréversible.
                  </p>
                  <p style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600', margin: '0 0 8px' }}>Tape <strong>SUPPRIMER</strong> pour confirmer :</p>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder="SUPPRIMER"
                    style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #fca5a5', borderRadius: '10px', padding: '10px 12px', fontSize: '16px', fontWeight: '600', marginBottom: '10px', background: 'white', color: '#dc2626', fontFamily: font, outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setShowConfirmDelete(false); setDeleteInput('') }} style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: font }}>Annuler</button>
                    <button onClick={handleDeleteAccount} disabled={deleteInput !== 'SUPPRIMER' || deleting} style={{ flex: 1, background: deleteInput === 'SUPPRIMER' ? '#dc2626' : '#fca5a5', border: 'none', borderRadius: '10px', padding: '10px', fontWeight: '700', fontSize: '13px', cursor: deleteInput === 'SUPPRIMER' ? 'pointer' : 'not-allowed', color: 'white', fontFamily: font }}>
                      {deleting ? '…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              )}
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
                onClick={() => alert('Pour résilier, contacte-nous à support@subly.fr')}
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

      </div>

      {/* ── FOOTER LÉGAL ── */}
      <div style={{ padding: '8px 16px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/confidentialite')}
            style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}
          >
            Politique de confidentialité
          </button>
          <button
            onClick={() => router.push('/cgu')}
            style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}
          >
            Conditions d'utilisation
          </button>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0', textAlign: 'center' }}>
          KLYP · v1.0 · Données hébergées en Europe 🇪🇺
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}

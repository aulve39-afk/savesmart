'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions, type Subscription } from '../store'
import { useUserId } from '../hooks/useUserId'

type FamilyPlan = {
  name: string
  price: number
  max_members: number
  note?: string
}

type ShareableOffer = {
  keywords: string[]
  display_name: string
  icon: string
  color: string
  bg: string
  individual_ref: number
  family_plan: FamilyPlan
}

const SHAREABLE_CATALOG: ShareableOffer[] = [
  {
    keywords: ['spotify'],
    display_name: 'Spotify',
    icon: '🎵',
    color: '#16a34a',
    bg: '#f0fdf4',
    individual_ref: 10.99,
    family_plan: { name: 'Spotify Famille', price: 17.99, max_members: 6, note: 'Jusqu\'à 6 comptes Premium' },
  },
  {
    keywords: ['deezer'],
    display_name: 'Deezer',
    icon: '🎵',
    color: '#7c3aed',
    bg: '#f5f3ff',
    individual_ref: 10.99,
    family_plan: { name: 'Deezer Famille', price: 17.99, max_members: 6, note: 'Jusqu\'à 6 comptes' },
  },
  {
    keywords: ['youtube premium', 'youtube music'],
    display_name: 'YouTube Premium',
    icon: '▶',
    color: '#dc2626',
    bg: '#fef2f2',
    individual_ref: 13.99,
    family_plan: { name: 'YouTube Premium Famille', price: 22.99, max_members: 6, note: 'Jusqu\'à 6 membres du foyer' },
  },
  {
    keywords: ['apple tv', 'apple one'],
    display_name: 'Apple TV+',
    icon: '🍎',
    color: '#374151',
    bg: '#f9fafb',
    individual_ref: 9.99,
    family_plan: { name: 'Apple TV+ Famille', price: 9.99, max_members: 5, note: 'Partage automatique avec Partage familial Apple' },
  },
  {
    keywords: ['icloud'],
    display_name: 'iCloud+',
    icon: '☁',
    color: '#0284c7',
    bg: '#f0f9ff',
    individual_ref: 2.99,
    family_plan: { name: 'iCloud+ 200 Go Famille', price: 3.99, max_members: 5, note: 'Stockage partagé entre 5 membres' },
  },
  {
    keywords: ['microsoft 365', 'office 365', 'microsoft office'],
    display_name: 'Microsoft 365',
    icon: '💼',
    color: '#0284c7',
    bg: '#f0f9ff',
    individual_ref: 7.00,
    family_plan: { name: 'Microsoft 365 Famille', price: 10.00, max_members: 6, note: 'Jusqu\'à 6 utilisateurs, 1 To chacun' },
  },
  {
    keywords: ['netflix'],
    display_name: 'Netflix',
    icon: '▶',
    color: '#dc2626',
    bg: '#fef2f2',
    individual_ref: 13.49,
    family_plan: { name: 'Netflix Standard', price: 13.49, max_members: 2, note: 'Partage avec 1 membre hors foyer (+5.99€/mois/personne)' },
  },
  {
    keywords: ['disney'],
    display_name: 'Disney+',
    icon: '⭐',
    color: '#1d4ed8',
    bg: '#eff6ff',
    individual_ref: 8.99,
    family_plan: { name: 'Disney+ Standard', price: 8.99, max_members: 4, note: 'Jusqu\'à 4 profils simultanés dans le foyer' },
  },
  {
    keywords: ['amazon prime'],
    display_name: 'Amazon Prime',
    icon: '📦',
    color: '#d97706',
    bg: '#fffbeb',
    individual_ref: 6.99,
    family_plan: { name: 'Amazon Prime Foyer', price: 6.99, max_members: 2, note: 'Partage avec 1 adulte du foyer inclus' },
  },
  {
    keywords: ['canal+', 'canal plus'],
    display_name: 'Canal+',
    icon: '📺',
    color: '#374151',
    bg: '#f9fafb',
    individual_ref: 26.99,
    family_plan: { name: 'Canal+ Famille', price: 26.99, max_members: 4, note: 'Jusqu\'à 4 profils dans le foyer' },
  },
]

function matchOffer(sub: Subscription): ShareableOffer | null {
  const name = sub.company_name.toLowerCase()
  return SHAREABLE_CATALOG.find(offer =>
    offer.keywords.some(kw => name.includes(kw))
  ) || null
}

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function generateInviteMessage(offerName: string, pricePerPerson: number, savings: number, members: number): string {
  return `Salut ! 👋\n\nJe cherche ${members - 1} personne${members - 1 > 1 ? 's' : ''} pour partager mon ${offerName} en famille.\n\n💰 Ça te reviendrait seulement ${pricePerPerson.toFixed(2)} €/mois au lieu de payer seul(e).\n${savings > 0 ? `🎉 Tu économises ${savings.toFixed(2)} €/mois, soit ${(savings * 12).toFixed(0)} €/an !\n` : ''}\nTu es intéressé(e) ? Réponds-moi ! 😊`
}

export default function PartagePage() {
  const router = useRouter()
  const { userId, isLoading } = useUserId()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [members, setMembers] = useState<Record<string, number>>({})
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (userId) getSubscriptions(userId).then(setSubscriptions)
  }, [userId])

  const matches = subscriptions
    .map(sub => ({ sub, offer: matchOffer(sub) }))
    .filter(({ offer }) => offer !== null) as { sub: Subscription; offer: ShareableOffer }[]

  const unmatched = subscriptions.filter(sub => !matchOffer(sub))

  const getMembersCount = (subId: string) => members[subId] ?? 2

  const totalSavings = matches.reduce((sum, { sub, offer }) => {
    const n = getMembersCount(sub.id)
    const pricePerPerson = offer.family_plan.price / n
    const savings = sub.amount - pricePerPerson
    return sum + Math.max(0, savings)
  }, 0)

  if (isLoading || !userId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, color: 'var(--text-primary)' }}>←</button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Partage famille</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Divisez vos coûts avec vos proches</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Hero savings card */}
        {matches.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', borderRadius: '20px', padding: '24px', color: 'white', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', bottom: '-20px', right: '40px', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Économies potentielles</p>
            <p style={{ fontSize: '38px', fontWeight: '800', margin: '0 0 4px', letterSpacing: '-1px' }}>
              {totalSavings.toFixed(2)}<span style={{ fontSize: '18px', fontWeight: '400', opacity: 0.7 }}> €/mois</span>
            </p>
            <p style={{ fontSize: '13px', opacity: 0.6, margin: '0' }}>
              en partageant {matches.length} abonnement{matches.length > 1 ? 's' : ''} avec votre famille
            </p>
          </div>
        )}

        {/* Shareable subscriptions */}
        {matches.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border)', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>👨‍👩‍👧‍👦</div>
            <p style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Aucun abonnement compatible</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Ajoutez des abonnements comme Spotify, Netflix, YouTube Premium...</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {matches.length} abonnement{matches.length > 1 ? 's' : ''} partageables
            </p>

            {matches.map(({ sub, offer }) => {
              const n = getMembersCount(sub.id)
              const pricePerPerson = offer.family_plan.price / n
              const savings = sub.amount - pricePerPerson
              const hasSavings = savings > 0.01

              return (
                <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '16px', marginBottom: '10px', border: '1px solid var(--border)' }}>

                  {/* Service header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: offer.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      {offer.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                      <p style={{ fontSize: '12px', color: offer.color, fontWeight: '600', margin: '0' }}>{offer.family_plan.name}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 2px', textDecoration: 'line-through' }}>{sub.amount.toFixed(2)} €/mois</p>
                      <p style={{ fontSize: '16px', fontWeight: '700', color: hasSavings ? '#16a34a' : 'var(--text-primary)', margin: '0' }}>{pricePerPerson.toFixed(2)} €/mois</p>
                    </div>
                  </div>

                  {/* Members selector */}
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', margin: '0' }}>Nombre de membres</p>
                      <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: '0' }}>
                        {n} / {offer.family_plan.max_members} max
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {Array.from({ length: offer.family_plan.max_members - 1 }, (_, i) => i + 2).map(count => (
                        <button
                          key={count}
                          onClick={() => setMembers(prev => ({ ...prev, [sub.id]: count }))}
                          style={{
                            flex: 1,
                            padding: '7px 4px',
                            borderRadius: '8px',
                            border: 'none',
                            background: n === count ? '#4f46e5' : 'var(--bg-card)',
                            color: n === count ? 'white' : 'var(--text-secondary)',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Savings banner */}
                  {hasSavings ? (
                    <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '18px' }}>💰</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: '700', color: '#15803d', margin: '0' }}>
                          Tu économises {savings.toFixed(2)} €/mois
                        </p>
                        <p style={{ fontSize: '11px', color: '#16a34a', margin: '2px 0 0' }}>
                          Soit {(savings * 12).toFixed(0)} € par an
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '18px' }}>ℹ️</span>
                      <p style={{ fontSize: '12px', color: '#92400e', margin: '0' }}>
                        Partager coûte plus cher qu'un abonnement individuel à ce tarif.
                      </p>
                    </div>
                  )}

                  {/* Note */}
                  {offer.family_plan.note && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 12px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                      ℹ️ {offer.family_plan.note}
                    </p>
                  )}

                  {/* Invite button */}
                  <button
                    onClick={() => { setSharingId(sharingId === sub.id ? null : sub.id); setCopied(false) }}
                    style={{
                      width: '100%',
                      background: sharingId === sub.id ? 'var(--bg-secondary)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: sharingId === sub.id ? 'var(--text-secondary)' : 'white',
                      border: sharingId === sub.id ? '1px solid var(--border)' : 'none',
                      borderRadius: '10px',
                      padding: '10px',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {sharingId === sub.id ? '✕ Fermer' : '📨 Inviter des proches'}
                  </button>

                  {/* Sharing panel */}
                  {sharingId === sub.id && (() => {
                    const msg = generateInviteMessage(offer.display_name, pricePerPerson, savings, n)
                    const waLink = 'https://wa.me/?text=' + encodeURIComponent(msg)
                    const mailLink = 'mailto:?subject=' + encodeURIComponent(`Partage ${offer.display_name} — ${pricePerPerson.toFixed(2)} €/mois`) + '&body=' + encodeURIComponent(msg)
                    return (
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '14px', marginTop: '10px' }}>
                        <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Message d'invitation</p>
                        <div style={{ background: 'var(--bg-card)', borderRadius: '10px', padding: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-wrap', border: '1px solid var(--border)' }}>
                          {msg}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => { navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                            style={{ flex: 1, background: copied ? '#f0fdf4' : 'var(--bg-card)', color: copied ? '#16a34a' : 'var(--text-secondary)', border: `1px solid ${copied ? '#bbf7d0' : 'var(--border)'}`, borderRadius: '8px', padding: '9px 6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            {copied ? '✓ Copié !' : '📋 Copier'}
                          </button>
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ flex: 1, background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            WhatsApp
                          </a>
                          <a
                            href={mailLink}
                            style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            ✉️ Email
                          </a>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </>
        )}

        {/* Non-shareable subscriptions */}
        {unmatched.length > 0 && (
          <>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '16px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Non partageables ({unmatched.length})
            </p>
            {unmatched.map(sub => (
              <div key={sub.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.6 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🔒</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '600', fontSize: '14px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0' }}>Pas de formule familiale détectée</p>
                </div>
                <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-secondary)', margin: '0' }}>{sub.amount.toFixed(2)} €</p>
              </div>
            ))}
          </>
        )}

      </div>
    </main>
  )
}

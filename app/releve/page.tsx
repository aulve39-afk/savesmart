'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addSubscription } from '../store'
import { useUserId } from '../hooks/useUserId'

const categoryConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  streaming:      { label: 'Streaming',  icon: '▶', color: '#7c3aed', bg: '#f5f3ff' },
  telecom_mobile: { label: 'Mobile',     icon: '📱', color: '#0284c7', bg: '#f0f9ff' },
  telecom_box:    { label: 'Box/Fibre',  icon: '🌐', color: '#0369a1', bg: '#e0f2fe' },
  telecom:        { label: 'Telecom',    icon: '📶', color: '#0284c7', bg: '#f0f9ff' },
  energie:        { label: 'Energie',    icon: '⚡', color: '#d97706', bg: '#fffbeb' },
  assurance:      { label: 'Assurance',  icon: '🛡', color: '#059669', bg: '#f0fdf4' },
  saas:           { label: 'SaaS',       icon: '☁', color: '#db2777', bg: '#fdf2f8' },
  other:          { label: 'Autre',      icon: '●',  color: '#6b7280', bg: '#f9fafb' },
}

const cycleLabel: Record<string, string> = {
  monthly: '/mois', yearly: '/an', quarterly: '/trim.', one_time: '', unknown: '',
}

type DetectedSub = {
  company_name: string
  amount: number
  billing_cycle: string
  category: string
  details: Record<string, any>
  selected: boolean
}

const BANKS = [
  { name: 'BNP Paribas', icon: '🏦', color: '#00965e' },
  { name: 'Crédit Agricole', icon: '🌿', color: '#007a4d' },
  { name: 'Société Générale', icon: '🔴', color: '#e30613' },
  { name: 'Caisse d\'Épargne', icon: '🐿️', color: '#007c3a' },
  { name: 'LCL', icon: '🔵', color: '#004a99' },
  { name: 'Boursorama', icon: '💜', color: '#6b21a8' },
  { name: 'N26', icon: '⬛', color: '#1a1a1a' },
  { name: 'Revolut', icon: '🌀', color: '#0166fc' },
]

export default function RelevePage() {
  const { userId, isLoading } = useUserId()
  const [tab, setTab] = useState<'bank' | 'scan'>('bank')
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [detected, setDetected] = useState<DetectedSub[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const maxSize = 1600
        let w = img.width
        let h = img.height
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h * maxSize) / w; w = maxSize }
          else { w = (w * maxSize) / h; h = maxSize }
        }
        canvas.width = w
        canvas.height = h
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = url
    })
  }

  const handleFile = async (file: File) => {
    const base64 = await compressImage(file)
    setPreview(base64)
    setLoading(true)
    setError(null)
    setDetected([])
    try {
      const res = await fetch('/api/releve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDetected((data.subscriptions || []).map((s: any) => ({ ...s, selected: true })))
    } catch {
      setError("Impossible d'analyser ce releve. Reessaie.")
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (i: number) => {
    setDetected(prev => prev.map((s, idx) => idx === i ? { ...s, selected: !s.selected } : s))
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    const toSave = detected.filter(s => s.selected)
    for (const sub of toSave) {
      await addSubscription({
        company_name: sub.company_name,
        amount: sub.amount,
        billing_cycle: sub.billing_cycle,
        category: sub.category,
        details: sub.details || {},
      }, userId)
    }
    setSaving(false)
    setDone(true)
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
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Importer un relevé</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Détection automatique des prélèvements</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--bg-card)', padding: '0 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0' }}>
        {[
          { key: 'bank', label: '🏦 Connexion bancaire', badge: 'Bientôt' },
          { key: 'scan', label: '📄 Scanner un relevé' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'bank' | 'scan')}
            style={{
              flex: 1,
              padding: '13px 8px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #4f46e5' : '2px solid transparent',
              color: tab === t.key ? '#4f46e5' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            {t.label}
            {t.badge && (
              <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* Bank connection tab */}
        {tab === 'bank' && (
          <div>
            {/* Hero */}
            <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '20px', padding: '24px', color: 'white', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <p style={{ fontSize: '28px', margin: '0 0 12px' }}>🔗</p>
              <p style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Connexion bancaire directe</p>
              <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 16px', lineHeight: '1.5' }}>
                Connecte ton compte bancaire et l'IA détecte tous tes abonnements automatiquement, sans scanner.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>⏳</span>
                <p style={{ fontSize: '13px', fontWeight: '700', margin: '0', opacity: 0.9 }}>Disponible bientôt</p>
              </div>
            </div>

            {/* How it works */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <p style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 16px', color: 'var(--text-primary)' }}>Comment ça marche ?</p>
              {[
                { step: '1', icon: '🔐', title: 'Connexion sécurisée', desc: 'Via Bridge ou GoCardless (agréés PSD2 par la Banque de France)' },
                { step: '2', icon: '🤖', title: 'Détection IA', desc: 'L\'IA analyse tes 3 derniers mois et identifie les prélèvements récurrents' },
                { step: '3', icon: '✅', title: 'Ajout en 1 clic', desc: 'Confirme les abonnements détectés et ils apparaissent dans ton espace' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: '14px', marginBottom: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '13px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{item.title}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0', lineHeight: '1.5' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Supported banks */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <p style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Banques compatibles</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>+300 banques françaises et européennes supportées</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {BANKS.map(bank => (
                  <div key={bank.name} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}>
                    <span style={{ fontSize: '16px' }}>{bank.icon}</span>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', margin: '0' }}>{bank.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* PSD2 security */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🛡️</span>
              <div>
                <p style={{ fontWeight: '700', fontSize: '13px', color: '#15803d', margin: '0 0 4px' }}>Sécurité PSD2</p>
                <p style={{ fontSize: '12px', color: '#16a34a', margin: '0', lineHeight: '1.5' }}>
                  Accès en lecture seule. Nous ne pouvons jamais écrire, virer ou modifier quoi que ce soit sur ton compte. Conforme au règlement européen PSD2.
                </p>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => setTab('scan')}
              style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginBottom: '8px' }}
            >
              📄 Scanner un relevé en attendant
            </button>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0 0' }}>
              En attendant la connexion directe, scanne ton relevé PDF
            </p>
          </div>
        )}

        {tab === 'scan' && done ? (
          <div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', margin: '0 0 8px' }}>✅</p>
              <p style={{ fontWeight: '700', fontSize: '16px', color: '#16a34a', margin: '0 0 4px' }}>
                {detected.filter(s => s.selected).length} abonnement{detected.filter(s => s.selected).length > 1 ? 's' : ''} ajoute{detected.filter(s => s.selected).length > 1 ? 's' : ''}
              </p>
              <p style={{ fontSize: '13px', color: '#16a34a', margin: '0' }}>Retrouve-les dans ton espace</p>
            </div>
            <button
              onClick={() => {
                const fromOnboarding = localStorage.getItem('savesmart_onboarding_active') === '1'
                try { localStorage.removeItem('savesmart_onboarding_active') } catch {}
                router.push(fromOnboarding ? '/welcome' : '/')
              }}
              style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
            >
              Voir mon espace
            </button>
          </div>
        ) : (
          <>
            {!preview && (
              <div style={{ border: '2px dashed var(--border-input)', borderRadius: '20px', padding: '40px 24px', textAlign: 'center', background: 'var(--bg-card)', marginBottom: '16px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>🏦</div>
                <p style={{ fontWeight: '700', fontSize: '17px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Importer mon releve</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 24px' }}>Photo, galerie ou fichier PDF</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => cameraRef.current?.click()} style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '16px' }}>📷</span>
                    Camera
                  </button>
                  <button onClick={() => galleryRef.current?.click()} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '12px', padding: '12px 8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '16px' }}>🖼️</span>
                    Galerie
                  </button>
                  <button onClick={() => filesRef.current?.click()} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '12px', padding: '12px 8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '16px' }}>📁</span>
                    Fichiers
                  </button>
                </div>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <input ref={filesRef} type="file" accept="image/*,application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            )}

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>ℹ️</span>
              <p style={{ fontSize: '12px', color: '#92400e', margin: '0', lineHeight: '1.5' }}>
                Tes donnees bancaires ne sont jamais stockees. Seuls les abonnements detectes sont sauvegardes.
              </p>
            </div>

            {preview && (
              <div style={{ marginBottom: '16px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={preview} alt="Releve" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {loading && (
              <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', marginBottom: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>🔍</div>
                <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Analyse en cours...</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Detection des prelevements recurrents</p>
              </div>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                <p style={{ color: '#dc2626', margin: '0', fontSize: '14px' }}>{error}</p>
              </div>
            )}

            {detected.length > 0 && !loading && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', margin: '0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {detected.length} prelevement{detected.length > 1 ? 's' : ''} detecte{detected.length > 1 ? 's' : ''}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
                    {detected.filter(s => s.selected).length} selectionne{detected.filter(s => s.selected).length > 1 ? 's' : ''}
                  </p>
                </div>

                {detected.map((sub, i) => {
                  const config = categoryConfig[sub.category] || categoryConfig.other
                  return (
                    <div key={i} onClick={() => toggleSelect(i)} style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', border: sub.selected ? '2px solid #4f46e5' : '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                        {config.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: '600', fontSize: '14px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{sub.company_name}</p>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: config.color, background: config.bg, padding: '1px 6px', borderRadius: '4px' }}>{config.label}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: '700', fontSize: '15px', margin: '0', color: 'var(--text-primary)' }}>
                          {sub.amount.toFixed(2)} €{cycleLabel[sub.billing_cycle] || ''}
                        </p>
                      </div>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: sub.selected ? '#4f46e5' : 'var(--bg-secondary)', border: sub.selected ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {sub.selected && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                      </div>
                    </div>
                  )
                })}

                <button onClick={handleSave} disabled={saving || detected.filter(s => s.selected).length === 0} style={{ width: '100%', background: saving ? '#a5b4fc' : '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginTop: '8px' }}>
                  {saving ? 'Sauvegarde...' : `Ajouter ${detected.filter(s => s.selected).length} abonnement${detected.filter(s => s.selected).length > 1 ? 's' : ''} à mon espace`}
                </button>

                <button onClick={() => { setPreview(null); setDetected([]); setError(null) }} style={{ width: '100%', background: 'var(--btn-secondary-bg)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '14px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', color: 'var(--btn-secondary-color)', marginTop: '8px' }}>
                  Importer un autre releve
                </button>
              </div>
            )}

            {detected.length === 0 && !loading && preview && !error && (
              <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '24px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Aucun prelevement recurrent detecte sur ce releve.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
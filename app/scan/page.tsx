'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addSubscription } from '../store'
import { useUserId } from '../hooks/useUserId'

/** Sanitise un montant venant de l'IA : nombre valide, positif, ≤ 9 999 € */
function sanitizeAmount(val: unknown): number {
  const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''))
  if (isNaN(n) || n <= 0) return 0
  if (n > 9999) return 9999
  return Math.round(n * 100) / 100
}

/** Tronque un nom de service trop long */
function sanitizeName(val: unknown): string {
  const s = String(val ?? '').trim()
  return s.slice(0, 100)
}

export default function ScanPage() {
  const { userId, isLoading } = useUserId()
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const maxSize = 1024
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
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = url
    })
  }

  const handleFile = async (file: File) => {
    const base64 = await compressImage(file)
    setPreview(base64)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch {
      setError("Impossible d'analyser cette image. Reessaie.")
    } finally {
      setLoading(false)
    }
  }

  const openCamera = () => {
    if (!inputRef.current) return
    inputRef.current.accept = 'image/*'
    inputRef.current.setAttribute('capture', 'environment')
    inputRef.current.click()
  }

  const openGallery = () => {
    if (!inputRef.current) return
    inputRef.current.accept = 'image/*'
    inputRef.current.removeAttribute('capture')
    inputRef.current.click()
  }

  const openFiles = () => {
    if (!inputRef.current) return
    inputRef.current.accept = 'image/*,application/pdf,.pdf'
    inputRef.current.removeAttribute('capture')
    inputRef.current.click()
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
    monthly: 'par mois', yearly: 'par an', quarterly: 'par trimestre', one_time: 'unique', unknown: '',
  }

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  if (isLoading || !userId) return (
    <div style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* Header skeleton */}
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="skeleton" style={{ width: '90px', height: '20px' }} />
          <div className="skeleton" style={{ width: '150px', height: '13px' }} />
        </div>
      </div>
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Upload zone skeleton */}
        <div className="skeleton" style={{ borderRadius: '20px', height: '240px' }} />
        {/* Action buttons skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="skeleton" style={{ borderRadius: '14px', height: '52px' }} />
          <div className="skeleton" style={{ borderRadius: '14px', height: '52px' }} />
        </div>
        <div className="skeleton" style={{ borderRadius: '14px', height: '52px' }} />
      </div>
    </div>
  )

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Scanner</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Photo, galerie ou fichier</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {!preview && (
          <div style={{ border: '2px dashed var(--border-input)', borderRadius: '20px', padding: '40px 24px', textAlign: 'center', background: 'var(--bg-card)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>📷</div>
            <p style={{ fontWeight: '700', fontSize: '17px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Analyser une facture</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Choisis comment importer ton document</p>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>🔒</span>
              <p style={{ fontSize: '11px', color: '#15803d', margin: '0', fontWeight: '600' }}>Image analysée localement · Non conservée sur nos serveurs</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={openCamera} style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '16px' }}>📷</span>
                Camera
              </button>
              <button onClick={openGallery} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '12px', padding: '12px 8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '16px' }}>🖼️</span>
                Galerie
              </button>
              <button onClick={openFiles} style={{ flex: 1, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '12px', padding: '12px 8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '16px' }}>📁</span>
                Fichiers
              </button>
            </div>
            <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        )}

        {preview && (
          <div style={{ marginBottom: '16px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={preview} alt="Facture" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {loading && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>🔍</div>
            <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Analyse en cours...</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Detection automatique par IA</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '16px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <p style={{ color: '#dc2626', margin: '0', fontSize: '14px', fontWeight: '500' }}>{error}</p>
          </div>
        )}

        {result && !loading && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '24px', marginBottom: '12px', border: '1px solid var(--border)' }}>
            {result.is_invoice === false ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0' }}>Ce document ne semble pas etre une facture.</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                  <p style={{ fontSize: '13px', color: '#22c55e', fontWeight: '700', margin: '0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Facture detectee</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: (categoryConfig[result.category] || categoryConfig.other).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    {(categoryConfig[result.category] || categoryConfig.other).icon}
                  </div>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '20px', margin: '0 0 2px', color: 'var(--text-primary)' }}>{result.company_name}</p>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: (categoryConfig[result.category] || categoryConfig.other).color, background: (categoryConfig[result.category] || categoryConfig.other).bg, padding: '2px 8px', borderRadius: '6px' }}>
                      {(categoryConfig[result.category] || categoryConfig.other).label}
                    </span>
                  </div>
                </div>
                {(() => {
                  const safeAmount = sanitizeAmount(result.amount)
                  const safeName   = sanitizeName(result.company_name)
                  const amountOk   = safeAmount > 0
                  return (
                    <>
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginBottom: amountOk ? '20px' : '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Montant détecté</p>
                        {amountOk ? (
                          <p style={{ fontWeight: '800', fontSize: '24px', color: '#4f46e5', margin: '0' }}>
                            {safeAmount.toFixed(2)} €
                            <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-muted)' }}> {cycleLabel[result.billing_cycle] || ''}</span>
                          </p>
                        ) : (
                          <p style={{ fontSize: '13px', color: '#d97706', fontWeight: '700', margin: '0' }}>⚠ Non détecté</p>
                        )}
                      </div>
                      {!amountOk && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#92400e' }}>
                          Le montant n'a pas pu être lu. Tu pourras l'ajuster manuellement après l'ajout.
                        </div>
                      )}
                    </>
                  )
                })()}
                <button
                  onClick={async () => {
                    if (!userId) return
                    await addSubscription({
                      company_name: sanitizeName(result.company_name),
                      amount: sanitizeAmount(result.amount),
                      billing_cycle: result.billing_cycle,
                      category: result.category,
                      details: result.details || {},
                    }, userId)
                    const fromOnboarding = localStorage.getItem('savesmart_onboarding_active') === '1'
                    try { localStorage.removeItem('savesmart_onboarding_active') } catch {}
                    router.push(fromOnboarding ? '/welcome' : '/')
                  }}
                  style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
                >
                  Ajouter à mon espace
                </button>
              </>
            )}
          </div>
        )}

        {preview && !loading && (
          <button
            onClick={() => { setPreview(null); setResult(null); setError(null) }}
            style={{ width: '100%', background: 'var(--btn-secondary-bg)', border: '1px solid var(--btn-secondary-border)', borderRadius: '12px', padding: '14px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', color: 'var(--btn-secondary-color)' }}
          >
            Scanner une autre facture
          </button>
        )}
      </div>
    </main>
  )
}
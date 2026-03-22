'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addSubscription } from '../store'

export default function ScanPage() {
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

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Scanner</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Photo ou import depuis la galerie</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {!preview && (
          <div
            onClick={() => inputRef.current?.click()}
            style={{ border: '2px dashed var(--border-input)', borderRadius: '20px', padding: '56px 24px', textAlign: 'center', background: 'var(--bg-card)', cursor: 'pointer' }}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>📷</div>
            <p style={{ fontWeight: '700', fontSize: '17px', margin: '0 0 6px', color: 'var(--text-primary)' }}>Prendre une photo</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>JPG, PNG — max 10 MB</p>
            <span style={{ background: '#4f46e5', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600' }}>
              Choisir un fichier
            </span>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0' }}>Montant detecte</p>
                  <p style={{ fontWeight: '800', fontSize: '24px', color: '#4f46e5', margin: '0' }}>
                    {result.amount} €
                    <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-muted)' }}> {cycleLabel[result.billing_cycle] || ''}</span>
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await addSubscription({
                      company_name: result.company_name,
                      amount: result.amount,
                      billing_cycle: result.billing_cycle,
                      category: result.category,
                      details: result.details || {},
                    })
                    router.push('/')
                  }}
                  style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
                >
                  Ajouter au dashboard
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
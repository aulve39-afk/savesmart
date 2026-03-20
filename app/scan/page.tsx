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

  const handleFile = async (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
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
      } catch (err) {
        setError("Impossible d'analyser cette image. Réessaie.")
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const categoryLabel: Record<string, string> = {
    streaming: 'Streaming',
    telecom: 'Télécom',
    energie: 'Énergie',
    assurance: 'Assurance',
    saas: 'SaaS',
    other: 'Autre',
  }

  const cycleLabel: Record<string, string> = {
    monthly: 'par mois',
    yearly: 'par an',
    quarterly: 'par trimestre',
    one_time: 'unique',
    unknown: '',
  }

  return (
    <main style={{
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '430px',
      margin: '0 auto',
      background: '#f5f5f5',
      minHeight: '100vh',
    }}>
      <div style={{
        background: 'white',
        padding: '20px 24px 16px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button onClick={() => router.push('/')} style={{
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '0',
        }}>←</button>
        <h1 style={{ fontSize: '18px', fontWeight: '600', margin: '0' }}>Scanner une facture</h1>
      </div>

      <div style={{ padding: '16px' }}>
        {!preview && (
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              border: '2px dashed #d1d5db',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            <p style={{ fontSize: '48px', margin: '0 0 12px' }}>📷</p>
            <p style={{ fontWeight: '600', fontSize: '16px', margin: '0 0 6px' }}>Prendre une photo</p>
            <p style={{ fontSize: '13px', color: '#888', margin: '0' }}>ou importer depuis ta galerie</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {preview && (
          <div style={{ marginBottom: '16px' }}>
            <img src={preview} alt="Facture" style={{
              width: '100%',
              borderRadius: '12px',
              maxHeight: '200px',
              objectFit: 'cover',
            }} />
          </div>
        )}

        {loading && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '24px', margin: '0 0 8px' }}>🔍</p>
            <p style={{ fontWeight: '600', margin: '0 0 4px' }}>Analyse en cours...</p>
            <p style={{ fontSize: '13px', color: '#888', margin: '0' }}>L'IA analyse ta facture</p>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}>
            <p style={{ color: '#dc2626', margin: '0', fontSize: '14px' }}>{error}</p>
          </div>
        )}

        {result && !loading && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '16px',
          }}>
            {result.is_invoice === false ? (
              <p style={{ textAlign: 'center', color: '#888' }}>Ce document ne semble pas être une facture.</p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#22c55e', fontWeight: '600', margin: '0 0 12px' }}>✓ Facture détectée</p>
                <p style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>{result.company_name}</p>
                <p style={{ fontSize: '32px', fontWeight: '700', color: '#6c63ff', margin: '0 0 4px' }}>
                  {result.amount} €
                  <span style={{ fontSize: '14px', fontWeight: '400', color: '#888' }}> {cycleLabel[result.billing_cycle] || ''}</span>
                </p>
                <p style={{ fontSize: '13px', color: '#888', margin: '0 0 20px' }}>
                  {categoryLabel[result.category] || result.category}
                </p>
                <button
                  onClick={() => {
                    addSubscription({
                      company_name: result.company_name,
                      amount: result.amount,
                      billing_cycle: result.billing_cycle,
                      category: result.category,
                    })
                    router.push('/')
                  }}
                  style={{
                    width: '100%',
                    background: '#6c63ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px',
                    fontWeight: '600',
                    fontSize: '15px',
                    cursor: 'pointer',
                  }}
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
            style={{
              width: '100%',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '14px',
              fontWeight: '600',
              fontSize: '15px',
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            Scanner une autre facture
          </button>
        )}
      </div>
    </main>
  )
}
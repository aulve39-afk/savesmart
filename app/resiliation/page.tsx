'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useOnboarding as useUserId } from '../hooks/useOnboarding'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const MOTIFS = [
  { value: 'libre', label: 'Sans engagement', icon: '✅', desc: 'Mon contrat est libre, sans frais' },
  { value: 'engagement', label: 'Sous engagement', icon: '📋', desc: 'Je veux connaître les frais exacts' },
  { value: 'demenagement', label: 'Déménagement', icon: '🏠', desc: 'Motif légal — résiliation sans frais' },
  { value: 'insatisfaction', label: 'Insatisfaction', icon: '😤', desc: 'Qualité de service insuffisante' },
  { value: 'sante', label: 'Raison de santé', icon: '🏥', desc: 'Force majeure — résiliation sans frais' },
  { value: 'deces', label: 'Décès du titulaire', icon: '🕊', desc: 'Clôture du contrat pour ayant droit' },
]

function ResiliationContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { isLoading } = useUserId()

  // ⚠️ Tous les hooks AVANT tout return conditionnel (règle des hooks React)
  const [step, setStep] = useState<'motif' | 'form' | 'letter'>('motif')
  const [selectedMotif, setSelectedMotif] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [ville, setVille] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLetter, setAiLetter] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const name = params.get('name') || 'Abonnement'
  const engagementEndDate = params.get('engagement') || ''

  if (isLoading) return (
    <div style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="skeleton" style={{ width: '80px', height: '20px' }} />
          <div className="skeleton" style={{ width: '140px', height: '13px' }} />
        </div>
      </div>
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton" style={{ borderRadius: '14px', height: '68px' }} />
        ))}
        <div className="skeleton" style={{ borderRadius: '14px', height: '52px', marginTop: '4px' }} />
      </div>
    </div>
  )

  const formComplete = !!(prenom && nom && adresse && ville)

  const inputStyle = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border-input)',
    fontSize: '14px',
    marginBottom: '8px',
    boxSizing: 'border-box' as const,
    fontFamily: font,
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    outline: 'none',
  }

  const handleGenerateLetter = async () => {
    if (!formComplete) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/resiliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, nom, adresse, ville, service: name, motif: selectedMotif, engagementEndDate }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiLetter(data.letter)
      setStep('letter')
    } catch {
      setError('Erreur lors de la génération. Vérifie ta connexion.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    const lettre = document.getElementById('lettre-ai')?.innerHTML
    const win = window.open('', '_blank')
    if (!win || !lettre) return
    win.document.write(`
      <html>
        <head>
          <title>Lettre de résiliation — ${name}</title>
          <style>
            body { font-family: Georgia, serif; max-width: 680px; margin: 60px auto; padding: 0 40px; font-size: 15px; line-height: 1.9; color: #1e293b; }
            p { margin: 0 0 16px; }
            strong { font-weight: bold; }
          </style>
        </head>
        <body>${lettre}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  const handleEmail = () => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(aiLetter, 'text/html')
    const text = doc.body.innerText || doc.body.textContent || ''
    const sujet = encodeURIComponent('Demande de résiliation — ' + name)
    const corps = encodeURIComponent(text)
    window.location.href = 'mailto:?subject=' + sujet + '&body=' + corps
    setSent(true)
  }

  const motifLabel = MOTIFS.find(m => m.value === selectedMotif)?.label || ''

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => step === 'motif' ? router.push('/') : step === 'form' ? setStep('motif') : setStep('form')}
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
        >←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Résilier</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{name}{motifLabel ? ` · ${motifLabel}` : ''}</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* Step 1: Motif selector */}
        {step === 'motif' && (
          <>
            <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Quel est ton motif ?</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>L'IA va adapter ta lettre avec les arguments juridiques appropriés</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {MOTIFS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMotif(m.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      border: selectedMotif === m.value ? '2px solid #4f46e5' : '1px solid var(--border)',
                      background: selectedMotif === m.value ? '#eef2ff' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '24px', flexShrink: 0 }}>{m.icon}</span>
                    <div>
                      <p style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 2px', color: selectedMotif === m.value ? '#4f46e5' : 'var(--text-primary)' }}>{m.label}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{m.desc}</p>
                    </div>
                    {selectedMotif === m.value && (
                      <div style={{ marginLeft: 'auto', width: '20px', height: '20px', borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => selectedMotif && setStep('form')}
              disabled={!selectedMotif}
              style={{
                width: '100%',
                background: selectedMotif ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'var(--bg-secondary)',
                color: selectedMotif ? 'white' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '14px',
                padding: '16px',
                fontWeight: '700',
                fontSize: '15px',
                cursor: selectedMotif ? 'pointer' : 'not-allowed',
              }}
            >
              Continuer →
            </button>
          </>
        )}

        {/* Step 2: User info form */}
        {step === 'form' && (
          <>
            <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '18px' }}>⚖️</span>
              <div>
                <p style={{ fontWeight: '700', fontSize: '13px', color: '#4338ca', margin: '0 0 2px' }}>{MOTIFS.find(m => m.value === selectedMotif)?.icon} {MOTIFS.find(m => m.value === selectedMotif)?.label}</p>
                <p style={{ fontSize: '12px', color: '#6366f1', margin: '0' }}>L'IA va générer une lettre juridiquement adaptée</p>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '14px', border: '1px solid var(--border)' }}>
              <p style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Tes informations</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Pour personnaliser la lettre</p>
              <input style={inputStyle} placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} autoComplete="given-name" autoCapitalize="words" />
              <input style={inputStyle} placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} autoComplete="family-name" autoCapitalize="words" />
              <input style={inputStyle} placeholder="Adresse" value={adresse} onChange={e => setAdresse(e.target.value)} autoComplete="street-address" autoCapitalize="sentences" />
              <input style={{ ...inputStyle, marginBottom: '0' }} placeholder="Code postal et ville" value={ville} onChange={e => setVille(e.target.value)} autoComplete="postal-code" />
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>🔒</span>
              <p style={{ color: '#92400e', fontSize: '12px', fontWeight: '500', margin: '0' }}>
                Tes infos restent sur ton téléphone. Rien n'est stocké.
              </p>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
                <p style={{ color: '#dc2626', fontSize: '13px', margin: '0' }}>{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerateLetter}
              disabled={!formComplete || loading}
              style={{
                width: '100%',
                background: formComplete ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'var(--bg-secondary)',
                color: formComplete ? 'white' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '14px',
                padding: '16px',
                fontWeight: '700',
                fontSize: '15px',
                cursor: formComplete && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '16px' }}>⚙️</span>
                  L'IA rédige ta lettre...
                </>
              ) : (
                <>✂️ Générer ma lettre juridique</>
              )}
            </button>
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
          </>
        )}

        {/* Step 3: AI Generated Letter */}
        {step === 'letter' && (
          <>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>⚖️</span>
              <div>
                <p style={{ fontWeight: '700', fontSize: '13px', color: '#16a34a', margin: '0 0 2px' }}>Lettre juridique générée par l'IA ✓</p>
                <p style={{ fontSize: '12px', color: '#15803d', margin: '0' }}>Adaptée à ton motif : {motifLabel}</p>
              </div>
            </div>

            <div
              id="lettre-ai"
              style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '24px',
                border: '2px solid #86efac',
                fontSize: '13px',
                lineHeight: '1.8',
                color: 'var(--text-secondary)',
                marginBottom: '16px',
                overflow: 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: aiLetter }}
            />

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
              <p style={{ color: '#92400e', fontSize: '12px', fontWeight: '500', margin: '0' }}>
                Vérifie les informations avant d'envoyer. L'IA peut faire des erreurs.
              </p>
            </div>

            {sent ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>✅</span>
                <p style={{ fontWeight: '700', color: '#16a34a', margin: '0 0 4px', fontSize: '15px' }}>Email ouvert !</p>
                <p style={{ color: '#15803d', fontSize: '13px', margin: '0' }}>Copie la lettre depuis l'aperçu ci-dessus si besoin.</p>
              </div>
            ) : (
              <>
                <button
                  onClick={handlePrint}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '16px',
                    fontWeight: '700',
                    fontSize: '15px',
                    cursor: 'pointer',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>✂️</span>
                  Imprimer / Sauvegarder en PDF
                </button>

                <button
                  onClick={handleEmail}
                  style={{
                    width: '100%',
                    background: 'var(--btn-secondary-bg)',
                    color: 'var(--btn-secondary-color)',
                    border: '1px solid var(--btn-secondary-border)',
                    borderRadius: '14px',
                    padding: '15px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>✉️</span>
                  Envoyer par email
                </button>

                <button
                  onClick={() => { setStep('form'); setAiLetter('') }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '13px',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Régénérer la lettre
                </button>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default function ResiliationPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>}>
      <ResiliationContent />
    </Suspense>
  )
}

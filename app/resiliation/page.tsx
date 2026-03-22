'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function ResiliationContent() {
  const router = useRouter()
  const params = useSearchParams()
  const name = params.get('name') || 'Abonnement'

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [ville, setVille] = useState('')
  const [sent, setSent] = useState(false)

  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const prenomDisplay = prenom || '[Prénom]'
  const nomDisplay    = nom    || '[Nom]'
  const adresseDisplay = adresse || '[Votre adresse]'
  const villeDisplay  = ville  || '[Code postal et ville]'
  const formComplete  = !!(prenom && nom && adresse && ville)

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

  const handlePrint = () => {
    const lettre = document.getElementById('lettre-print')?.innerHTML
    const win = window.open('', '_blank')
    if (!win || !lettre) return
    win.document.write(`
      <html>
        <head>
          <title>Lettre de résiliation — ${name}</title>
          <style>
            body { font-family: Georgia, serif; max-width: 680px; margin: 60px auto; padding: 0 40px; font-size: 15px; line-height: 1.9; color: #1e293b; }
            .header { margin-bottom: 40px; }
            .destinataire { margin-bottom: 40px; }
            .date { color: #64748b; font-size: 13px; margin-bottom: 24px; }
            .objet { font-weight: bold; margin-bottom: 24px; border-bottom: 2px solid #1e293b; padding-bottom: 8px; }
            p { margin: 0 0 16px; }
            .signature { margin-top: 40px; font-weight: bold; }
            hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
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
    const sujet = encodeURIComponent('Demande de résiliation — ' + name)
    const corps = encodeURIComponent(
      prenomDisplay + ' ' + nomDisplay + '\n' +
      adresseDisplay + '\n' + villeDisplay + '\n\n' +
      'Service Résiliation\n' + name + '\n\n' +
      'Fait le ' + today + '\n\n' +
      'Objet : Demande de résiliation de mon abonnement\n\n' +
      'Madame, Monsieur,\n\n' +
      'Je soussigné(e) ' + prenomDisplay + ' ' + nomDisplay + ', titulaire d\'un abonnement auprès de ' + name + ', ' +
      'vous informe par la présente de ma volonté de résilier mon contrat ' +
      'dans les meilleurs délais, conformément aux conditions générales de vente.\n\n' +
      'Je vous demande de bien vouloir confirmer la bonne réception de ce courrier ' +
      'ainsi que la date effective de résiliation de mon abonnement.\n\n' +
      'Veuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n' +
      prenomDisplay + ' ' + nomDisplay
    )
    window.location.href = 'mailto:?subject=' + sujet + '&body=' + corps
    setSent(true)
  }

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Résilier</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{name}</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* Prévisualisation live de la lettre */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: formComplete ? '#22c55e' : '#d97706', flexShrink: 0 }} />
            <p style={{ fontSize: '11px', fontWeight: '700', color: formComplete ? '#16a34a' : '#d97706', margin: '0', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {formComplete ? 'Aperçu — lettre prête ✓' : 'Aperçu en direct — remplis le formulaire'}
            </p>
          </div>

          {/* Letter card */}
          <div
            id="lettre-print"
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              border: formComplete ? '2px solid #86efac' : '1px solid var(--border)',
              fontSize: '13px',
              lineHeight: '1.8',
              color: 'var(--text-secondary)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'border-color 0.3s',
            }}
          >
            {/* Watermark si pas complet */}
            {!formComplete && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-20deg)', fontSize: '48px', opacity: 0.04, fontWeight: '900', color: '#000', pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none' }}>
                APERÇU
              </div>
            )}

            {/* Expéditeur */}
            <p style={{ margin: '0', fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
              {prenomDisplay} {nomDisplay}
            </p>
            <p style={{ margin: '0', color: formComplete ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: !adresse ? 'italic' : 'normal' }}>{adresseDisplay}</p>
            <p style={{ margin: '0 0 20px', color: formComplete ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: !ville ? 'italic' : 'normal' }}>{villeDisplay}</p>

            {/* Destinataire */}
            <p style={{ margin: '0', fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>Service Résiliation</p>
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)' }}>{name}</p>

            {/* Date + lieu */}
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'right' }}>
              Fait le {today}
            </p>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 16px' }} />

            {/* Objet */}
            <p style={{ margin: '0 0 14px', fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>
              Objet : Demande de résiliation de mon abonnement
            </p>

            <p style={{ margin: '0 0 12px' }}>Madame, Monsieur,</p>

            <p style={{ margin: '0 0 12px' }}>
              Je soussigné(e) <strong style={{ color: 'var(--text-primary)' }}>{prenomDisplay} {nomDisplay}</strong>, titulaire d'un abonnement auprès de <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>, vous informe par la présente de ma volonté de résilier mon contrat dans les meilleurs délais, conformément aux conditions générales de vente.
            </p>

            <p style={{ margin: '0 0 12px' }}>
              Je vous demande de bien vouloir confirmer la bonne réception de ce courrier ainsi que la date effective de résiliation de mon abonnement.
            </p>

            <p style={{ margin: '0 0 24px' }}>
              Veuillez agréer, Madame, Monsieur, mes salutations distinguées.
            </p>

            <p style={{ margin: '0', fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
              {prenomDisplay} {nomDisplay}
            </p>
          </div>
        </div>

        {/* Formulaire */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '14px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: '700', fontSize: '14px', margin: '0 0 4px', color: 'var(--text-primary)' }}>Tes informations</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>La lettre se met à jour en temps réel ↑</p>
          <input style={inputStyle} placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} />
          <input style={inputStyle} placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} />
          <input style={inputStyle} placeholder="Adresse" value={adresse} onChange={e => setAdresse(e.target.value)} />
          <input style={{ ...inputStyle, marginBottom: '0' }} placeholder="Code postal et ville" value={ville} onChange={e => setVille(e.target.value)} />
        </div>

        {/* Privacy notice */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>🔒</span>
          <p style={{ color: '#92400e', fontSize: '12px', fontWeight: '500', margin: '0' }}>
            Tes infos restent sur ton téléphone. Rien n'est envoyé ni stocké.
          </p>
        </div>

        {/* CTA buttons */}
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
              disabled={!formComplete}
              style={{
                width: '100%',
                background: formComplete ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'var(--bg-secondary)',
                color: formComplete ? 'white' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '14px',
                padding: '16px',
                fontWeight: '700',
                fontSize: '15px',
                cursor: formComplete ? 'pointer' : 'not-allowed',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '18px' }}>✂️</span>
              {formComplete ? 'Imprimer / Sauvegarder en PDF' : 'Remplis le formulaire pour continuer'}
            </button>

            <button
              onClick={handleEmail}
              disabled={!formComplete}
              style={{
                width: '100%',
                background: formComplete ? 'var(--btn-secondary-bg)' : 'var(--bg-secondary)',
                color: formComplete ? 'var(--btn-secondary-color)' : 'var(--text-muted)',
                border: formComplete ? '1px solid var(--btn-secondary-border)' : '1px solid var(--border)',
                borderRadius: '14px',
                padding: '15px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: formComplete ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '16px' }}>✉️</span>
              Envoyer par email
            </button>
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

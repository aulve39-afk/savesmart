'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function ResiliationContent() {
  const router = useRouter()
  const params = useSearchParams()
  const name = params.get('name') || 'Abonnement'

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [ville, setVille] = useState('')
  const [generated, setGenerated] = useState(false)

  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

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

  const handlePrint = () => {
    const lettre = document.getElementById('lettre-print')?.innerHTML
    const win = window.open('', '_blank')
    if (!win || !lettre) return
    win.document.write(`
      <html>
        <head>
          <title>Lettre de resiliation - ${name}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              max-width: 700px;
              margin: 60px auto;
              padding: 0 40px;
              font-size: 15px;
              line-height: 1.8;
              color: #334155;
            }
            p { margin: 0 0 14px; }
            hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
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
    const sujet = encodeURIComponent('Demande de resiliation - ' + name)
    const corps = encodeURIComponent(
      prenom + ' ' + nom + '\n' +
      adresse + '\n' +
      ville + '\n\n' +
      'Service Resiliation\n' +
      name + '\n\n' +
      'Fait le ' + today + '\n\n' +
      'Objet : Demande de resiliation de mon abonnement\n\n' +
      'Madame, Monsieur,\n\n' +
      'Je soussigne(e) ' + prenom + ' ' + nom + ', titulaire d un abonnement aupres de ' + name + ', ' +
      'vous informe par la presente de ma volonte de resilier mon contrat ' +
      'dans les meilleurs delais, conformement aux conditions generales de vente.\n\n' +
      'Je vous demande de bien vouloir confirmer la bonne reception de ce courrier ' +
      'ainsi que la date effective de resiliation de mon abonnement.\n\n' +
      'Veuillez agreer, Madame, Monsieur, mes salutations distinguees.\n\n' +
      prenom + ' ' + nom
    )
    window.location.href = 'mailto:?subject=' + sujet + '&body=' + corps
  }

  if (generated) {
    return (
      <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

        <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => setGenerated(false)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Lettre generee</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{name}</p>
          </div>
        </div>

        <div style={{ padding: '20px 16px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>✅</span>
            <p style={{ color: '#16a34a', fontWeight: '600', fontSize: '14px', margin: '0' }}>
              Lettre prete — Imprime ou envoie par email
            </p>
          </div>

          <div id="lettre-print" style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '28px', marginBottom: '16px', border: '1px solid var(--border)', fontSize: '14px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
            <p style={{ margin: '0', fontWeight: '700', color: 'var(--text-primary)', fontSize: '15px' }}>{prenom} {nom}</p>
            <p style={{ margin: '0', color: 'var(--text-secondary)' }}>{adresse}</p>
            <p style={{ margin: '0 0 28px', color: 'var(--text-secondary)' }}>{ville}</p>

            <p style={{ margin: '0', fontWeight: '700', color: 'var(--text-primary)' }}>Service Resiliation</p>
            <p style={{ margin: '0 0 28px', color: 'var(--text-secondary)' }}>{name}</p>

            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '13px' }}>Fait le {today}</p>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 20px' }} />

            <p style={{ margin: '0 0 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Objet : Demande de resiliation de mon abonnement
            </p>

            <p style={{ margin: '0 0 14px' }}>Madame, Monsieur,</p>

            <p style={{ margin: '0 0 14px' }}>
              Je soussigne(e) {prenom} {nom}, titulaire d un abonnement aupres de {name},
              vous informe par la presente de ma volonte de resilier mon contrat
              dans les meilleurs delais, conformement aux conditions generales de vente.
            </p>

            <p style={{ margin: '0 0 14px' }}>
              Je vous demande de bien vouloir confirmer la bonne reception de ce courrier
              ainsi que la date effective de resiliation de mon abonnement.
            </p>

            <p style={{ margin: '0 0 28px' }}>
              Veuillez agreer, Madame, Monsieur, mes salutations distinguees.
            </p>

            <p style={{ margin: '0', fontWeight: '700', color: 'var(--text-primary)' }}>{prenom} {nom}</p>
          </div>

          <button
            onClick={handlePrint}
            style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginBottom: '10px' }}
          >
            Imprimer / Sauvegarder en PDF
          </button>

          <button
            onClick={handleEmail}
            style={{ width: '100%', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '15px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '16px' }}>✉️</span>
            Envoyer par email
          </button>

          <button
            onClick={() => router.push('/')}
            style={{ width: '100%', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-color)', border: '1px solid var(--btn-secondary-border)', borderRadius: '14px', padding: '15px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
          >
            Retour au dashboard
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Resilier</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{name}</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '18px' }}>ℹ️</span>
          <p style={{ color: '#92400e', fontSize: '13px', fontWeight: '500', margin: '0' }}>
            Tes infos servent uniquement a generer la lettre. Rien n est envoye ni stocke.
          </p>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 16px', color: 'var(--text-primary)' }}>Tes informations</p>
          <input style={inputStyle} placeholder="Prenom" value={prenom} onChange={e => setPrenom(e.target.value)} />
          <input style={inputStyle} placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} />
          <input style={inputStyle} placeholder="Adresse" value={adresse} onChange={e => setAdresse(e.target.value)} />
          <input style={inputStyle} placeholder="Code postal et ville" value={ville} onChange={e => setVille(e.target.value)} />
        </div>

        <button
          onClick={() => {
            if (!prenom || !nom || !adresse || !ville) {
              alert('Remplis tous les champs !')
              return
            }
            setGenerated(true)
          }}
          style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
        >
          Generer la lettre
        </button>
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
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
    border: '1px solid #e2e8f0',
    fontSize: '15px',
    marginBottom: '10px',
    boxSizing: 'border-box' as const,
    fontFamily: font,
    background: '#f8fafc',
    color: '#1e293b',
    outline: 'none',
  }

  if (generated) {
    return (
      <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px' }}>
        <div style={{ background: 'white', padding: '52px 24px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => setGenerated(false)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px' }}>Lettre generee</h1>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0' }}>{name}</p>
          </div>
        </div>

        <div style={{ padding: '20px 16px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>✅</span>
            <p style={{ color: '#16a34a', fontWeight: '600', fontSize: '14px', margin: '0' }}>
              Lettre prete — Imprime pour sauvegarder en PDF
            </p>
          </div>

          {/* Lettre */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', marginBottom: '16px', border: '1px solid #f1f5f9', fontSize: '14px', lineHeight: '1.8', color: '#334155' }}>
            <div style={{ marginBottom: '28px' }}>
              <p style={{ margin: '0', fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>{prenom} {nom}</p>
              <p style={{ margin: '0', color: '#64748b' }}>{adresse}</p>
              <p style={{ margin: '0', color: '#64748b' }}>{ville}</p>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <p style={{ margin: '0', fontWeight: '700', color: '#1e293b' }}>Service Resiliation</p>
              <p style={{ margin: '0', color: '#64748b' }}>{name}</p>
            </div>

            <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '13px' }}>
              Fait le {today}
            </p>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
              <p style={{ margin: '0 0 16px', fontWeight: '700', color: '#1e293b' }}>
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

              <p style={{ margin: '0', fontWeight: '700', color: '#1e293b' }}>{prenom} {nom}</p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginBottom: '10px' }}
          >
            Imprimer / Sauvegarder en PDF
          </button>

          <button
            onClick={() => router.push('/')}
            style={{ width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', color: '#64748b' }}
          >
            Retour au dashboard
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ background: 'white', padding: '52px 24px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px' }}>Resilier</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0' }}>{name}</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '18px' }}>ℹ️</span>
          <p style={{ color: '#92400e', fontSize: '13px', fontWeight: '500', margin: '0' }}>
            Tes infos servent uniquement a generer la lettre. Rien n est envoye ni stocke.
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid #f1f5f9' }}>
          <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 16px', color: '#1e293b' }}>Tes informations</p>
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
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>}>
      <ResiliationContent />
    </Suspense>
  )
}
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

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '15px',
    marginBottom: '10px',
    boxSizing: 'border-box' as const,
    fontFamily: 'system-ui, sans-serif',
  }

  if (generated) {
    return (
      <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '430px', margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: '32px' }}>
        <div style={{ background: 'white', padding: '20px 24px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setGenerated(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0' }}>←</button>
          <h1 style={{ fontSize: '18px', fontWeight: '600', margin: '0' }}>Lettre generee</h1>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ color: '#16a34a', fontWeight: '600', fontSize: '14px', margin: '0' }}>
              Lettre prete ! Appuie sur Imprimer pour sauvegarder en PDF.
            </p>
          </div>

          {/* Lettre */}
          <div id="lettre" style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '16px', fontSize: '14px', lineHeight: '1.7' }}>
            <div style={{ marginBottom: '24px' }}>
              <p style={{ margin: '0', fontWeight: '600' }}>{prenom} {nom}</p>
              <p style={{ margin: '0', color: '#555' }}>{adresse}</p>
              <p style={{ margin: '0', color: '#555' }}>{ville}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ margin: '0', fontWeight: '600' }}>Service Resiliation</p>
              <p style={{ margin: '0', color: '#555' }}>{name}</p>
            </div>

            <p style={{ margin: '0 0 16px', color: '#555' }}>
              Fait le {today}
            </p>

            <p style={{ margin: '0 0 12px', fontWeight: '600' }}>
              Objet : Demande de resiliation de mon abonnement
            </p>

            <p style={{ margin: '0 0 12px' }}>Madame, Monsieur,</p>

            <p style={{ margin: '0 0 12px' }}>
              Je soussigne(e) {prenom} {nom}, titulaire d un abonnement aupres de {name},
              vous informe par la presente de ma volonte de resilier mon contrat, 
              et ce dans les meilleurs delais conformement aux conditions generales de vente.
            </p>

            <p style={{ margin: '0 0 12px' }}>
              Je vous demande de bien vouloir confirmer la bonne reception de ce courrier 
              ainsi que la date effective de resiliation de mon abonnement.
            </p>

            <p style={{ margin: '0 0 12px' }}>
              Je vous remercie de votre comprehension et reste disponible pour tout 
              renseignement complementaire.
            </p>

            <p style={{ margin: '0 0 24px' }}>Veuillez agreer, Madame, Monsieur, mes salutations distinguees.</p>

            <p style={{ margin: '0', fontWeight: '600' }}>{prenom} {nom}</p>
          </div>

          <button
            onClick={() => window.print()}
            style={{
              width: '100%',
              background: '#6c63ff',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontWeight: '600',
              fontSize: '15px',
              cursor: 'pointer',
              marginBottom: '10px',
            }}
          >
            Imprimer / Sauvegarder en PDF
          </button>

          <button
            onClick={() => router.push('/')}
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
            Retour au dashboard
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '430px', margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: '32px' }}>
      <div style={{ background: 'white', padding: '20px 24px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0' }}>←</button>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '600', margin: '0' }}>Resilier</h1>
          <p style={{ fontSize: '12px', color: '#888', margin: '0' }}>{name}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 16px' }}>Tes informations</p>

          <input
            style={inputStyle}
            placeholder="Prenom"
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder="Nom"
            value={nom}
            onChange={e => setNom(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder="Adresse"
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder="Code postal et ville"
            value={ville}
            onChange={e => setVille(e.target.value)}
          />
        </div>

        <button
          onClick={() => {
            if (!prenom || !nom || !adresse || !ville) {
              alert('Remplis tous les champs !')
              return
            }
            setGenerated(true)
          }}
          style={{
            width: '100%',
            background: '#6c63ff',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            fontWeight: '600',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          Generer la lettre
        </button>
      </div>
    </main>
  )
}

export default function ResiliationPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Chargement...</div>}>
      <ResiliationContent />
    </Suspense>
  )
}
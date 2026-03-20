'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const alternatives: Record<string, { name: string; price: number; description: string; url: string }[]> = {
  telecom: [
    { name: 'Bouygues Telecom', price: 9.99, description: 'Appels illimites + 100Go', url: 'https://www.bouyguestelecom.fr' },
    { name: 'NRJ Mobile', price: 7.99, description: 'Appels illimites + 50Go', url: 'https://www.nrjmobile.fr' },
    { name: 'Prixtel', price: 6.99, description: 'Appels illimites + 30Go', url: 'https://www.prixtel.com' },
  ],
  streaming: [
    { name: 'Disney+', price: 5.99, description: 'Films, series, Marvel, Star Wars', url: 'https://www.disneyplus.com' },
    { name: 'Apple TV+', price: 4.99, description: 'Series et films originaux', url: 'https://tv.apple.com' },
    { name: 'Paramount+', price: 5.99, description: 'Films et series Paramount', url: 'https://www.paramountplus.com' },
  ],
  energie: [
    { name: 'TotalEnergies', price: 74.00, description: 'Offre verte 100% renouvelable', url: 'https://www.totalenergies.fr' },
    { name: 'Engie', price: 71.00, description: 'Tarif fixe garanti 1 an', url: 'https://www.engie.fr' },
    { name: 'Vattenfall', price: 68.00, description: 'Electricite verte certifiee', url: 'https://www.vattenfall.fr' },
  ],
  assurance: [
    { name: 'Luko', price: 4.90, description: 'Assurance habitation digitale', url: 'https://www.getluko.com' },
    { name: 'Lovys', price: 5.90, description: 'Multirisque habitation flexible', url: 'https://www.lovys.com' },
    { name: 'Ornikar', price: 6.90, description: 'Assurance auto + habitation', url: 'https://www.ornikar.com' },
  ],
  saas: [
    { name: 'Notion', price: 0, description: 'Gratuit pour usage personnel', url: 'https://www.notion.so' },
    { name: 'Google Workspace', price: 5.75, description: 'Suite complete Google', url: 'https://workspace.google.com' },
    { name: 'Zoho', price: 3.00, description: 'Suite bureautique complete', url: 'https://www.zoho.com' },
  ],
  other: [
    { name: 'Alternatives gratuites', price: 0, description: 'Cherche des alternatives open source', url: 'https://alternativeto.net' },
  ],
}

function CompareContent() {
  const router = useRouter()
  const params = useSearchParams()
  const name = params.get('name') || 'Abonnement'
  const amount = parseFloat(params.get('amount') || '0')
  const category = params.get('category') || 'other'
  const offers = alternatives[category] || alternatives.other

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '430px', margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: '32px' }}>
      <div style={{ background: 'white', padding: '20px 24px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0' }}>←</button>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '600', margin: '0' }}>Comparer</h1>
          <p style={{ fontSize: '12px', color: '#888', margin: '0' }}>{name}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '16px', color: 'white', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 4px' }}>Ton offre actuelle</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: '700', fontSize: '18px', margin: '0' }}>{name}</p>
            <p style={{ fontWeight: '700', fontSize: '22px', margin: '0' }}>{amount.toFixed(2)} euros/mois</p>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#888', fontWeight: '600', margin: '0 0 10px' }}>MEILLEURES ALTERNATIVES</p>

        {offers.map((offer, i) => {
          const saving = amount - offer.price
          const btnStyle = {
            display: 'block',
            background: saving > 0 ? '#6c63ff' : '#f3f4f6',
            color: saving > 0 ? 'white' : '#374151',
            textAlign: 'center' as const,
            padding: '10px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '13px',
            textDecoration: 'none',
          }
          return (
            <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '8px', border: saving > 0 ? '1.5px solid #6c63ff' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 2px' }}>{offer.name}</p>
                  <p style={{ fontSize: '12px', color: '#888', margin: '0' }}>{offer.description}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: '700', fontSize: '16px', margin: '0 0 2px' }}>
                    {offer.price === 0 ? 'Gratuit' : offer.price.toFixed(2) + ' euros/mois'}
                  </p>
                  {saving > 0 && (
                    <p style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600', margin: '0' }}>
                      -{saving.toFixed(2)} euros/mois
                    </p>
                  )}
                </div>
              </div>
              <a href={offer.url} target="_blank" rel="noopener noreferrer" style={btnStyle}>
                Voir offre
              </a>
            </div>
          )
        })}
      </div>
    </main>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Chargement...</div>}>
      <CompareContent />
    </Suspense>
  )
}
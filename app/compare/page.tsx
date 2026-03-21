'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type Offer = {
  name: string
  price: number
  description: string
  url: string
  details: Record<string, any>
}

const allOffers: Record<string, Offer[]> = {
  telecom: [
    { name: 'Bouygues B&You', price: 9.99, description: 'Appels illimites + 30Go', url: 'https://www.bouyguestelecom.fr', details: { data_go: 30, calls: 'illimites', sms: 'illimites' } },
    { name: 'Bouygues B&You', price: 14.99, description: 'Appels illimites + 100Go', url: 'https://www.bouyguestelecom.fr', details: { data_go: 100, calls: 'illimites', sms: 'illimites' } },
    { name: 'NRJ Mobile', price: 7.99, description: 'Appels illimites + 50Go', url: 'https://www.nrjmobile.fr', details: { data_go: 50, calls: 'illimites', sms: 'illimites' } },
    { name: 'Prixtel', price: 6.99, description: 'Appels illimites + 30Go', url: 'https://www.prixtel.com', details: { data_go: 30, calls: 'illimites', sms: 'illimites' } },
    { name: 'Prixtel', price: 12.99, description: 'Appels illimites + 100Go', url: 'https://www.prixtel.com', details: { data_go: 100, calls: 'illimites', sms: 'illimites' } },
    { name: 'Auchan Telecom', price: 9.99, description: 'Appels illimites + 80Go', url: 'https://mobile.auchan.fr', details: { data_go: 80, calls: 'illimites', sms: 'illimites' } },
  ],
  streaming: [
    { name: 'Disney+', price: 5.99, description: '4 ecrans, 4K, telechargements', url: 'https://www.disneyplus.com', details: { screens: 4, quality: '4K', downloads: true } },
    { name: 'Apple TV+', price: 4.99, description: '6 ecrans, 4K, telechargements', url: 'https://tv.apple.com', details: { screens: 6, quality: '4K', downloads: true } },
    { name: 'Paramount+', price: 5.99, description: '3 ecrans, Full HD', url: 'https://www.paramountplus.com', details: { screens: 3, quality: 'HD', downloads: true } },
    { name: 'Salto', price: 6.99, description: '3 ecrans, HD, telechargements', url: 'https://www.salto.fr', details: { screens: 3, quality: 'HD', downloads: true } },
  ],
  energie: [
    { name: 'TotalEnergies', price: 74.00, description: 'Offre verte, tarif fixe', url: 'https://www.totalenergies.fr', details: { kwh_monthly: 350, type: 'electricite', contract: 'fixe' } },
    { name: 'Engie', price: 71.00, description: 'Tarif fixe garanti 1 an', url: 'https://www.engie.fr', details: { kwh_monthly: 350, type: 'electricite', contract: 'fixe' } },
    { name: 'Vattenfall', price: 68.00, description: 'Electricite verte certifiee', url: 'https://www.vattenfall.fr', details: { kwh_monthly: 350, type: 'electricite', contract: 'vert' } },
    { name: 'OHM Energie', price: 65.00, description: 'Petit fournisseur, prix bas', url: 'https://www.ohm-energie.com', details: { kwh_monthly: 350, type: 'electricite', contract: 'base' } },
  ],
  assurance: [
    { name: 'Luko', price: 4.90, description: 'Habitation 100% digitale', url: 'https://www.getluko.com', details: { type: 'habitation' } },
    { name: 'Lovys', price: 5.90, description: 'Multirisque flexible', url: 'https://www.lovys.com', details: { type: 'habitation' } },
    { name: 'Ornikar', price: 6.90, description: 'Auto + habitation', url: 'https://www.ornikar.com', details: { type: 'auto' } },
  ],
  saas: [
    { name: 'Notion', price: 0, description: 'Gratuit usage personnel', url: 'https://www.notion.so', details: {} },
    { name: 'Google Workspace', price: 5.75, description: 'Suite complete Google', url: 'https://workspace.google.com', details: {} },
    { name: 'Zoho', price: 3.00, description: 'Suite bureautique complete', url: 'https://www.zoho.com', details: {} },
  ],
  other: [
    { name: 'Alternatives gratuites', price: 0, description: 'Cherche des alternatives open source', url: 'https://alternativeto.net', details: {} },
  ],
}

function scoreOffer(offer: Offer, currentDetails: Record<string, any>, category: string): number {
  if (!currentDetails || Object.keys(currentDetails).length === 0) return 1

  let score = 0

  if (category === 'telecom') {
    const currentData = currentDetails.data_go || 0
    const offerData = offer.details.data_go || 0
    if (offerData >= currentData) score += 2
    else if (offerData >= currentData * 0.8) score += 1
    if (offer.details.calls === currentDetails.calls) score += 1
    if (offer.details.sms === currentDetails.sms) score += 1
  }

  if (category === 'streaming') {
    const currentScreens = currentDetails.screens || 1
    const offerScreens = offer.details.screens || 1
    if (offerScreens >= currentScreens) score += 2
    if (offer.details.quality === currentDetails.quality) score += 2
    if (offer.details.downloads === currentDetails.downloads) score += 1
  }

  if (category === 'energie') {
    if (offer.details.type === currentDetails.type) score += 3
  }

  return score
}

function CompareContent() {
  const router = useRouter()
  const params = useSearchParams()
  const name = params.get('name') || 'Abonnement'
  const amount = parseFloat(params.get('amount') || '0')
  const category = params.get('category') || 'other'
  const detailsRaw = params.get('details') || '{}'
  const currentDetails = JSON.parse(decodeURIComponent(detailsRaw))

  const offers = (allOffers[category] || allOffers.other)
    .map(offer => ({ ...offer, score: scoreOffer(offer, currentDetails, category) }))
    .filter(offer => offer.score > 0 || Object.keys(currentDetails).length === 0)
    .sort((a, b) => b.score - a.score || (amount - a.price) - (amount - b.price))
    .slice(0, 4)

  const detailLabel: Record<string, string> = {
    data_go: 'Go de data',
    screens: 'ecrans',
    kwh_monthly: 'kWh/mois',
    quality: 'Qualite',
    calls: 'Appels',
  }

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
        <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '16px', color: 'white', marginBottom: '8px' }}>
          <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 4px' }}>Ton offre actuelle</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontWeight: '700', fontSize: '18px', margin: '0' }}>{name}</p>
            <p style={{ fontWeight: '700', fontSize: '22px', margin: '0' }}>{amount.toFixed(2)} euros/mois</p>
          </div>
          {Object.keys(currentDetails).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(currentDetails).map(([key, val]) => (
                detailLabel[key] ? (
                  <span key={key} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '6px', padding: '3px 8px', fontSize: '11px' }}>
                    {String(val)} {detailLabel[key]}
                  </span>
                ) : null
              ))}
            </div>
          )}
        </div>

        <p style={{ fontSize: '13px', color: '#888', fontWeight: '600', margin: '12px 0 10px' }}>OFFRES EQUIVALENTES</p>

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
            <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '8px', border: i === 0 && saving > 0 ? '1.5px solid #6c63ff' : '1px solid #e5e7eb' }}>
              {i === 0 && saving > 0 && (
                <p style={{ fontSize: '11px', color: '#6c63ff', fontWeight: '600', margin: '0 0 8px' }}>MEILLEURE OFFRE</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
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
                  {saving < 0 && (
                    <p style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600', margin: '0' }}>
                      +{Math.abs(saving).toFixed(2)} euros/mois
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
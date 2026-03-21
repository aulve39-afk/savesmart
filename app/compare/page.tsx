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
  ],
  energie: [
    { name: 'TotalEnergies', price: 74.00, description: 'Offre verte, tarif fixe', url: 'https://www.totalenergies.fr', details: { kwh_monthly: 350, type: 'electricite' } },
    { name: 'Engie', price: 71.00, description: 'Tarif fixe garanti 1 an', url: 'https://www.engie.fr', details: { kwh_monthly: 350, type: 'electricite' } },
    { name: 'Vattenfall', price: 68.00, description: 'Electricite verte certifiee', url: 'https://www.vattenfall.fr', details: { kwh_monthly: 350, type: 'electricite' } },
    { name: 'OHM Energie', price: 65.00, description: 'Petit fournisseur, prix bas', url: 'https://www.ohm-energie.com', details: { kwh_monthly: 350, type: 'electricite' } },
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
  }
  if (category === 'streaming') {
    const currentScreens = currentDetails.screens || 1
    const offerScreens = offer.details.screens || 1
    if (offerScreens >= currentScreens) score += 2
    if (offer.details.quality === currentDetails.quality) score += 2
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

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ background: 'white', padding: '52px 24px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px' }}>Comparer</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0' }}>{name}</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '16px', padding: '20px', color: 'white', marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', opacity: 0.6, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Offre actuelle</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: '700', fontSize: '18px', margin: '0' }}>{name}</p>
            <p style={{ fontWeight: '800', fontSize: '22px', margin: '0' }}>{amount.toFixed(2)} euros/mois</p>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Offres equivalentes
        </p>

        {offers.map((offer, i) => {
          const saving = amount - offer.price
          const isBest = i === 0 && saving > 0
          return (
            <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '10px', border: isBest ? '2px solid #4f46e5' : '1px solid #f1f5f9' }}>
              {isBest && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px' }}>⭐</span>
                  <p style={{ fontSize: '11px', color: '#4f46e5', fontWeight: '700', margin: '0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meilleure offre</p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <p style={{ fontWeight: '700', fontSize: '15px', margin: '0 0 4px', color: '#1e293b' }}>{offer.name}</p>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0' }}>{offer.description}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <p style={{ fontWeight: '800', fontSize: '17px', margin: '0 0 2px', color: '#1e293b' }}>
                    {offer.price === 0 ? 'Gratuit' : offer.price.toFixed(2) + ' euros/mois'}
                  </p>
                  {saving > 0 && (
                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700', background: '#f0fdf4', padding: '2px 8px', borderRadius: '6px' }}>
                      -{saving.toFixed(2)} euros/mois
                    </span>
                  )}
                  {saving < 0 && (
                    <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700', background: '#fef2f2', padding: '2px 8px', borderRadius: '6px' }}>
                      +{Math.abs(saving).toFixed(2)} euros/mois
                    </span>
                  )}
                </div>
              </div>
              
<a
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  background: isBest ? '#4f46e5' : '#f8fafc',
                  color: isBest ? 'white' : '#64748b',
                  textAlign: 'center',
                  padding: '11px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '14px',
                  textDecoration: 'none',
                  border: isBest ? 'none' : '1px solid #e2e8f0',
                }}
              >
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
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>}>
      <CompareContent />
    </Suspense>
  )
}
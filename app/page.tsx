'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions, removeSubscription, type Subscription } from './store'

const categoryLabel: Record<string, string> = {
  streaming: 'Streaming',
  telecom: 'Télécom',
  energie: 'Énergie',
  assurance: 'Assurance',
  saas: 'SaaS',
  other: 'Autre',
}

const cycleLabel: Record<string, string> = {
  monthly: '/mois',
  yearly: '/an',
  quarterly: '/trimestre',
  one_time: '',
  unknown: '',
}

export default function Home() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const router = useRouter()

  useEffect(() => {
    setSubscriptions(getSubscriptions())
  }, [])

  const handleRemove = (id: string) => {
    removeSubscription(id)
    setSubscriptions(getSubscriptions())
  }

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)

  return (
    <main style={{
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '430px',
      margin: '0 auto',
      background: '#f5f5f5',
      minHeight: '100vh',
      paddingBottom: '32px',
    }}>
      <div style={{
        background: '#ffffff',
        padding: '20px 24px 16px',
        borderBottom: '1px solid #eeeeee',
      }}>
        <p style={{ color: '#888', fontSize: '13px', margin: '0 0 2px' }}>Bonjour 👋</p>
        <h1 style={{ fontSize: '22px', fontWeight: '600', margin: '0' }}>SaveSmart</h1>
      </div>

      <div style={{
        background: '#1a1a2e',
        margin: '16px',
        borderRadius: '16px',
        padding: '24px',
        color: 'white',
      }}>
        <p style={{ fontSize: '13px', opacity: 0.6, margin: '0 0 6px' }}>Total mensuel détecté</p>
        <p style={{ fontSize: '36px', fontWeight: '700', margin: '0 0 4px' }}>
          {total.toFixed(2)} €
          <span style={{ fontSize: '16px', fontWeight: '400' }}>/mois</span>
        </p>
        <p style={{ fontSize: '13px', opacity: 0.5, margin: '0' }}>
          {subscriptions.length} abonnement{subscriptions.length !== 1 ? 's' : ''} détecté{subscriptions.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <button
          onClick={() => router.push('/scan')}
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
          📷 Scanner une facture
        </button>
      </div>

      <div style={{ padding: '0 16px' }}>
        {subscriptions.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '32px', margin: '0 0 8px' }}>📄</p>
            <p style={{ fontWeight: '600', margin: '0 0 4px' }}>Aucun abonnement</p>
            <p style={{ fontSize: '13px', color: '#888', margin: '0' }}>Scanne une facture pour commencer</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: '#888', fontWeight: '600', margin: '0 0 10px' }}>
              ABONNEMENTS DÉTECTÉS
            </p>
            {subscriptions.map((sub) => (
              <div key={sub.id} style={{
                background: 'white',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 2px' }}>{sub.company_name}</p>
                  <p style={{ fontSize: '12px', color: '#888', margin: '0' }}>
                    {categoryLabel[sub.category] || sub.category}
                  </p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '15px', margin: '0' }}>
                      {sub.amount.toFixed(2)} €{cycleLabel[sub.billing_cycle] || ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(sub.id)}
                    style={{
                      background: '#fef2f2',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      color: '#dc2626',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    ✕
                  </button>
                  <button
  onClick={() => router.push(`/compare?name=${sub.company_name}&amount=${sub.amount}&category=${sub.category}`)}
  style={{
    background: '#f0f0ff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 10px',
    color: '#6c63ff',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
  }}
>
  Comparer
</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
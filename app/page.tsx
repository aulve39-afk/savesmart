export default function Home() {
  return (
    <main style={{
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '430px',
      margin: '0 auto',
      padding: '0',
      background: '#f5f5f5',
      minHeight: '100vh',
    }}>
      {/* Header */}
      <div style={{
        background: '#ffffff',
        padding: '20px 24px 16px',
        borderBottom: '1px solid #eeeeee',
      }}>
        <p style={{ color: '#888', fontSize: '13px', margin: '0 0 2px' }}>Bonjour 👋</p>
        <h1 style={{ fontSize: '22px', fontWeight: '600', margin: '0' }}>SaveSmart</h1>
      </div>

      {/* Carte économies */}
      <div style={{
        background: '#1a1a2e',
        margin: '16px',
        borderRadius: '16px',
        padding: '24px',
        color: 'white',
      }}>
        <p style={{ fontSize: '13px', opacity: 0.6, margin: '0 0 6px' }}>Économies potentielles</p>
        <p style={{ fontSize: '36px', fontWeight: '700', margin: '0 0 4px' }}>127 €<span style={{ fontSize: '16px', fontWeight: '400' }}>/mois</span></p>
        <p style={{ fontSize: '13px', opacity: 0.5, margin: '0' }}>8 abonnements détectés</p>
      </div>

      {/* Bouton scanner */}
      <div style={{ padding: '0 16px 16px' }}>
        <a href="/scan" style={{
          display: 'block',
          background: '#6c63ff',
          color: 'white',
          textAlign: 'center',
          padding: '16px',
          borderRadius: '12px',
          fontWeight: '600',
          fontSize: '16px',
          textDecoration: 'none',
        }}>
          📷 Scanner une facture
        </a>
      </div>

      {/* Liste abonnements */}
      <div style={{ padding: '0 16px' }}>
        <p style={{ fontSize: '13px', color: '#888', fontWeight: '600', margin: '0 0 10px' }}>ABONNEMENTS DÉTECTÉS</p>
        {[
          { name: 'Netflix', amount: '17,99 €', category: 'Streaming', saving: null },
          { name: 'Free Mobile', amount: '29,99 €', category: 'Télécom', saving: '−15 €' },
          { name: 'EDF', amount: '89,00 €', category: 'Énergie', saving: '−22 €' },
          { name: 'Spotify', amount: '10,99 €', category: 'Streaming', saving: null },
        ].map((sub) => (
          <div key={sub.name} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 2px' }}>{sub.name}</p>
              <p style={{ fontSize: '12px', color: '#888', margin: '0' }}>{sub.category}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 2px' }}>{sub.amount}</p>
              {sub.saving && (
                <p style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600', margin: '0' }}>{sub.saving}/mois</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
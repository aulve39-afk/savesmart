'use client'
import { useRouter } from 'next/navigation'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export default function GmailPage() {
  const router = useRouter()

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Connexion Gmail</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Lecture seule — aucun email modifié</p>
        </div>
      </div>

      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px' }}>📧</div>
        <p style={{ fontWeight: '800', fontSize: '20px', margin: '0 0 10px', color: 'var(--text-primary)' }}>Bientôt disponible</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: '1.6', maxWidth: '280px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>
          La connexion Gmail sera disponible dans une prochaine mise à jour.
        </p>
        <button
          onClick={() => router.push('/')}
          style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '14px 28px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', fontFamily: font }}
        >
          Retour
        </button>
      </div>
    </main>
  )
}
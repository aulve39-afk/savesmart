'use client'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function GmailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [emails, setEmails] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  const handleScan = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gmail')
      const data = await res.json()
      setEmails(data.emails || [])
      setTotal(data.total || 0)
      setDone(true)
    } catch {
      alert('Erreur lors du scan Gmail')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px' }}>

      <div style={{ background: 'white', padding: '52px 24px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px' }}>Connexion Gmail</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0' }}>Lecture seule — aucun email modifie</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {status === 'loading' && (
          <p style={{ textAlign: 'center', color: '#94a3b8' }}>Chargement...</p>
        )}

        {status === 'unauthenticated' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px 24px', border: '1px solid #f1f5f9', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>📧</div>
            <p style={{ fontWeight: '700', fontSize: '18px', margin: '0 0 8px', color: '#1e293b' }}>Connecte ton Gmail</p>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px', lineHeight: '1.6' }}>
              SaveSmart va scanner tes emails pour detecter automatiquement tes abonnements et factures.
            </p>
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', textAlign: 'left' }}>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 6px', fontWeight: '600' }}>CE QUE SAVESMART PEUT FAIRE</p>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 4px' }}>✓ Lire tes emails</p>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 4px' }}>✓ Detecter les factures</p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: '0 0 4px' }}>✗ Modifier tes emails</p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: '0' }}>✗ Envoyer des emails</p>
            </div>
            <button
              onClick={() => signIn('google')}
              style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
            >
              Connecter avec Google
            </button>
          </div>
        )}

        {status === 'authenticated' && !done && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>✅</div>
              <div>
                <p style={{ fontWeight: '700', fontSize: '15px', margin: '0', color: '#1e293b' }}>Gmail connecte</p>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0' }}>{session.user?.email}</p>
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={loading}
              style={{ width: '100%', background: loading ? '#a5b4fc' : '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '10px' }}
            >
              {loading ? 'Scan en cours...' : 'Scanner mes emails'}
            </button>

            <button
              onClick={() => signOut()}
              style={{ width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', color: '#dc2626' }}
            >
              Deconnecter Gmail
            </button>
          </div>
        )}

        {done && (
          <div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>✅</span>
              <p style={{ color: '#16a34a', fontWeight: '600', fontSize: '14px', margin: '0' }}>
                {total} email{total > 1 ? 's' : ''} trouve{total > 1 ? 's' : ''} — {emails.length} affiches
              </p>
            </div>

            <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Emails detectes
            </p>

            {emails.map((email, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '14px', padding: '16px', marginBottom: '8px', border: '1px solid #f1f5f9' }}>
                <p style={{ fontWeight: '600', fontSize: '14px', margin: '0 0 4px', color: '#1e293b' }}>{email.subject}</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0' }}>{email.from}</p>
              </div>
            ))}

            <button
              onClick={() => router.push('/')}
              style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginTop: '12px' }}
            >
              Retour au dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
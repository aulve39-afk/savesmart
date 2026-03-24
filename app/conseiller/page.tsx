'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions, type Subscription } from '../store'
import { useOnboarding as useUserId } from '../hooks/useOnboarding'

type Message = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Où puis-je économiser le plus ?',
  'Y a-t-il des doublons dans mes abonnements ?',
  'Quels abonnements puis-je partager en famille ?',
  'Quel est mon abonnement le plus coûteux ?',
  'Comment résilier sans frais ?',
]

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export default function ConseillerPage() {
  const router = useRouter()
  const { userId, isLoading } = useUserId()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (userId) getSubscriptions(userId).then(setSubscriptions)
  }, [userId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setInput('')
    setError(null)

    const userMsg: Message = { role: 'user', content: trimmed }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setStreaming(true)

    // Placeholder assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/conseiller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          subscriptions: subscriptions.map(s => ({
            company_name: s.company_name,
            amount: s.amount,
            billing_cycle: s.billing_cycle,
            category: s.category,
          })),
          history: messages.slice(-10),
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Erreur du serveur')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: full }
          return updated
        })
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      // Remove the empty assistant placeholder
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)

  if (isLoading || !userId) {
    return (
      <div style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton" style={{ width: '140px', height: '20px' }} />
            <div className="skeleton" style={{ width: '100px', height: '13px' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'var(--bg-card)', padding: '52px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button
          onClick={() => router.push('/')}
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: '0', letterSpacing: '-0.4px', color: 'var(--text-primary)' }}>Conseiller IA</h1>
            <span style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', letterSpacing: '0.5px' }}>Claude</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
            {subscriptions.length > 0
              ? `${subscriptions.length} abonnement${subscriptions.length > 1 ? 's' : ''} · ${total.toFixed(2)} €/mois`
              : 'Aucun abonnement — ajoutez-en pour de meilleurs conseils'}
          </p>
        </div>
        {streaming && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4f46e5', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '120px' }}>

        {/* Welcome state */}
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '26px' }}>🤖</div>
              <p style={{ fontWeight: '800', fontSize: '17px', margin: '0 0 6px', color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>Bonjour, je suis Claude !</p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.55' }}>
                {subscriptions.length > 0
                  ? `J'ai analysé tes ${subscriptions.length} abonnements. Pose-moi une question sur tes dépenses.`
                  : 'Pose-moi une question sur tes abonnements, ou ajoute d\'abord des abonnements pour des conseils personnalisés.'}
              </p>
            </div>

            {/* Subscription mini-summary */}
            {subscriptions.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '1px' }}>Tes abonnements</p>
                  <p style={{ fontSize: '22px', fontWeight: '800', color: 'white', margin: '0', letterSpacing: '-0.5px' }}>{total.toFixed(2)} €<span style={{ fontSize: '13px', fontWeight: '400', opacity: 0.7 }}>/mois</span></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', margin: '0 0 2px' }}>{subscriptions.length} abonnements</p>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.85)', margin: '0' }}>{(total * 12).toFixed(0)} €/an</p>
                </div>
              </div>
            )}

            {/* Suggestion chips */}
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Questions suggérées</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    disabled={streaming}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', textAlign: 'left', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '10px' }}
                  >
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>
                      {['💡', '🔍', '👨‍👩‍👧', '💰', '✂️'][i]}
                    </span>
                    {s}
                    <span style={{ marginLeft: 'auto', color: '#4f46e5', fontSize: '16px' }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              animation: 'cardEntrance 0.2s ease-out both',
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0, marginRight: '8px', marginTop: '2px' }}>🤖</div>
            )}
            <div
              style={{
                maxWidth: '82%',
                padding: '12px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                  : 'var(--bg-card)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                fontSize: '14px',
                lineHeight: '1.55',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content || (
                // Streaming cursor when empty
                <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                  {[0, 1, 2].map(j => (
                    <span key={j} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4f46e5', display: 'inline-block', animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Error banner */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: '#dc2626', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>⚠️</span>{error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '430px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
        {/* Quick chips when conversation started */}
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
            {SUGGESTIONS.slice(0, 3).map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                disabled={streaming}
                style={{ flexShrink: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '20px', padding: '4px 10px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question à Claude…"
            rows={1}
            disabled={streaming}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '14px',
              border: '1.5px solid var(--border-input)',
              fontSize: '15px',
              fontFamily: font,
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'none',
              lineHeight: '1.45',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          />
          <button
            onClick={() => {
              if (streaming) {
                abortRef.current?.abort()
                setStreaming(false)
              } else {
                send(input)
              }
            }}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: streaming ? '#f1f5f9' : input.trim() ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'var(--bg-secondary)',
              border: `1px solid ${streaming || input.trim() ? 'transparent' : 'var(--border)'}`,
              color: streaming ? '#64748b' : input.trim() ? 'white' : 'var(--text-muted)',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {streaming ? '⏹' : '↑'}
          </button>
        </div>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '6px 0 0', textAlign: 'center' }}>
          Propulsé par Claude Opus · Les données restent sur votre appareil
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4 }
          40% { transform: scale(1); opacity: 1 }
        }
        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  )
}

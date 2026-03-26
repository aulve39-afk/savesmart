'use client'

/**
 * SavingsDashboard: Tableau de bord "Total Savings" pour Unsubscribe.ai.
 *
 * Affiche en temps réel:
 *   - Total des économies annuelles réalisées (contrats résiliés)
 *   - Économies en cours (plans actifs, résiliation non encore effective)
 *   - Montants bloqués si les deadlines sont ratées (coût de l'inaction)
 *   - Plans urgents (countdown visual)
 *   - Prochaines deadlines à traiter
 *
 * Données: React Query → GET /api/v1/termination/dashboard/summary
 * Refresh: toutes les 5 minutes (ou sur focus fenêtre)
 */

import { useEffect, useState, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type UrgencyLevel = 'OK' | 'ATTENTION' | 'WARNING' | 'CRITICAL' | 'EXPIRED'

type UpcomingDeadline = {
  plan_id: string
  contract_name: string
  supplier: string
  urgency: UrgencyLevel
  days_remaining: number | null
  deadline: string | null
  savings_eur: number | null
}

type DashboardSummary = {
  total_annual_savings_eur: number
  pending_savings_eur: number
  total_plans: number
  terminated_count: number
  urgent_count: number
  upcoming_deadlines: UpcomingDeadline[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

const URGENCY_PALETTE: Record<UrgencyLevel, { bg: string; text: string; border: string; dot: string }> = {
  OK:        { bg: '#f0fdf4', text: '#15803d', border: '#86efac', dot: '#22c55e' },
  ATTENTION: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  WARNING:   { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  CRITICAL:  { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
  EXPIRED:   { bg: '#f9fafb', text: '#4b5563', border: '#d1d5db', dot: '#9ca3af' },
}

function formatCurrency(amount: number, compact = false): string {
  if (compact && amount >= 1000) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: 'compact' }).format(amount)
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/** Compteur animé de 0 → target sur 1.2s */
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sublabel,
  color,
  icon,
  highlight = false,
}: {
  label: string
  value: string
  sublabel?: string
  color: string
  icon: string
  highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${color}15, ${color}08)` : 'var(--bg-card, white)',
      border: `1px solid ${highlight ? color + '40' : 'var(--border, #e5e7eb)'}`,
      borderRadius: 16,
      padding: '16px 18px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontWeight: 800, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
      {sublabel && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{sublabel}</div>
      )}
    </div>
  )
}

function DeadlineRow({ item }: { item: UpcomingDeadline }) {
  const pal = URGENCY_PALETTE[item.urgency]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      borderRadius: 12,
      border: `1px solid ${pal.border}`,
      background: pal.bg,
    }}>
      {/* Dot urgence */}
      <div style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: pal.dot,
        flexShrink: 0,
        boxShadow: item.urgency === 'CRITICAL' ? `0 0 0 3px ${pal.dot}40` : 'none',
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.contract_name || item.supplier}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          {item.supplier}
          {item.deadline && ` · avant le ${formatDate(item.deadline)}`}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {item.days_remaining !== null && (
          <div style={{ fontWeight: 800, fontSize: 15, color: pal.text }}>
            J–{item.days_remaining}
          </div>
        )}
        {item.savings_eur && (
          <div style={{ fontSize: 10, color: '#15803d', fontWeight: 600 }}>
            {formatCurrency(item.savings_eur, true)}/an
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: '#6b7280' }}>
        Aucun contrat analysé
      </div>
      <div style={{ fontSize: 12 }}>
        Téléversez vos contrats pour identifier les résiliations possibles
      </div>
    </div>
  )
}

function Skeleton({ width = '100%', height = 20, radius = 8 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div style={{ width, height, borderRadius: radius, background: 'var(--skeleton, #f3f4f6)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function SavingsDashboard({
  apiBaseUrl = '/api/v1',
  onSelectPlan,
}: {
  apiBaseUrl?: string
  onSelectPlan?: (planId: string) => void
}) {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetch_ = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${apiBaseUrl}/termination/dashboard/summary`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as DashboardSummary
      setData(json)
      setLastRefresh(new Date())
    } catch (err) {
      setError('Impossible de charger les données. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  // Chargement initial
  useEffect(() => { fetch_() }, [fetch_])

  // Refresh automatique toutes les 5 minutes
  useEffect(() => {
    const interval = setInterval(fetch_, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetch_])

  // Refresh sur focus fenêtre (retour d'un autre onglet)
  useEffect(() => {
    const onFocus = () => fetch_()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetch_])

  // Compteurs animés (déclenchés quand data arrive)
  const animatedSavings = useCountUp(data?.total_annual_savings_eur ?? 0)
  const animatedPending = useCountUp(data?.pending_savings_eur ?? 0)

  if (error) {
    return (
      <div style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 12,
        padding: '16px',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        fontSize: 13,
        color: '#dc2626',
      }}>
        <span>⚠️</span>
        <span>{error}</span>
        <button
          onClick={fetch_}
          style={{ marginLeft: 'auto', fontSize: 12, color: '#dc2626', background: 'transparent', border: '1px solid #fecaca', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: 18, margin: 0, color: 'var(--text-primary, #111)' }}>
            💰 Total Savings
          </h2>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
            Mis à jour {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={fetch_}
          disabled={loading}
          style={{
            fontSize: 12,
            color: '#4f46e5',
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            borderRadius: 10,
            padding: '6px 12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '⟳ Chargement...' : '⟳ Rafraîchir'}
        </button>
      </div>

      {/* ── Métriques principales ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {loading ? (
          <>
            <div style={{ flex: 1, minWidth: 140 }}><Skeleton height={80} /></div>
            <div style={{ flex: 1, minWidth: 140 }}><Skeleton height={80} /></div>
            <div style={{ flex: 1, minWidth: 140 }}><Skeleton height={80} /></div>
          </>
        ) : data ? (
          <>
            <MetricCard
              label="Économisé"
              value={formatCurrency(animatedSavings)}
              sublabel={`${data.terminated_count} contrat${data.terminated_count > 1 ? 's' : ''} résilié${data.terminated_count > 1 ? 's' : ''}`}
              color="#15803d"
              icon="✅"
              highlight
            />
            <MetricCard
              label="En cours"
              value={formatCurrency(animatedPending)}
              sublabel={`${data.total_plans - data.terminated_count} plan${data.total_plans - data.terminated_count > 1 ? 's' : ''} actif${data.total_plans - data.terminated_count > 1 ? 's' : ''}`}
              color="#4f46e5"
              icon="⏳"
            />
            {data.urgent_count > 0 ? (
              <MetricCard
                label="Urgents"
                value={`${data.urgent_count}`}
                sublabel="Agir maintenant"
                color="#dc2626"
                icon="🚨"
                highlight
              />
            ) : (
              <MetricCard
                label="Alertes"
                value="0"
                sublabel="Tout est à jour"
                color="#6b7280"
                icon="🟢"
              />
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* ── Prochaines deadlines ─────────────────────────────────────────────── */}
      {data && data.upcoming_deadlines.length > 0 && (
        <div style={{
          background: 'var(--bg-card, white)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 16,
          padding: '16px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Prochaines deadlines
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.upcoming_deadlines.map(item => (
              <div
                key={item.plan_id}
                onClick={() => onSelectPlan?.(item.plan_id)}
                style={{ cursor: onSelectPlan ? 'pointer' : 'default' }}
              >
                <DeadlineRow item={item} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Barre d'économies (ROI visuel) ──────────────────────────────────── */}
      {data && (data.total_annual_savings_eur + data.pending_savings_eur) > 0 && (
        <div style={{
          background: 'var(--bg-card, white)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 16,
          padding: '16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Progression des économies
          </div>

          {/* Barre empilée: réalisé (vert) + en cours (bleu) */}
          {(() => {
            const total = data.total_annual_savings_eur + data.pending_savings_eur
            const donePercent = total > 0 ? (data.total_annual_savings_eur / total) * 100 : 0
            const pendingPercent = total > 0 ? (data.pending_savings_eur / total) * 100 : 0

            return (
              <>
                <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#f3f4f6', marginBottom: 8 }}>
                  <div style={{
                    width: `${donePercent}%`,
                    background: '#22c55e',
                    transition: 'width 0.8s ease',
                  }} />
                  <div style={{
                    width: `${pendingPercent}%`,
                    background: '#818cf8',
                    transition: 'width 0.8s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} />
                    <span style={{ color: '#6b7280' }}>Réalisé: <strong style={{ color: '#15803d' }}>{formatCurrency(data.total_annual_savings_eur)}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#818cf8' }} />
                    <span style={{ color: '#6b7280' }}>En cours: <strong style={{ color: '#4f46e5' }}>{formatCurrency(data.pending_savings_eur)}</strong></span>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Empty state si aucun plan */}
      {!loading && data && data.total_plans === 0 && <EmptyState />}

      {/* CSS global */}
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default SavingsDashboard

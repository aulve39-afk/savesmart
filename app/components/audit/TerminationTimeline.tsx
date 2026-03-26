'use client'

/**
 * TerminationTimeline: Visualisation interactive de la fenêtre de résiliation.
 *
 * Affiche:
 *   [Signature] ─────── [Aujourd'hui] ──── [⚠ Deadline] ──── [Renouvellement]
 *
 * La barre de progression colore visuellement l'urgence:
 *   Vert  (>90j)  → Sécurisé, temps suffisant
 *   Orange(8-90j) → Attention, agir bientôt
 *   Rouge (≤7j)   → Critique, agir maintenant
 *   Gris  (EXPIRED) → Fenêtre manquée, prochain cycle calculé
 *
 * Animation CSS pure — pas de Framer Motion (dépendance non installée).
 */

import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'OK' | 'ATTENTION' | 'WARNING' | 'CRITICAL' | 'EXPIRED'

export type TerminationStep = {
  step_number: number
  title: string
  description: string
  due_date: string | null
  action_type: string
  is_critical: boolean
  estimated_duration_minutes: number | null
}

export type TerminationPlanData = {
  plan_id: string
  contract_name: string
  supplier_name: string
  urgency_level: UrgencyLevel
  days_until_deadline: number | null
  notice_deadline: string | null  // ISO date string
  anniversary_date: string        // ISO date string
  signature_date?: string         // ISO date string (optional)
  applied_notice_months: number
  estimated_annual_savings_eur: number | null
  locked_amount_if_missed_eur: number | null
  early_termination_fee_eur: number | null
  legal_basis: string
  legal_article: string
  is_within_legal_window: boolean
  workflow_status: string
  steps: TerminationStep[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<UrgencyLevel, {
  color: string
  bg: string
  border: string
  label: string
  icon: string
}> = {
  OK:        { color: '#15803d', bg: '#f0fdf4', border: '#86efac', label: 'Sécurisé', icon: '✅' },
  ATTENTION: { color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Attention', icon: '⚠️' },
  WARNING:   { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', label: 'Urgent', icon: '🚨' },
  CRITICAL:  { color: '#7f1d1d', bg: '#fef2f2', border: '#ef4444', label: 'Critique', icon: '🔴' },
  EXPIRED:   { color: '#4b5563', bg: '#f9fafb', border: '#d1d5db', label: 'Prochain cycle', icon: '🔄' },
}

const ACTION_ICONS: Record<string, string> = {
  PREPARE_DOC: '📄',
  SIGN_DOCUMENT: '✍️',
  SEND_LRE: '📮',
  SEND_EMAIL: '✉️',
  VERIFY_RECEIPT: '✅',
  NEGOTIATE: '🤝',
  WAIT: '⏳',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
}

/**
 * Calcule la position (%) d'une date sur la timeline entre start et end.
 * Clamp entre 0% et 100%.
 */
function dateToPercent(date: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime()
  if (total <= 0) return 0
  const pos = date.getTime() - start.getTime()
  return Math.max(0, Math.min(100, (pos / total) * 100))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function TimelineMarker({
  percent,
  label,
  sublabel,
  color,
  size = 'md',
  pulsing = false,
}: {
  percent: number
  label: string
  sublabel?: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  pulsing?: boolean
}) {
  const dotSize = size === 'lg' ? 20 : size === 'md' ? 14 : 10
  const fontSize = size === 'lg' ? 11 : 10

  return (
    <div
      style={{
        position: 'absolute',
        left: `${percent}%`,
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      {/* Dot */}
      <div
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: color,
          border: '2px solid white',
          boxShadow: `0 0 0 2px ${color}`,
          position: 'relative',
        }}
      >
        {pulsing && (
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              opacity: 0.5,
              animation: 'pulse-ring 1.5s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Label */}
      <div style={{ marginTop: 6, textAlign: 'center', maxWidth: 80 }}>
        <div style={{ fontSize, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, lineHeight: 1.2 }}>{sublabel}</div>
        )}
      </div>
    </div>
  )
}

function StepCard({
  step,
  isCompleted,
  isActive,
}: {
  step: TerminationStep
  isCompleted: boolean
  isActive: boolean
}) {
  const icon = ACTION_ICONS[step.action_type] || '📌'

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        border: `1px solid ${isActive ? '#4f46e5' : isCompleted ? '#86efac' : 'var(--border, #e5e7eb)'}`,
        background: isActive ? '#eef2ff' : isCompleted ? '#f0fdf4' : 'var(--bg-card, #fff)',
        opacity: isCompleted ? 0.7 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Step number / status */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: isCompleted ? '#22c55e' : isActive ? '#4f46e5' : '#f3f4f6',
        color: isCompleted || isActive ? 'white' : '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {isCompleted ? '✓' : step.step_number}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{
            fontWeight: 700,
            fontSize: 13,
            color: isActive ? '#4338ca' : 'var(--text-primary, #111)',
          }}>
            {step.title}
          </span>
          {step.is_critical && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 4,
              padding: '1px 5px',
              marginLeft: 2,
            }}>
              CRITIQUE
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', margin: 0, lineHeight: 1.5 }}>
          {step.description}
        </p>
        {step.due_date && (
          <div style={{ marginTop: 4, fontSize: 10, color: '#9ca3af' }}>
            📅 Avant le {formatDate(step.due_date)}
            {step.estimated_duration_minutes && ` · ~${step.estimated_duration_minutes} min`}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function TerminationTimeline({ plan }: { plan: TerminationPlanData }) {
  const [mounted, setMounted] = useState(false)
  const [activeStep, setActiveStep] = useState(0) // Index de l'étape active (0-based)

  useEffect(() => { setMounted(true) }, [])

  const urgency = plan.urgency_level
  const cfg = URGENCY_CONFIG[urgency]
  const today = new Date()

  // Dates de la timeline
  const signatureDate = plan.signature_date
    ? new Date(plan.signature_date)
    : new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
  const anniversaryDate = new Date(plan.anniversary_date)
  const deadlineDate = plan.notice_deadline ? new Date(plan.notice_deadline) : null

  // Bornes de la timeline: de la signature à l'anniversaire + 30 jours
  const timelineStart = signatureDate
  const timelineEnd = new Date(anniversaryDate.getTime() + 30 * 24 * 3600 * 1000)

  // Positions en %
  const todayPct = dateToPercent(today, timelineStart, timelineEnd)
  const deadlinePct = deadlineDate
    ? dateToPercent(deadlineDate, timelineStart, timelineEnd)
    : null
  const anniversaryPct = dateToPercent(anniversaryDate, timelineStart, timelineEnd)

  // Couleur de la zone "safe" (entre aujourd'hui et la deadline)
  const progressBarColor =
    urgency === 'OK' ? '#22c55e' :
    urgency === 'ATTENTION' ? '#f59e0b' :
    urgency === 'EXPIRED' ? '#9ca3af' :
    '#ef4444'

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── En-tête urgence ─────────────────────────────────────────────────── */}
      <div style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 16,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{cfg.icon}</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: cfg.color }}>
              {cfg.label}
            </span>
            {plan.days_until_deadline !== null && plan.days_until_deadline >= 0 && (
              <span style={{
                fontWeight: 700,
                fontSize: 22,
                color: cfg.color,
                marginLeft: 4,
              }}>
                J–{plan.days_until_deadline}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: cfg.color, opacity: 0.8 }}>
            {plan.applied_notice_months} mois de préavis · {plan.legal_basis.replace('_', ' ')}
          </div>
        </div>

        {plan.estimated_annual_savings_eur && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Économies potentielles</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#15803d' }}>
              {formatCurrency(plan.estimated_annual_savings_eur)}/an
            </div>
            {plan.locked_amount_if_missed_eur && (
              <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>
                ⚠ {formatCurrency(plan.locked_amount_if_missed_eur)} bloqués si raté
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Timeline visuelle ────────────────────────────────────────────────── */}
      {mounted && (
        <div style={{
          background: 'var(--bg-card, white)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 16,
          padding: '20px 20px 60px',
          marginBottom: 20,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fenêtre de résiliation
          </div>

          {/* Barre de base */}
          <div style={{
            position: 'relative',
            height: 8,
            background: '#f3f4f6',
            borderRadius: 4,
            margin: '0 8px',
          }}>
            {/* Zone "temps restant" (de aujourd'hui à la deadline) */}
            {deadlinePct !== null && (
              <div style={{
                position: 'absolute',
                left: `${todayPct}%`,
                width: `${Math.max(0, deadlinePct - todayPct)}%`,
                height: '100%',
                background: progressBarColor,
                borderRadius: 4,
                opacity: 0.3,
                transition: 'width 0.8s ease',
              }} />
            )}

            {/* Zone "validée" (de la signature à aujourd'hui) */}
            <div style={{
              position: 'absolute',
              left: 0,
              width: `${todayPct}%`,
              height: '100%',
              background: '#d1d5db',
              borderRadius: 4,
            }} />

            {/* Marqueur signature */}
            <TimelineMarker
              percent={0}
              label="Signature"
              sublabel={signatureDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
              color="#6b7280"
              size="sm"
            />

            {/* Marqueur aujourd'hui */}
            <TimelineMarker
              percent={todayPct}
              label="Aujourd'hui"
              sublabel={today.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              color="#4f46e5"
              size="lg"
              pulsing
            />

            {/* Marqueur deadline */}
            {deadlineDate && deadlinePct !== null && (
              <TimelineMarker
                percent={deadlinePct}
                label="⚠ Deadline"
                sublabel={deadlineDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                color={progressBarColor}
                size="md"
              />
            )}

            {/* Marqueur anniversaire */}
            <TimelineMarker
              percent={Math.min(anniversaryPct, 98)}
              label="Renouvellement"
              sublabel={anniversaryDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
              color="#1e3a5f"
              size="sm"
            />
          </div>
        </div>
      )}

      {/* ── Base légale ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderLeft: '4px solid #4f46e5',
        borderRadius: '0 12px 12px 0',
        padding: '12px 16px',
        marginBottom: 20,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚖️</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', marginBottom: 3 }}>
            Fondement juridique
          </div>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
            {plan.legal_article}
          </div>
          {plan.early_termination_fee_eur && (
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>
              ⚠ Pénalité de résiliation anticipée estimée: {formatCurrency(plan.early_termination_fee_eur)}
            </div>
          )}
          {!plan.early_termination_fee_eur && plan.is_within_legal_window && (
            <div style={{ fontSize: 11, color: '#15803d', marginTop: 6 }}>
              ✓ Résiliation dans la fenêtre légale — aucune pénalité prévue
            </div>
          )}
        </div>
      </div>

      {/* ── Étapes actionnables ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Plan d'action ({plan.steps.length} étapes)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plan.steps.map((step, i) => (
            <div
              key={step.step_number}
              onClick={() => setActiveStep(i)}
              style={{ cursor: 'pointer' }}
            >
              <StepCard
                step={step}
                isCompleted={i < activeStep}
                isActive={i === activeStep}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── CSS Animations ───────────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 0.8; }
          70%  { transform: scale(1.4); opacity: 0;   }
          100% { transform: scale(1.4); opacity: 0;   }
        }
      `}</style>
    </div>
  )
}

export default TerminationTimeline

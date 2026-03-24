'use client'

/**
 * ContractHealthCard — Composant principal d'affichage d'une analyse de contrat.
 *
 * Affiche: score de risque global, résumé financier, clauses critiques,
 * badges de priorité colorés, et alertes de préavis imminentes.
 *
 * Design: compatible dark mode, responsive mobile-first.
 */

import { useState } from 'react'

// ── Types (miroir du Pydantic backend) ────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ActionRequired = 'OK' | 'ATTENTION' | 'WARNING' | 'CRITICAL' | 'EXPIRED'
export type ClauseType =
  | 'PRICE_ESCALATION'
  | 'AUTO_RENEWAL'
  | 'TERMINATION_PENALTY'
  | 'NOTICE_PERIOD'
  | 'PAYMENT_TERMS'
  | 'DATA_PROCESSING'
  | 'LIABILITY_CAP'
  | 'FORCE_MAJEURE'
  | 'EXCLUSIVITY'
  | 'OTHER'

export interface NoticeDeadline {
  period_months: number
  deadline_date: string | null
  anniversary_date: string
  days_until_deadline: number | null
  action_required: ActionRequired
  calendar_alert_suggested: boolean
}

export interface ClauseSource {
  page: number
  paragraph: string | null
  verbatim_quote: string
  confidence: number
  source_confidence: 'high' | 'medium' | 'low'
}

export interface FinancialImpact {
  annualized_amount_eur: number | null
  escalation_rate_min_pct: number | null
  escalation_rate_max_pct: number | null
  worst_case_year_3_eur: number | null
  termination_penalty_eur: number | null
  lock_in_months: number | null
}

export interface ContractClause {
  clause_id: string
  type: ClauseType
  title: string
  extracted_text: string
  source: ClauseSource
  risk_score: number
  risk_level: RiskLevel
  financial_impact: FinancialImpact | null
  notice: NoticeDeadline | null
  requires_human_review: boolean
  ai_recommendation: string | null
}

export interface AnalysisResult {
  contract_id: string
  analyzed_at: string
  document: {
    filename: string
    page_count: number
    contract_type: string
    parties: Record<string, string>
  }
  financial_summary: {
    annual_amount_eur: number | null
    monthly_amount_eur: number | null
    price_escalation_risk_pct: number | null
    total_penalty_exposure_eur: number | null
  }
  global_risk_score: number
  risk_level: RiskLevel
  clauses: ContractClause[]
  processing_metadata: {
    model_used: string
    estimated_cost_usd: number
    processing_time_seconds: number
    pii_entities_redacted: number
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; ring: string }> = {
  LOW:      { label: 'Faible',    color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', ring: 'ring-emerald-400' },
  MEDIUM:   { label: 'Modéré',   color: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/30',     border: 'border-amber-200 dark:border-amber-800',     ring: 'ring-amber-400'   },
  HIGH:     { label: 'Élevé',    color: 'text-orange-700 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-950/30',   border: 'border-orange-200 dark:border-orange-800',   ring: 'ring-orange-400'  },
  CRITICAL: { label: 'Critique', color: 'text-red-700 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-950/30',         border: 'border-red-200 dark:border-red-800',         ring: 'ring-red-400'     },
}

const ACTION_CONFIG: Record<ActionRequired, { label: string; dot: string }> = {
  OK:        { label: 'Aucune action',       dot: 'bg-emerald-500' },
  ATTENTION: { label: 'À surveiller',        dot: 'bg-amber-500'   },
  WARNING:   { label: 'Action requise',      dot: 'bg-orange-500'  },
  CRITICAL:  { label: 'Action immédiate',    dot: 'bg-red-500 animate-pulse' },
  EXPIRED:   { label: 'Délai dépassé',       dot: 'bg-gray-400'    },
}

const CLAUSE_TYPE_LABELS: Record<ClauseType, string> = {
  PRICE_ESCALATION:    'Hausse de prix',
  AUTO_RENEWAL:        'Renouvellement tacite',
  TERMINATION_PENALTY: 'Pénalité résiliation',
  NOTICE_PERIOD:       'Délai de préavis',
  PAYMENT_TERMS:       'Conditions paiement',
  DATA_PROCESSING:     'Données personnelles',
  LIABILITY_CAP:       'Responsabilité',
  FORCE_MAJEURE:       'Force majeure',
  EXCLUSIVITY:         'Exclusivité',
  OTHER:               'Autre',
}

function formatEur(amount: number | null): string {
  if (amount === null) return '–'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '–'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(isoDate))
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function RiskScoreGauge({ score, level }: { score: number; level: RiskLevel }) {
  const cfg = RISK_CONFIG[level]
  // Angle de l'aiguille: 0% = -90°, 100% = +90° (demi-cercle)
  const angle = -90 + (score / 100) * 180

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Demi-cercle SVG */}
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          {/* Arc de fond */}
          <path d="M 10 55 A 50 50 0 0 1 110 55" fill="none" stroke="currentColor"
            className="text-[var(--border)]" strokeWidth="8" strokeLinecap="round" />
          {/* Arc coloré (progression) */}
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke="currentColor"
            className={cfg.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 157} 157`}
          />
          {/* Aiguille */}
          <line
            x1="60" y1="55"
            x2={60 + 40 * Math.cos((angle * Math.PI) / 180)}
            y2={55 + 40 * Math.sin((angle * Math.PI) / 180)}
            stroke="currentColor"
            className="text-[var(--text-primary)]"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Centre */}
          <circle cx="60" cy="55" r="4" fill="currentColor" className="text-[var(--text-primary)]" />
        </svg>
      </div>
      <span className={`text-2xl font-bold tabular-nums ${cfg.color}`}>{score.toFixed(0)}</span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
        Risque {cfg.label}
      </span>
    </div>
  )
}

function ClauseRiskBadge({ level }: { level: RiskLevel }) {
  const cfg = RISK_CONFIG[level]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.bg.replace('bg-', 'bg-').replace('/30', '')} ${level === 'CRITICAL' ? 'animate-pulse bg-red-500' : ''}`} />
      {cfg.label}
    </span>
  )
}

function NoticeAlert({ notice }: { notice: NoticeDeadline }) {
  const cfg = ACTION_CONFIG[notice.action_required]
  const isUrgent = notice.action_required === 'CRITICAL' || notice.action_required === 'WARNING'

  if (notice.action_required === 'OK') return null

  return (
    <div className={`flex items-start gap-2 rounded-lg p-2.5 text-xs mt-2 border ${
      isUrgent ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
    }`}>
      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <div>
        <span className="font-semibold">{cfg.label}</span>
        {notice.deadline_date && (
          <span className="text-[var(--text-secondary)]">
            {' '}— Deadline: {formatDate(notice.deadline_date)}
            {notice.days_until_deadline !== null && (
              <> ({notice.days_until_deadline > 0 ? `dans ${notice.days_until_deadline} j` : 'DÉPASSÉ'})</>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

function ClauseCard({ clause }: { clause: ContractClause }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-xl border p-4 transition-all ${RISK_CONFIG[clause.risk_level].bg} ${RISK_CONFIG[clause.risk_level].border}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <ClauseRiskBadge level={clause.risk_level} />
            <span className="text-xs text-[var(--text-muted)] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)]">
              {CLAUSE_TYPE_LABELS[clause.type]}
            </span>
            {clause.requires_human_review && (
              <span className="text-xs font-medium text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                Revue requise
              </span>
            )}
          </div>
          <h3 className="font-semibold text-[var(--text-primary)] text-sm leading-tight">{clause.title}</h3>
        </div>
        {/* Score cercle */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2 ${RISK_CONFIG[clause.risk_level].ring} ${RISK_CONFIG[clause.risk_level].color} bg-[var(--bg-card)]`}>
          {clause.risk_score}
        </div>
      </div>

      {/* Résumé */}
      <p className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2">{clause.extracted_text}</p>

      {/* Impact financier */}
      {clause.financial_impact && (
        <div className="flex flex-wrap gap-3 mt-2">
          {clause.financial_impact.annualized_amount_eur && (
            <div className="text-xs">
              <span className="text-[var(--text-muted)]">Annuel </span>
              <span className="font-semibold text-[var(--text-primary)]">{formatEur(clause.financial_impact.annualized_amount_eur)}</span>
            </div>
          )}
          {clause.financial_impact.escalation_rate_min_pct && (
            <div className="text-xs">
              <span className="text-[var(--text-muted)]">Hausse min </span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">{clause.financial_impact.escalation_rate_min_pct}%/an</span>
            </div>
          )}
          {clause.financial_impact.worst_case_year_3_eur && (
            <div className="text-xs">
              <span className="text-[var(--text-muted)]">Coût à 3 ans </span>
              <span className="font-semibold text-red-600 dark:text-red-400">{formatEur(clause.financial_impact.worst_case_year_3_eur)}</span>
            </div>
          )}
          {clause.financial_impact.termination_penalty_eur && (
            <div className="text-xs">
              <span className="text-[var(--text-muted)]">Pénalité </span>
              <span className="font-semibold text-red-600 dark:text-red-400">{formatEur(clause.financial_impact.termination_penalty_eur)}</span>
            </div>
          )}
        </div>
      )}

      {/* Alerte préavis */}
      {clause.notice && <NoticeAlert notice={clause.notice} />}

      {/* Bouton détails */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {expanded ? 'Réduire' : 'Voir la source et recommandation'}
      </button>

      {/* Zone expandée: citation source + recommandation IA */}
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          {/* Citation source */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Source</span>
              <span className="text-xs text-[var(--text-muted)]">
                Page {clause.source.page}{clause.source.paragraph ? ` · ${clause.source.paragraph}` : ''}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                clause.source.source_confidence === 'high' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                clause.source.source_confidence === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {Math.round(clause.source.confidence * 100)}% confiance
              </span>
            </div>
            <blockquote className="text-xs italic text-[var(--text-secondary)] border-l-2 border-[var(--border-input)] pl-2">
              "{clause.source.verbatim_quote}"
            </blockquote>
          </div>

          {/* Recommandation IA */}
          {clause.ai_recommendation && (
            <div className="flex gap-2 rounded-lg bg-[var(--bg-secondary)] p-2.5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <p className="text-xs text-[var(--text-secondary)]">{clause.ai_recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

interface ContractHealthCardProps {
  result: AnalysisResult
  className?: string
}

export default function ContractHealthCard({ result, className = '' }: ContractHealthCardProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'notices'>('critical')

  const criticalClauses = result.clauses.filter(c => c.risk_level === 'CRITICAL')
  const upcomingNotices = result.clauses.filter(
    c => c.notice && c.notice.days_until_deadline !== null && c.notice.days_until_deadline <= 90
  )

  const displayedClauses =
    activeTab === 'critical' ? criticalClauses :
    activeTab === 'notices'  ? upcomingNotices :
    result.clauses

  // Trier par risk_score décroissant
  const sortedClauses = [...displayedClauses].sort((a, b) => b.risk_score - a.risk_score)

  return (
    <article className={`rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden shadow-sm ${className}`}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="p-5 border-b border-[var(--border)]">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Infos document */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                {result.document.filename}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
              <span>{result.document.page_count} pages</span>
              <span>·</span>
              <span>{result.document.contract_type}</span>
              {result.document.parties.supplier && (
                <>
                  <span>·</span>
                  <span>{result.document.parties.supplier}</span>
                </>
              )}
              <span>·</span>
              <span>Analysé le {formatDate(result.analyzed_at)}</span>
            </div>
          </div>

          {/* Score de risque */}
          <RiskScoreGauge score={result.global_risk_score} level={result.risk_level} />
        </div>
      </div>

      {/* ── Résumé financier ────────────────────────────────────────────────── */}
      {(result.financial_summary.annual_amount_eur || result.financial_summary.total_penalty_exposure_eur) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--border)] border-b border-[var(--border)]">
          {[
            {
              label: 'Coût annuel',
              value: formatEur(result.financial_summary.annual_amount_eur),
              sub: result.financial_summary.monthly_amount_eur ? `${formatEur(result.financial_summary.monthly_amount_eur)}/mois` : undefined,
            },
            {
              label: 'Hausse de prix max',
              value: result.financial_summary.price_escalation_risk_pct
                ? `${result.financial_summary.price_escalation_risk_pct}%/an`
                : '–',
              highlight: (result.financial_summary.price_escalation_risk_pct ?? 0) > 3,
            },
            {
              label: 'Exposition pénalités',
              value: formatEur(result.financial_summary.total_penalty_exposure_eur),
              highlight: (result.financial_summary.total_penalty_exposure_eur ?? 0) > 5000,
            },
            {
              label: 'Clauses à risque',
              value: `${result.clauses.filter(c => c.risk_level !== 'LOW').length}/${result.clauses.length}`,
              highlight: result.clauses.some(c => c.risk_level === 'CRITICAL'),
            },
          ].map(({ label, value, sub, highlight }) => (
            <div key={label} className="p-3 text-center">
              <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
              <p className={`text-base font-bold tabular-nums ${highlight ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-primary)]'}`}>
                {value}
              </p>
              {sub && <p className="text-xs text-[var(--text-muted)]">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Alertes critiques ────────────────────────────────────────────────── */}
      {upcomingNotices.length > 0 && (
        <div className="p-4 border-b border-[var(--border)] bg-red-50/50 dark:bg-red-950/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
              {upcomingNotices.length} préavis dans les 90 prochains jours
            </span>
          </div>
          <div className="space-y-1">
            {upcomingNotices.slice(0, 3).map(c => (
              <div key={c.clause_id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] truncate">{c.title}</span>
                {c.notice?.deadline_date && (
                  <span className={`font-medium ml-2 flex-shrink-0 ${
                    (c.notice.days_until_deadline ?? 999) <= 30 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {formatDate(c.notice.deadline_date)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Onglets de filtrage ──────────────────────────────────────────────── */}
      <div className="flex border-b border-[var(--border)] px-4">
        {([
          { key: 'critical', label: `Critiques (${criticalClauses.length})` },
          { key: 'notices',  label: `Préavis (${upcomingNotices.length})` },
          { key: 'all',      label: `Toutes (${result.clauses.length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Liste des clauses ────────────────────────────────────────────────── */}
      <div className="p-4 space-y-3">
        {sortedClauses.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">
            {activeTab === 'critical' ? 'Aucune clause critique détectée ✓' :
             activeTab === 'notices'  ? 'Aucun préavis dans les 90 prochains jours ✓' :
             'Aucune clause analysée'}
          </div>
        ) : (
          sortedClauses.map(clause => <ClauseCard key={clause.clause_id} clause={clause} />)
        )}
      </div>

      {/* ── Footer: métadonnées de traitement ───────────────────────────────── */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
          <span>Modèle: {result.processing_metadata.model_used}</span>
          <span>·</span>
          <span>Traitement: {result.processing_metadata.processing_time_seconds.toFixed(1)}s</span>
          <span>·</span>
          <span>{result.processing_metadata.pii_entities_redacted} données anonymisées</span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          Coût IA: ${result.processing_metadata.estimated_cost_usd.toFixed(3)}
        </span>
      </div>
    </article>
  )
}

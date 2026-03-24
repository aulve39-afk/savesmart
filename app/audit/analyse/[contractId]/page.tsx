'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Mail,
  Copy,
  ExternalLink,
  Euro,
  Calendar,
  Clock,
  Shield,
} from 'lucide-react'

// ── Mock contract data ────────────────────────────────────────────────────────

const MOCK_ANALYSIS = {
  id: 'c1',
  filename: 'bail-commercial-paris-8e-2022.pdf',
  supplier: 'Foncière SCI Haussmann',
  contract_type: 'Bail commercial',
  annual_amount_eur: 84000,
  overall_risk_score: 78,
  overall_risk_level: 'CRITICAL',
  risk_summary: 'Ce bail présente 3 clauses à risque critique. Le délai de préavis de 180 jours expire dans 12 jours. Une action immédiate est requise.',
  notice_deadline: {
    deadline_date: '2025-04-05',
    days_remaining: 12,
    notice_period_months: 6,
    renewal_type: 'TACITE_RECONDUCTION',
    worst_case_year_3_eur: 91_000,
  },
  clauses: [
    {
      id: 'cl1',
      type: 'NOTICE_PERIOD',
      title: 'Délai de préavis 180 jours',
      risk_level: 'CRITICAL',
      risk_score: 92,
      summary: 'Le bail impose un préavis de 6 mois par LRAR. La date limite pour notifier est le 5 avril 2025, soit dans 12 jours.',
      financial_impact_eur: 84000,
      verbatim: 'Article 11 — La résiliation du présent bail devra être notifiée par lettre recommandée avec accusé de réception au moins six (6) mois calendaires avant la date d\'échéance, à défaut de quoi le bail sera renouvelé tacitement pour une période identique.',
      page: 8,
      action_required: 'URGENT',
      recommendation: 'Envoyer immédiatement une LRAR de congé ou de demande de renouvellement selon votre décision commerciale.',
      requires_human_review: false,
      source_confidence: 'high',
    },
    {
      id: 'cl2',
      type: 'PRICE_ESCALATION',
      title: 'Indexation ILAT +3.8%/an',
      risk_level: 'HIGH',
      risk_score: 71,
      summary: 'Révision annuelle du loyer indexée sur l\'ILAT. Projection année 3: +11.5%, soit +€9,660/an supplémentaires.',
      financial_impact_eur: 9660,
      verbatim: 'Article 7 — Le loyer sera révisé chaque année à la date anniversaire en fonction de la variation de l\'Indice des Loyers des Activités Tertiaires (ILAT) publié par l\'INSEE, sans possibilité de diminution en cas de baisse de l\'indice.',
      page: 5,
      action_required: 'NEGOTIATE',
      recommendation: 'Négocier un plafonnement de l\'indexation (cap) à 2% maximum ou passer à une révision tous les 3 ans.',
      requires_human_review: false,
      source_confidence: 'high',
    },
    {
      id: 'cl3',
      type: 'AUTO_RENEWAL',
      title: 'Reconduction tacite 9 ans',
      risk_level: 'HIGH',
      risk_score: 68,
      summary: 'En l\'absence de congé dans le délai, le bail se renouvelle automatiquement pour 9 ans à des conditions potentiellement moins favorables.',
      financial_impact_eur: 756000,
      verbatim: 'Article 12 — À défaut de congé notifié dans les conditions prévues à l\'article 11, le présent bail sera renouvelé de plein droit pour une durée de neuf (9) ans aux mêmes clauses et conditions, sous réserve des dispositions légales applicables à la date du renouvellement.',
      page: 9,
      action_required: 'MONITOR',
      recommendation: 'Si vous souhaitez négocier le loyer de renouvellement, notifiez un congé avec offre de renouvellement à des conditions modifiées.',
      requires_human_review: true,
      source_confidence: 'high',
    },
    {
      id: 'cl4',
      type: 'TERMINATION_PENALTY',
      title: 'Indemnité d\'éviction',
      risk_level: 'MEDIUM',
      risk_score: 45,
      summary: 'En cas de refus de renouvellement par le bailleur, indemnité d\'éviction équivalente à 18 mois de loyer brut.',
      financial_impact_eur: 126000,
      verbatim: 'Article 13 — En cas de refus de renouvellement sans offre de local de remplacement, le bailleur devra verser au preneur une indemnité d\'éviction égale à dix-huit (18) mois du dernier loyer annuel en vigueur.',
      page: 10,
      action_required: 'MONITOR',
      recommendation: 'Clause standard — à surveiller si le bailleur souhaite récupérer les locaux.',
      requires_human_review: false,
      source_confidence: 'medium',
    },
  ],
  processing_metadata: {
    pages_analyzed: 24,
    estimated_cost_usd: 0.18,
    model_used: 'claude-sonnet-4-6',
    analysis_date: '2025-03-24T14:32:00Z',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Clause = typeof MOCK_ANALYSIS.clauses[0]

const RISK_CONFIG = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', label: 'Critique' },
  HIGH: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', label: 'Élevé' },
  MEDIUM: { color: '#eab308', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.25)', label: 'Moyen' },
  LOW: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', label: 'Faible' },
}

type RiskLevel = keyof typeof RISK_CONFIG

function formatEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function RiskGauge({ score }: { score: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#f97316' : '#22c55e'
  return (
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#111827" strokeWidth={8} />
      <circle
        cx="45" cy="45" r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 45 45)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="45" y="49" textAnchor="middle" fill={color} fontSize="16" fontWeight="800">{score}</text>
    </svg>
  )
}

// ── Clause card ───────────────────────────────────────────────────────────────

function ClauseCard({ clause, isSelected, onClick }: {
  clause: Clause
  isSelected: boolean
  onClick: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const risk = RISK_CONFIG[clause.risk_level as RiskLevel]

  return (
    <div
      className={`clause-card${isSelected ? ' selected' : ''}`}
      style={isSelected ? { borderColor: risk.color } : {}}
      onClick={onClick}
    >
      {/* Header */}
      <div className="clause-header">
        <span className="clause-risk-badge" style={{ color: risk.color, background: risk.bg }}>
          {risk.label}
        </span>
        <span className="clause-page">p.{clause.page}</span>
        {clause.requires_human_review && (
          <span className="clause-review-flag">Révision humaine</span>
        )}
      </div>

      <p className="clause-title">{clause.title}</p>
      <p className="clause-summary">{clause.summary}</p>

      {clause.financial_impact_eur > 0 && (
        <div className="clause-impact">
          <Euro size={12} />
          <span>Impact: {formatEur(clause.financial_impact_eur)}</span>
        </div>
      )}

      {/* Verbatim toggle */}
      <button
        className="clause-verbatim-toggle"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
      >
        <FileText size={12} />
        Extrait brut
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="clause-verbatim">
          <p>&ldquo;{clause.verbatim}&rdquo;</p>
        </div>
      )}

      {/* Recommendation */}
      {isSelected && (
        <div className="clause-reco">
          <div className="clause-reco-icon"><Info size={13} /></div>
          <p>{clause.recommendation}</p>
        </div>
      )}
    </div>
  )
}

// ── PDF Viewer (mock) ─────────────────────────────────────────────────────────

function PDFViewer({ filename, selectedPage }: { filename: string; selectedPage: number }) {
  return (
    <div className="pdf-viewer">
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-filename">
          <FileText size={13} />
          <span>{filename}</span>
        </div>
        <div className="pdf-toolbar-actions">
          <span className="pdf-page-indicator">Page {selectedPage} / 24</span>
          <button className="pdf-btn" title="Télécharger">
            <Download size={14} />
          </button>
          <button className="pdf-btn" title="Ouvrir dans un nouvel onglet">
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Simulated PDF */}
      <div className="pdf-content">
        <div className="pdf-page">
          <div className="pdf-page-num">Page {selectedPage}</div>
          {/* Simulated text lines */}
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className={`pdf-line${[3, 4, 5].includes(i) ? ' highlight' : ''}`}
              style={{ width: `${65 + Math.sin(i * 2.3) * 25}%` }}
            />
          ))}
          {/* Highlight annotation */}
          <div className="pdf-highlight-note">
            <div className="pdf-highlight-dot" />
            Clause détectée par l'IA
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Letter generator ──────────────────────────────────────────────────────────

function LetterGenerator({ contract }: { contract: typeof MOCK_ANALYSIS }) {
  const [copied, setCopied] = useState(false)

  const letter = `Objet : Congé du bail commercial — Locaux sis [ADRESSE]

[VILLE], le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}

Madame, Monsieur,

Par la présente, conformément aux dispositions de l'article L.145-9 du Code de commerce et aux stipulations de l'article 11 de notre contrat de bail commercial signé le [DATE SIGNATURE], nous vous notifions le congé du bail commercial portant sur les locaux situés [ADRESSE COMPLÈTE].

Ce congé prendra effet le [DATE FIN BAIL], soit à l'expiration de la période triennale en cours.

Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

[NOM GÉRANT]
[TITRE]
[RAISON SOCIALE]`

  function handleCopy() {
    navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="letter-section">
      <div className="letter-header">
        <div className="letter-title-row">
          <Mail size={16} className="letter-icon" />
          <span className="letter-title">Générer une lettre de résiliation</span>
        </div>
        <p className="letter-sub">Modèle pré-rempli conforme au droit français. À adapter et faire valider par votre juriste.</p>
      </div>
      <div className="letter-body">{letter}</div>
      <div className="letter-actions">
        <button className="letter-btn primary" onClick={handleCopy}>
          {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          {copied ? 'Copié !' : 'Copier le modèle'}
        </button>
        <button className="letter-btn secondary">
          <Download size={14} />
          Télécharger .docx
        </button>
        <span className="letter-disclaimer">
          <Shield size={11} />
          À valider par un professionnel du droit
        </span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalysePage() {
  const analysis = MOCK_ANALYSIS
  const [selectedClauseId, setSelectedClauseId] = useState<string>(analysis.clauses[0].id)
  const [showLetter, setShowLetter] = useState(false)

  const selectedClause = analysis.clauses.find(c => c.id === selectedClauseId)
  const overallRisk = RISK_CONFIG[analysis.overall_risk_level as RiskLevel]

  return (
    <div className="analyse-page">
      {/* ── Top bar ── */}
      <div className="analyse-topbar">
        <Link href="/audit/dashboard" className="back-btn">
          <ArrowLeft size={15} />
          Retour
        </Link>
        <div className="analyse-title-group">
          <h1 className="analyse-title">{analysis.supplier}</h1>
          <span className="analyse-type">{analysis.contract_type}</span>
          <span className="overall-risk-badge" style={{ color: overallRisk.color, background: overallRisk.bg }}>
            Risque {overallRisk.label}
          </span>
        </div>
        <div className="analyse-meta">
          <span className="meta-item"><Calendar size={12} />{analysis.processing_metadata.pages_analyzed} pages</span>
          <span className="meta-item"><Clock size={12} />Analysé aujourd'hui</span>
        </div>
      </div>

      {/* ── Notice alert ── */}
      {analysis.notice_deadline.days_remaining <= 30 && (
        <div className="notice-alert">
          <AlertTriangle size={16} />
          <div>
            <strong>Action requise dans {analysis.notice_deadline.days_remaining} jours</strong>
            {' '}— Le préavis de {analysis.notice_deadline.notice_period_months} mois expire le{' '}
            {new Date(analysis.notice_deadline.deadline_date).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}.
            Sans action, reconduction automatique pour 9 ans ({formatEur(analysis.notice_deadline.worst_case_year_3_eur)}/an).
          </div>
          <button className="notice-alert-cta" onClick={() => setShowLetter(true)}>
            Générer la lettre →
          </button>
        </div>
      )}

      {/* ── Main split layout ── */}
      <div className="split-layout">
        {/* ── Left: PDF ── */}
        <div className="split-left">
          <PDFViewer
            filename={analysis.filename}
            selectedPage={selectedClause?.page ?? 1}
          />
        </div>

        {/* ── Right: AI panel ── */}
        <div className="split-right">
          {/* Score header */}
          <div className="ai-score-header">
            <RiskGauge score={analysis.overall_risk_score} />
            <div className="ai-score-info">
              <p className="ai-score-label">Score de risque global</p>
              <p className="ai-risk-summary">{analysis.risk_summary}</p>
              <div className="ai-financials">
                <div className="ai-fin-item">
                  <Euro size={12} />
                  <span>{formatEur(analysis.annual_amount_eur)}/an</span>
                </div>
                <div className="ai-fin-item">
                  <Shield size={12} />
                  <span>{analysis.clauses.filter(c => c.risk_level === 'CRITICAL' || c.risk_level === 'HIGH').length} clauses à risque</span>
                </div>
              </div>
            </div>
          </div>

          {/* Clauses */}
          <div className="clauses-section">
            <p className="clauses-section-title">
              {analysis.clauses.length} clauses analysées
            </p>
            <div className="clauses-list">
              {analysis.clauses.map(clause => (
                <ClauseCard
                  key={clause.id}
                  clause={clause}
                  isSelected={clause.id === selectedClauseId}
                  onClick={() => setSelectedClauseId(clause.id)}
                />
              ))}
            </div>
          </div>

          {/* CTA: Generate letter */}
          <button
            className="generate-letter-cta"
            onClick={() => setShowLetter(!showLetter)}
          >
            <Mail size={16} />
            Générer une lettre de résiliation en 1 clic
          </button>

          {/* Letter */}
          {showLetter && <LetterGenerator contract={analysis} />}
        </div>
      </div>

      <style jsx>{`
        .analyse-page {
          padding: 28px 32px 64px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 100vh;
        }

        /* ── Top bar ── */
        .analyse-topbar {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 8px;
          font-size: 13px;
          color: #64748b;
          text-decoration: none;
          flex-shrink: 0;
          transition: all 0.15s;
        }

        .back-btn:hover { color: #94a3b8; border-color: #2d3f60; }

        .analyse-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          flex-wrap: wrap;
        }

        .analyse-title {
          font-size: 18px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -0.3px;
        }

        .analyse-type {
          font-size: 12px;
          color: #475569;
          background: #111827;
          border: 1px solid #1a2540;
          padding: 3px 9px;
          border-radius: 6px;
        }

        .overall-risk-badge {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
        }

        .analyse-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #334155;
        }

        /* ── Notice alert ── */
        .notice-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 12px;
          font-size: 13px;
          color: #fca5a5;
          flex-wrap: wrap;
        }

        .notice-alert strong { color: #ef4444; }

        .notice-alert-cta {
          margin-left: auto;
          padding: 7px 16px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
          flex-shrink: 0;
        }

        .notice-alert-cta:hover { background: #dc2626; }

        /* ── Split ── */
        .split-layout {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 20px;
          align-items: start;
        }

        /* ── PDF ── */
        .split-left { position: sticky; top: 24px; }

        .pdf-viewer {
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 14px;
          overflow: hidden;
        }

        .pdf-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #0d1526;
          border-bottom: 1px solid #1a2540;
        }

        .pdf-filename {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: #475569;
        }

        .pdf-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pdf-page-indicator { font-size: 12px; color: #334155; }

        .pdf-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #111827;
          border: 1px solid #1a2540;
          border-radius: 7px;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s;
        }

        .pdf-btn:hover { color: #94a3b8; border-color: #2d3f60; }

        .pdf-content {
          padding: 24px;
          min-height: 600px;
        }

        .pdf-page {
          background: #0d1526;
          border: 1px solid #1a2540;
          border-radius: 10px;
          padding: 28px 24px;
          position: relative;
        }

        .pdf-page-num {
          font-size: 10px;
          color: #334155;
          text-align: center;
          margin-bottom: 20px;
          font-variant-numeric: tabular-nums;
        }

        .pdf-line {
          height: 10px;
          background: #111827;
          border-radius: 3px;
          margin-bottom: 10px;
          transition: background 0.2s;
        }

        .pdf-line.highlight {
          background: rgba(234,179,8,0.25);
          border-left: 2px solid #eab308;
          padding-left: 6px;
        }

        .pdf-highlight-note {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 16px;
          font-size: 11px;
          color: #eab308;
        }

        .pdf-highlight-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #eab308;
          flex-shrink: 0;
        }

        /* ── AI Panel ── */
        .split-right {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ai-score-header {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 14px;
          padding: 18px 20px;
        }

        .ai-score-info { flex: 1; }

        .ai-score-label {
          font-size: 11px;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 6px;
        }

        .ai-risk-summary {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.5;
          margin-bottom: 10px;
        }

        .ai-financials {
          display: flex;
          gap: 12px;
        }

        .ai-fin-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #60a5fa;
        }

        /* ── Clauses ── */
        .clauses-section { display: flex; flex-direction: column; gap: 8px; }

        .clauses-section-title {
          font-size: 12px;
          color: #334155;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .clauses-list { display: flex; flex-direction: column; gap: 8px; }

        .clause-card {
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 12px;
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .clause-card:hover { border-color: #2d3f60; background: #0d1526; }
        .clause-card.selected { background: #0d1526; }

        .clause-header {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .clause-risk-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
        }

        .clause-page {
          font-size: 10px;
          color: #334155;
          background: #111827;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .clause-review-flag {
          font-size: 10px;
          color: #a78bfa;
          background: rgba(168,85,247,0.1);
          padding: 2px 7px;
          border-radius: 4px;
        }

        .clause-title {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .clause-summary {
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }

        .clause-impact {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #f97316;
          font-weight: 600;
        }

        .clause-verbatim-toggle {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #334155;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-top: 2px;
          transition: color 0.15s;
        }

        .clause-verbatim-toggle:hover { color: #64748b; }

        .clause-verbatim {
          background: #060a14;
          border: 1px solid #1a2540;
          border-radius: 8px;
          padding: 12px;
          font-size: 11.5px;
          color: #475569;
          line-height: 1.7;
          font-style: italic;
        }

        .clause-reco {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 8px;
          padding: 10px 12px;
          margin-top: 4px;
        }

        .clause-reco-icon { color: #60a5fa; flex-shrink: 0; margin-top: 1px; }

        .clause-reco p {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.5;
        }

        /* ── Generate letter CTA ── */
        .generate-letter-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15));
          border: 1px solid rgba(59,130,246,0.3);
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #60a5fa;
          cursor: pointer;
          transition: all 0.18s;
        }

        .generate-letter-cta:hover {
          background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2));
          border-color: rgba(59,130,246,0.5);
        }

        /* ── Letter ── */
        .letter-section {
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 14px;
          overflow: hidden;
        }

        .letter-header {
          padding: 16px 18px;
          border-bottom: 1px solid #1a2540;
        }

        .letter-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .letter-icon { color: #60a5fa; }

        .letter-title {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .letter-sub { font-size: 12px; color: #475569; }

        .letter-body {
          padding: 18px;
          font-size: 12px;
          color: #64748b;
          line-height: 1.9;
          white-space: pre-wrap;
          font-family: monospace;
          background: #060a14;
          max-height: 320px;
          overflow-y: auto;
        }

        .letter-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-top: 1px solid #1a2540;
          flex-wrap: wrap;
        }

        .letter-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
        }

        .letter-btn.primary {
          background: #3b82f6;
          color: white;
        }

        .letter-btn.primary:hover { background: #2563eb; }

        .letter-btn.secondary {
          background: #111827;
          border: 1px solid #1a2540;
          color: #64748b;
        }

        .letter-btn.secondary:hover { color: #94a3b8; border-color: #2d3f60; }

        .letter-disclaimer {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #334155;
          margin-left: auto;
        }
      `}</style>
    </div>
  )
}

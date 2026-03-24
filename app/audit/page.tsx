'use client'

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'
import { UploadCloud, ShieldCheck, Globe, EyeOff, ArrowRight, TrendingDown, Clock, FileWarning } from 'lucide-react'
import ContractHealthCard from '../components/audit/ContractHealthCard'
import { useContractAnalysis } from '../hooks/useContractAnalysis'

// ── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file?.type === 'application/pdf') onFile(file)
    },
    [onFile, disabled],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`upload-zone${isDragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      <div className="upload-icon-wrap">
        <UploadCloud size={28} strokeWidth={1.5} />
      </div>
      <p className="upload-title">
        {isDragging ? 'Relâchez pour analyser' : 'Déposez votre contrat'}
      </p>
      <p className="upload-sub">
        ou <span className="upload-browse">parcourez vos fichiers</span>
      </p>
      <p className="upload-hint">PDF uniquement · max 50 Mo · PII anonymisées avant analyse IA</p>
    </div>
  )
}

// ── Progress ──────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Extraction', at: 10 },
  { label: 'Anonymisation', at: 15 },
  { label: 'Structure', at: 20 },
  { label: 'Clauses', at: 80 },
  { label: 'Préavis', at: 90 },
  { label: 'Rapport', at: 100 },
]

function AnalysisProgress({ pct, step }: { pct: number; step: string }) {
  return (
    <div className="progress-card">
      <div className="progress-header">
        <div className="progress-pulse" />
        <span>Analyse en cours…</span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="progress-bar-bg">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-step">{step || 'Initialisation…'}</p>
      <div className="steps-row">
        {STEPS.map(({ label, at }, i) => {
          const done = pct >= at
          const cur = pct >= (STEPS[i - 1]?.at ?? 0) && pct < at
          return (
            <div key={label} className="step-item">
              <div className={`step-pill ${done ? 'done' : cur ? 'cur' : ''}`}>
                {done ? '✓' : cur ? <span className="step-dot" /> : <span className="step-dot dim" />}
                {label}
              </div>
              {i < STEPS.length - 1 && <div className={`step-sep ${done ? 'done' : ''}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { isUploading, uploadError, status, progressPct, currentStep, result, analysisError, uploadContract, reset } =
    useContractAnalysis()

  const isAnalyzing = status === 'pending' || status === 'processing'
  const hasError = !!uploadError || !!analysisError || status === 'failed'
  const pct = isUploading ? 3 : progressPct

  return (
    <div className="audit-page">
      {/* ── Hero ── */}
      {!isAnalyzing && !result && !isUploading && (
        <div className="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Analyse IA · Données traitées en UE · RGPD
          </div>
          <h1 className="hero-h1">
            Économisez <span className="hero-accent">15% de vos frais fixes</span>
            <br />en 2 minutes
          </h1>
          <p className="hero-sub">
            Déposez un contrat fournisseur, bail commercial ou SaaS. Notre IA détecte
            les clauses abusives, les hausses automatiques et les pièges de résiliation.
          </p>

          {/* Social proof metrics */}
          <div className="hero-metrics">
            {[
              { icon: TrendingDown, value: '€ 4 800', label: 'économisés en moy. / an' },
              { icon: Clock, value: '< 2 min', label: "temps d'analyse" },
              { icon: FileWarning, value: '94%', label: 'clauses problématiques détectées' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="hero-metric">
                <Icon size={16} strokeWidth={2} className="hero-metric-icon" />
                <span className="hero-metric-value">{value}</span>
                <span className="hero-metric-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upload ── */}
      {!isAnalyzing && !result && (
        <UploadZone onFile={uploadContract} disabled={isUploading || isAnalyzing} />
      )}

      {/* ── Progress ── */}
      {(isUploading || isAnalyzing) && <AnalysisProgress pct={pct} step={currentStep} />}

      {/* ── Error ── */}
      {hasError && (
        <div className="error-card">
          <FileWarning size={18} />
          <div>
            <p className="error-title">Erreur d'analyse</p>
            <p className="error-msg">{uploadError ?? analysisError ?? "L'analyse a échoué."}</p>
            <button onClick={reset} className="error-retry">Réessayer</button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <>
          <ContractHealthCard result={result} />
          <div className="result-actions">
            <Link href="/audit/dashboard" className="result-cta">
              Voir tous les contrats <ArrowRight size={14} />
            </Link>
            <button onClick={reset} className="result-again">Analyser un autre contrat</button>
          </div>
        </>
      )}

      {/* ── GDPR badges ── */}
      {!result && !isAnalyzing && !isUploading && (
        <div className="gdpr-row">
          {[
            { icon: ShieldCheck, label: 'AES-256', sub: 'Chiffrement au repos' },
            { icon: Globe, label: 'Data EU', sub: 'Paris · Frankfurt' },
            { icon: EyeOff, label: 'PII masquées', sub: "Avant envoi à l'IA" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="gdpr-badge">
              <Icon size={16} strokeWidth={1.5} className="gdpr-icon" />
              <div>
                <p className="gdpr-label">{label}</p>
                <p className="gdpr-sub">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .audit-page {
          max-width: 680px;
          margin: 0 auto;
          padding: 48px 24px 64px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Hero ── */
        .hero { text-align: center; }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 14px;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 99px;
          font-size: 11.5px;
          color: #60a5fa;
          margin-bottom: 20px;
        }

        .hero-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
        }

        .hero-h1 {
          font-size: clamp(26px, 4vw, 36px);
          font-weight: 800;
          letter-spacing: -0.8px;
          line-height: 1.2;
          color: #f1f5f9;
          margin-bottom: 14px;
        }

        .hero-accent {
          background: linear-gradient(90deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          font-size: 15px;
          color: #64748b;
          line-height: 1.6;
          max-width: 520px;
          margin: 0 auto 24px;
        }

        .hero-metrics {
          display: flex;
          justify-content: center;
          gap: 0;
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 14px;
          overflow: hidden;
        }

        .hero-metric {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 16px 12px;
          border-right: 1px solid #1a2540;
        }

        .hero-metric:last-child { border-right: none; }

        .hero-metric-icon { color: #3b82f6; margin-bottom: 2px; }

        .hero-metric-value {
          font-size: 18px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -0.5px;
        }

        .hero-metric-label {
          font-size: 11px;
          color: #475569;
          text-align: center;
        }

        /* ── Upload Zone ── */
        :global(.upload-zone) {
          background: #0a0f1e;
          border: 2px dashed #1a2540;
          border-radius: 16px;
          padding: 48px 32px;
          text-align: center;
          cursor: pointer;
          transition: all 0.18s;
        }

        :global(.upload-zone:hover) {
          border-color: #2d3f60;
          background: #0d1526;
        }

        :global(.upload-zone.dragging) {
          border-color: #3b82f6;
          background: rgba(59,130,246,0.06);
          transform: scale(1.01);
        }

        :global(.upload-zone.disabled) {
          opacity: 0.5;
          cursor: not-allowed;
        }

        :global(.upload-icon-wrap) {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: #111827;
          border: 1px solid #1a2540;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          color: #475569;
        }

        :global(.upload-title) {
          font-size: 16px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 6px;
        }

        :global(.upload-sub) {
          font-size: 14px;
          color: #475569;
        }

        :global(.upload-browse) {
          color: #60a5fa;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        :global(.upload-hint) {
          font-size: 11.5px;
          color: #334155;
          margin-top: 12px;
        }

        /* ── Progress ── */
        .progress-card {
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 16px;
          padding: 24px;
        }

        .progress-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          font-size: 14px;
          color: #e2e8f0;
          font-weight: 500;
        }

        .progress-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          animation: pulse 1.4s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .progress-pct {
          margin-left: auto;
          font-variant-numeric: tabular-nums;
          color: #60a5fa;
          font-weight: 700;
        }

        .progress-bar-bg {
          height: 4px;
          background: #111827;
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #6366f1);
          border-radius: 99px;
          transition: width 0.5s ease;
        }

        .progress-step { font-size: 12px; color: #475569; margin-bottom: 16px; }

        .steps-row {
          display: flex;
          align-items: center;
          gap: 0;
          flex-wrap: wrap;
          gap: 4px;
        }

        .step-item { display: flex; align-items: center; gap: 4px; }

        .step-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 11px;
          color: #334155;
          background: #111827;
          white-space: nowrap;
        }

        .step-pill.done { background: rgba(59,130,246,0.12); color: #60a5fa; }
        .step-pill.cur { background: #1a2540; color: #94a3b8; }

        .step-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3b82f6;
          animation: pulse 1.4s infinite;
        }

        .step-dot.dim { background: #1e2d45; animation: none; }

        .step-sep {
          width: 16px;
          height: 1px;
          background: #1a2540;
        }

        .step-sep.done { background: #2d4a7a; }

        /* ── Error ── */
        .error-card {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          background: rgba(239,68,68,0.06);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 12px;
          padding: 16px;
          color: #fca5a5;
        }

        .error-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
        .error-msg { font-size: 12px; color: #f87171; }
        .error-retry {
          font-size: 12px;
          color: #fca5a5;
          text-decoration: underline;
          text-underline-offset: 2px;
          margin-top: 6px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        /* ── Result actions ── */
        .result-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          justify-content: center;
        }

        .result-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.15s;
        }

        .result-cta:hover { background: #2563eb; }

        .result-again {
          font-size: 13px;
          color: #475569;
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        /* ── GDPR ── */
        .gdpr-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .gdpr-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 12px;
          padding: 14px;
        }

        .gdpr-icon { color: #3b82f6; flex-shrink: 0; }

        .gdpr-label {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 1px;
        }

        .gdpr-sub { font-size: 11px; color: #334155; }
      `}</style>
    </div>
  )
}

'use client'

/**
 * Page /audit — Dashboard principal Audit-Agent AI.
 *
 * Fonctionnalités:
 * - Zone de drop PDF (drag & drop + sélecteur fichier)
 * - Barre de progression en temps réel (polling Celery)
 * - Affichage du ContractHealthCard une fois l'analyse terminée
 */

import { useCallback, useRef, useState } from 'react'
import ContractHealthCard from '../components/audit/ContractHealthCard'
import { useContractAnalysis } from '../hooks/useContractAnalysis'

// ── Composant UploadZone ──────────────────────────────────────────────────────

interface UploadZoneProps {
  onFile: (file: File) => void
  disabled: boolean
}

function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (file?.type === 'application/pdf') {
        onFile(file)
      }
    },
    [onFile, disabled],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer select-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--text-secondary)]'}
        ${isDragging
          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01]'
          : 'border-[var(--border-input)] bg-[var(--bg-secondary)]'
        }`}
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

      {/* Icône */}
      <div className="flex justify-center mb-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
          ${isDragging ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-[var(--bg-card)]'} border border-[var(--border)]`}>
          <svg className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-[var(--text-muted)]'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      </div>

      <p className="text-[var(--text-primary)] font-semibold mb-1">
        {isDragging ? 'Relâchez pour analyser' : 'Déposez votre contrat ici'}
      </p>
      <p className="text-sm text-[var(--text-muted)]">
        ou <span className="text-[var(--text-secondary)] underline underline-offset-2">parcourez vos fichiers</span>
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-3">PDF uniquement · max 50 Mo · données anonymisées avant analyse</p>
    </div>
  )
}

// ── Composant AnalysisProgress ────────────────────────────────────────────────

function AnalysisProgress({ pct, step }: { pct: number; step: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Analyse en cours…</span>
        </div>
        <span className="text-sm font-bold tabular-nums text-[var(--text-secondary)]">{pct}%</span>
      </div>

      {/* Barre de progression */}
      <div className="w-full h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-[var(--text-muted)]">{step || 'Initialisation…'}</p>

      {/* Étapes visuelles */}
      <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
        {[
          { label: 'Extraction', threshold: 10 },
          { label: 'Anonymisation', threshold: 15 },
          { label: 'Structure', threshold: 20 },
          { label: 'Clauses', threshold: 80 },
          { label: 'Préavis', threshold: 90 },
          { label: 'Rapport', threshold: 100 },
        ].map(({ label, threshold }, i, arr) => {
          const isDone = pct >= threshold
          const isCurrent = pct >= (arr[i-1]?.threshold ?? 0) && pct < threshold
          return (
            <div key={label} className="flex items-center gap-1">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs whitespace-nowrap transition-colors
                ${isDone ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  isCurrent ? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]' :
                  'text-[var(--text-muted)]'}`}>
                {isDone ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : isCurrent ? (
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-[var(--border-input)]" />
                )}
                {label}
              </div>
              {i < arr.length - 1 && (
                <div className={`w-4 h-px ${isDone ? 'bg-blue-300 dark:bg-blue-700' : 'bg-[var(--border)]'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AuditPage() {
  const { isUploading, uploadError, status, progressPct, currentStep, result, analysisError, uploadContract, reset } =
    useContractAnalysis()

  const isAnalyzing = status === 'pending' || status === 'processing'
  const hasError = !!uploadError || !!analysisError || status === 'failed'

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── En-tête ──────────────────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-muted)] mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Audit-Agent AI · Données traitées en UE
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Audit de contrat</h1>
          <p className="text-[var(--text-secondary)] text-sm max-w-md mx-auto">
            Identifiez les fuites de trésorerie — hausses de prix, renouvellements tacites,
            pénalités de résiliation — en moins de 2 minutes.
          </p>
        </div>

        {/* ── Zone d'upload ────────────────────────────────────────────────── */}
        {!isAnalyzing && !result && (
          <UploadZone
            onFile={uploadContract}
            disabled={isUploading || isAnalyzing}
          />
        )}

        {/* ── Barre de progression ─────────────────────────────────────────── */}
        {(isUploading || isAnalyzing) && (
          <AnalysisProgress
            pct={isUploading ? 3 : progressPct}
            step={isUploading ? 'Envoi du fichier...' : currentStep}
          />
        )}

        {/* ── Erreur ───────────────────────────────────────────────────────── */}
        {hasError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Erreur d'analyse</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                  {uploadError ?? analysisError ?? "L'analyse a échoué. Veuillez réessayer."}
                </p>
                <button onClick={reset} className="mt-2 text-xs text-red-700 dark:text-red-400 underline underline-offset-2">
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Résultat ─────────────────────────────────────────────────────── */}
        {result && (
          <>
            <ContractHealthCard result={result} />
            <div className="flex justify-center">
              <button
                onClick={reset}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors underline underline-offset-2"
              >
                Analyser un autre contrat
              </button>
            </div>
          </>
        )}

        {/* ── Garanties RGPD ───────────────────────────────────────────────── */}
        {!result && !isAnalyzing && !isUploading && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: '🔒', label: 'Données chiffrées', sub: 'AES-256 au repos' },
              { icon: '🇪🇺', label: 'Data Residency EU', sub: 'Serveurs Paris/Frankfurt' },
              { icon: '🕵️', label: 'PII anonymisées', sub: 'Avant envoi à l\'IA' },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
                <div className="text-2xl mb-1">{icon}</div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
                <p className="text-xs text-[var(--text-muted)]">{sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

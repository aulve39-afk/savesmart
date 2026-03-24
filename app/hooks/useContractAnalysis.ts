/**
 * useContractAnalysis — React Query hook pour l'upload et le suivi d'analyse.
 *
 * Workflow:
 * 1. uploadContract(file) → POST /contracts/upload → retourne job_id
 * 2. Hook de polling automatique toutes les 2s → GET /analysis/{job_id}
 * 3. Quand status=completed → invalide les queries de liste
 * 4. Gestion des erreurs avec retry intelligent (réseau vs erreur serveur)
 *
 * Compatible React Query v5 (TanStack Query).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type { AnalysisResult } from '../components/audit/ContractHealthCard'

// ── Types API ─────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'requires_review'

interface AnalysisJobResponse {
  job_id: string
  contract_id: string
  status: JobStatus
  estimated_completion_seconds: number
  polling_url: string
}

interface AnalysisStatusResponse {
  job_id: string
  status: JobStatus
  progress_pct: number
  current_step: string
  result: AnalysisResult | null
  error_message: string | null
}

// ── Configuration ─────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_AUDIT_API_URL ?? 'http://localhost:8000/api/v1'

// Polling interval: 2s pendant l'analyse, arrêt automatique à la fin
const POLLING_INTERVAL_MS = 2_000

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body: FormData | object): Promise<T> {
  const isFormData = body instanceof FormData
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? body : JSON.stringify(body),
    credentials: 'include',
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, errorData.detail ?? 'Unknown error')
  }

  return res.json()
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, errorData.detail ?? 'Unknown error')
  }

  return res.json()
}

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isRetryable(): boolean {
    // Retry uniquement sur les erreurs transitoires (réseau, 5xx, rate limit)
    return this.status === 0 || this.status === 429 || this.status >= 500
  }
}

// ── Hook principal ────────────────────────────────────────────────────────────

interface UseContractAnalysisReturn {
  // État de l'upload
  isUploading: boolean
  uploadError: string | null

  // État de l'analyse
  jobId: string | null
  status: JobStatus | null
  progressPct: number
  currentStep: string

  // Résultat final
  result: AnalysisResult | null
  analysisError: string | null

  // Actions
  uploadContract: (file: File) => void
  reset: () => void
}

export function useContractAnalysis(): UseContractAnalysisReturn {
  const queryClient = useQueryClient()
  const [jobId, setJobId] = useState<string | null>(null)

  // ── Mutation d'upload ──────────────────────────────────────────────────────
  const uploadMutation = useMutation<AnalysisJobResponse, ApiError, File>({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return apiPost<AnalysisJobResponse>('/contracts/upload', form)
    },
    onSuccess: (data) => {
      setJobId(data.job_id)
    },
    onError: (error) => {
      console.error('Upload failed:', error.message)
    },
    // Retry côté upload: uniquement sur les erreurs réseau (status 0)
    retry: (failureCount, error) => {
      return failureCount < 2 && error.status === 0
    },
  })

  // ── Query de polling ───────────────────────────────────────────────────────
  const pollingQuery = useQuery<AnalysisStatusResponse, ApiError>({
    queryKey: ['analysis-status', jobId],
    queryFn: () => apiGet<AnalysisStatusResponse>(`/contracts/analysis/${jobId}`),

    // Désactivé si pas de jobId
    enabled: !!jobId,

    // Polling toutes les 2s
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return POLLING_INTERVAL_MS
      // Arrêt du polling quand l'analyse est terminée (succès ou échec)
      const isDone = data.status === 'completed' || data.status === 'failed'
      return isDone ? false : POLLING_INTERVAL_MS
    },

    // Pas de refetch sur le focus de fenêtre (évite les appels superflus)
    refetchOnWindowFocus: false,

    // Retry: 3 fois sur les erreurs transitoires
    retry: (failureCount, error) => {
      return failureCount < 3 && error.isRetryable
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  })

  // React Query v5: onSuccess retiré de useQuery → useEffect
  const pollingData = pollingQuery.data
  useEffect(() => {
    if (pollingData?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    }
  }, [pollingData?.status, queryClient])

  const reset = useCallback(() => {
    setJobId(null)
    uploadMutation.reset()
    if (jobId) {
      queryClient.removeQueries({ queryKey: ['analysis-status', jobId] })
    }
  }, [jobId, uploadMutation, queryClient])

  // ── Agrégation de l'état ──────────────────────────────────────────────────
  const uploadError = uploadMutation.error?.message ?? null
  const analysisError =
    pollingQuery.error?.message ??
    pollingData?.error_message ??
    null

  return {
    isUploading: uploadMutation.isPending,
    uploadError,

    jobId,
    status: pollingData?.status ?? null,
    progressPct: pollingData?.progress_pct ?? 0,
    currentStep: pollingData?.current_step ?? '',

    result: pollingData?.result ?? null,
    analysisError,

    uploadContract: uploadMutation.mutate,
    reset,
  }
}

// ── Hook pour récupérer une analyse déjà sauvegardée ──────────────────────────

export function useContractResult(contractId: string | null) {
  return useQuery<AnalysisResult, ApiError>({
    queryKey: ['contract', contractId],
    queryFn: () => apiGet<AnalysisResult>(`/contracts/${contractId}`),
    enabled: !!contractId,
    // Les résultats d'analyse sont immuables → cache 5 minutes
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// ── Hook pour la liste des contrats ──────────────────────────────────────────

export function useContractsList() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () => apiGet<{ contracts: AnalysisResult[]; total: number }>('/contracts'),
    staleTime: 60_000, // 1 minute
  })
}

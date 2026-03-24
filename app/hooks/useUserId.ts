'use client'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export function useUserId() {
  const { data: session, status } = useSession()
  const [localId, setLocalId] = useState<string | null>(null)
  const [localReady, setLocalReady] = useState(false)

  // Migration des données invité → compte Google après connexion
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return
    try {
      const pendingMigration = localStorage.getItem('klyp_pending_migration')
      if (!pendingMigration) return
      // Lancer la migration en arrière-plan (fire and forget)
      fetch('/api/migrate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId: pendingMigration }),
      }).catch(() => {})
      // Supprimer le flag immédiatement (même si la migration échoue, on ne réessaie pas)
      localStorage.removeItem('klyp_pending_migration')
    } catch {}
  }, [status, session?.user?.email])

  useEffect(() => {
    // Charger ou créer un UUID local pour les utilisateurs anonymes
    let id = localStorage.getItem('klyp_user_id')
    if (!id) {
      // Migration depuis l'ancienne clé savesmart_user_id
      const legacyId = localStorage.getItem('savesmart_user_id')
      if (legacyId) {
        id = legacyId
        localStorage.setItem('klyp_user_id', id)
        const migrations: [string, string][] = [
          ['savesmart_privacy',          'klyp_privacy'],
          ['savesmart_monthly_goal',     'klyp_monthly_goal'],
          ['savesmart_prenom',           'klyp_prenom'],
          ['savesmart_nom',              'klyp_nom'],
          ['savesmart_install_dismissed','klyp_install_dismissed'],
          ['savesmart_onboarding_active','klyp_onboarding_active'],
          ['savesmart_last_added',       'klyp_last_added'],
        ]
        for (const [oldKey, newKey] of migrations) {
          const val = localStorage.getItem(oldKey)
          if (val !== null) { localStorage.setItem(newKey, val); localStorage.removeItem(oldKey) }
        }
        const oldPricesKey = `savesmart_prices_${id}`
        const prices = localStorage.getItem(oldPricesKey)
        if (prices) { localStorage.setItem(`klyp_prices_${id}`, prices); localStorage.removeItem(oldPricesKey) }
      } else {
        id = crypto.randomUUID()
        localStorage.setItem('klyp_user_id', id)
      }
    }
    setLocalId(id)
    setLocalReady(true)
  }, [])

  const isAuthenticated = status === 'authenticated'

  // Connecté avec Google → email comme userId (sync multi-appareils)
  // Anonyme → UUID localStorage (espace local à l'appareil)
  const userId = isAuthenticated ? (session?.user?.email ?? null) : localId

  return {
    userId,
    user: session?.user ?? null,
    status,
    isLoading: status === 'loading' || !localReady,
    isAuthenticated,
  }
}

'use client'
import { useEffect, useState } from 'react'

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let id = localStorage.getItem('klyp_user_id')
    if (!id) {
      // Migration depuis l'ancienne clé savesmart_user_id
      const legacyId = localStorage.getItem('savesmart_user_id')
      if (legacyId) {
        id = legacyId
        localStorage.setItem('klyp_user_id', id)
        // Migrer aussi les autres clés
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
          if (val !== null) {
            localStorage.setItem(newKey, val)
            localStorage.removeItem(oldKey)
          }
        }
        // Migrer les prix sauvegardés
        const oldPricesKey = `savesmart_prices_${id}`
        const prices = localStorage.getItem(oldPricesKey)
        if (prices) {
          localStorage.setItem(`klyp_prices_${id}`, prices)
          localStorage.removeItem(oldPricesKey)
        }
      } else {
        id = crypto.randomUUID()
        localStorage.setItem('klyp_user_id', id)
      }
    }
    setUserId(id)
  }, [])

  return {
    userId,
    user: null,
    status: userId ? 'authenticated' : 'loading',
    isLoading: !userId,
  }
}

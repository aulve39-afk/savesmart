'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions } from '../store'
import { useUserId } from './useUserId'

export function useOnboarding() {
  const { userId, user, status, isLoading } = useUserId()
  const router = useRouter()
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  useEffect(() => {
    if (!userId) return
    getSubscriptions(userId).then((subs) => {
      if (subs.length === 0) {
        // Ne pas rediriger si l'utilisateur est en train de faire l'onboarding
        // ou s'il a explicitement choisi de passer l'onboarding
        const onboardingActive = localStorage.getItem('klyp_onboarding_active') === '1'
        const onboardingSkipped = localStorage.getItem('klyp_onboarding_skipped') === '1'
        if (!onboardingActive && !onboardingSkipped) {
          router.push('/onboarding')
        } else {
          setOnboardingChecked(true)
        }
      } else {
        // Des abonnements existent → nettoyer les flags d'onboarding
        try {
          localStorage.removeItem('klyp_onboarding_active')
          localStorage.removeItem('klyp_onboarding_skipped')
        } catch {}
        setOnboardingChecked(true)
      }
    })
  }, [userId, router])

  return {
    userId,
    user,
    status,
    isLoading: isLoading || (!!userId && !onboardingChecked),
  }
}

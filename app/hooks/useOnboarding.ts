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
        router.push('/onboarding')
      } else {
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

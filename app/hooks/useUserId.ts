'use client'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useUserId() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // L'identifiant stable de l'utilisateur = son email Google
  const userId = session?.user?.email ?? null

  return {
    userId,
    user: session?.user ?? null,
    status,
    isLoading: status === 'loading' || status === 'unauthenticated',
  }
}

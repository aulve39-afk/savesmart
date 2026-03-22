'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useUserId() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  return {
    userId: (session?.user?.email ?? null) as string | null,
    user: session?.user ?? null,
    status,
    isLoading: status === 'loading',
  }
}

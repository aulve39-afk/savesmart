'use client'
import { useSession } from 'next-auth/react'

export function useUserId() {
  const { data: session, status } = useSession()

  return {
    userId: session?.userId ?? null,
    user: session?.user ?? null,
    status,
    isLoading: status === 'loading',
  }
}

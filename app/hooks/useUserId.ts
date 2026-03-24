'use client'
import { useEffect, useState } from 'react'

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let id = localStorage.getItem('klyp_user_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('klyp_user_id', id)
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

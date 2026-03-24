'use client'
import { useEffect, useState } from 'react'

export function usePrivacyMode() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      setHidden(localStorage.getItem('klyp_privacy') === '1')
    } catch {}
  }, [])

  const toggle = () => {
    setHidden(prev => {
      const next = !prev
      try { localStorage.setItem('klyp_privacy', next ? '1' : '0') } catch {}
      return next
    })
  }

  return { hidden, toggle }
}

'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Animates from 0 to `target` over `duration` ms (ease-out cubic).
 * Re-triggers whenever target changes.
 */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (target === 0) { setValue(0); return }
    startRef.current = null
    setValue(0)

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const t = Math.min((ts - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setValue(target)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

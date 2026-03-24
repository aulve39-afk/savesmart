/**
 * Simple in-memory rate limiter.
 * Works correctly on a single Node.js instance (dev / single Vercel function).
 * For multi-instance production, replace with an Upstash Redis-backed solution.
 */

type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60_000)

/**
 * @param key     Unique key, e.g. `${ip}:/api/scan`
 * @param limit   Max requests per window (default 10)
 * @param windowMs Window size in ms (default 60 s)
 */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true }
}

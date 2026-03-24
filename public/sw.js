// SaveSmart Service Worker
// Strategy:
//   - Static assets (_next/static, icons, manifest): cache-first, long-lived
//   - App pages (/, /stats, /calendrier…): stale-while-revalidate
//   - API routes (/api/*): network-only — never cache sensitive financial data

const CACHE = 'savesmart-v1'

const APP_SHELL = [
  '/',
  '/stats',
  '/calendrier',
  '/historique',
  '/conseiller',
  '/compte',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/maskable.svg',
]

// ── Install: pre-cache the app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll() is atomic — if one fails we still install, just without cache
      cache.addAll(APP_SHELL).catch(() => {})
    )
  )
  self.skipWaiting()
})

// ── Activate: purge old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // API calls → network-only (NEVER cache financial data)
  if (url.pathname.startsWith('/api/')) return

  // Static assets (_next/static/) → cache-first (immutable content hashes)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone()
              caches.open(CACHE).then((c) => c.put(request, clone))
            }
            return res
          })
      )
    )
    return
  }

  // Pages → stale-while-revalidate (show cached instantly, update in background)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone())
          return res
        })
        // Return cached immediately if available, update behind the scenes
        return cached || networkFetch
      })
    )
    return
  }

  // Everything else (fonts, images, SVGs) → cache-first with network fallback
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(request, clone))
          }
          return res
        })
    )
  )
})

// ── Push notifications (future-proof stub) ───────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  self.registration.showNotification(data.title || 'SaveSmart', {
    body: data.body || '',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    data: { url: data.url || '/' },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})

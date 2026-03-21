export type Subscription = {
  id: string
  company_name: string
  amount: number
  billing_cycle: string
  category: string
  details?: Record<string, any>
  detected_at: string
}

export function getSubscriptions(): Subscription[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem('savesmart_subscriptions')
  return data ? JSON.parse(data) : []
}

export function addSubscription(sub: Omit<Subscription, 'id' | 'detected_at'>): Subscription {
  const subscriptions = getSubscriptions()
  const newSub: Subscription = {
    ...sub,
    id: Date.now().toString(),
    detected_at: new Date().toISOString(),
  }
  subscriptions.push(newSub)
  localStorage.setItem('savesmart_subscriptions', JSON.stringify(subscriptions))
  return newSub
}

export function removeSubscription(id: string): void {
  const subscriptions = getSubscriptions().filter(s => s.id !== id)
  localStorage.setItem('savesmart_subscriptions', JSON.stringify(subscriptions))
}
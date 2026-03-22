import { getSupabase } from '../lib/supabase'

export type Subscription = {
  id: string
  user_id: string
  company_name: string
  amount: number
  billing_cycle: string
  category: string
  details?: Record<string, any>
  detected_at: string
}

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
  if (error) {
    console.error('Error fetching subscriptions:', error)
    return []
  }
  return data || []
}

export async function addSubscription(
  sub: Omit<Subscription, 'id' | 'detected_at' | 'user_id'>,
  userId: string
): Promise<Subscription | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ ...sub, user_id: userId } as any)
    .select()
    .single()
  if (error) {
    console.error('Error adding subscription:', error)
    return null
  }
  return data
}

export async function updateSubscriptionDetails(id: string, details: Record<string, any>, userId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('subscriptions')
    .update({ details } as any)
    .eq('id', id)
    .eq('user_id', userId)
  if (error) console.error('Error updating subscription:', error)
}

export async function removeSubscription(id: string, userId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) console.error('Error removing subscription:', error)
}

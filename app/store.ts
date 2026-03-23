import { getSupabase } from '../lib/supabase'

export type UserPlan = {
  user_id: string
  plan: 'free' | 'premium'
  plan_started_at: string
  plan_expires_at: string | null
}

export type Payment = {
  id: string
  user_id: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'failed'
  description: string
  created_at: string
  invoice_url: string | null
}

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data ?? { user_id: userId, plan: 'free', plan_started_at: new Date().toISOString(), plan_expires_at: null }
}

export async function getPayments(userId: string): Promise<Payment[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function deleteAccount(userId: string): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('subscriptions').delete().eq('user_id', userId)
  await supabase.from('payments').delete().eq('user_id', userId)
  await supabase.from('user_profiles').delete().eq('user_id', userId)
}

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

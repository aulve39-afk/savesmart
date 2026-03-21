import { supabase } from '../lib/supabase'

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

const USER_ID = 'local-user'

export async function getSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', USER_ID)
    .order('detected_at', { ascending: false })
  if (error) {
    console.error('Error fetching subscriptions:', error)
    return []
  }
  return data || []
}

export async function addSubscription(
  sub: Omit<Subscription, 'id' | 'detected_at' | 'user_id'>
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ ...sub, user_id: USER_ID })
    .select()
    .single()
  if (error) {
    console.error('Error adding subscription:', error)
    return null
  }
  return data
}

export async function removeSubscription(id: string): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID)
  if (error) console.error('Error removing subscription:', error)
}
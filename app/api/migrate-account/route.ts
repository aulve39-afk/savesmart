import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getSupabase } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
  // Vérifier que l'utilisateur est bien connecté
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { fromUserId } = await req.json()
  if (!fromUserId || typeof fromUserId !== 'string') {
    return NextResponse.json({ error: 'fromUserId manquant' }, { status: 400 })
  }

  const toUserId = session.user.email

  // Sécurité : ne pas migrer vers soi-même
  if (fromUserId === toUserId) {
    return NextResponse.json({ migrated: 0 })
  }

  const supabase = getSupabase()

  // Vérifier si le compte Google a déjà des abonnements
  const { data: existingGoogleSubs } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', toUserId)
    .limit(1)

  const googleAlreadyHasData = (existingGoogleSubs?.length ?? 0) > 0

  if (googleAlreadyHasData) {
    // Le compte Google a déjà des données → on supprime les données invité
    // (l'utilisateur s'est déjà connecté avant depuis un autre appareil)
    await supabase.from('subscriptions').delete().eq('user_id', fromUserId)
    await supabase.from('payments').delete().eq('user_id', fromUserId)
    await supabase.from('user_profiles').delete().eq('user_id', fromUserId)
    return NextResponse.json({ migrated: 0, reason: 'google_account_already_has_data' })
  }

  // Migrer les abonnements
  const { data: migratedSubs, error: subError } = await supabase
    .from('subscriptions')
    .update({ user_id: toUserId } as any)
    .eq('user_id', fromUserId)
    .select()

  if (subError) {
    console.error('Migration subscriptions error:', subError)
    return NextResponse.json({ error: 'Erreur migration' }, { status: 500 })
  }

  // Migrer les paiements
  await supabase
    .from('payments')
    .update({ user_id: toUserId } as any)
    .eq('user_id', fromUserId)

  // Migrer le profil utilisateur
  await supabase
    .from('user_profiles')
    .update({ user_id: toUserId } as any)
    .eq('user_id', fromUserId)

  return NextResponse.json({ migrated: migratedSubs?.length ?? 0 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { checkRateLimit } from '../../../lib/rateLimit'
import { deleteAccount } from '../../store'

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // 3 attempts per hour to prevent abuse
  const { allowed, retryAfter } = checkRateLimit(`delete:${session.userId}`, 3, 60 * 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const { userId } = await request.json()
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId manquant' }, { status: 400 })
  }
  await deleteAccount(userId)
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '../../../lib/rateLimit'
import { deleteAccount } from '../../store'

export async function DELETE(request: NextRequest) {
  // Rate limit by IP: 3 attempts per hour
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const { allowed, retryAfter } = checkRateLimit(`delete:${ip}`, 3, 60 * 60_000)
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

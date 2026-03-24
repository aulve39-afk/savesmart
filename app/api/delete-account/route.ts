import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { deleteAccount } from '../../store'

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { userId } = await request.json()
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId manquant' }, { status: 400 })
  }
  await deleteAccount(userId)
  return NextResponse.json({ success: true })
}

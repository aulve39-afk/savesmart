import { NextRequest, NextResponse } from 'next/server'
import { deleteAccount } from '../../store'

export async function DELETE(request: NextRequest) {
  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId manquant' }, { status: 400 })
  }
  await deleteAccount(userId)
  return NextResponse.json({ success: true })
}

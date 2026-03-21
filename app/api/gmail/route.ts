import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

const INVOICE_KEYWORDS = ['facture', 'invoice', 'abonnement', 'subscription', 'prelevement', 'renouvellement', 'paiement', 'receipt']

export async function GET(req: NextRequest) {
  const session = await getServerSession()

  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: 'Non connecte' }, { status: 401 })
  }

  const accessToken = (session as any).accessToken

  try {
    const query = INVOICE_KEYWORDS.map(k => `subject:(${k})`).join(' OR ')
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    const listData = await listRes.json()
    const messages = listData.messages || []

    const results = []

    for (const msg of messages.slice(0, 5)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const msgData = await msgRes.json()
      const headers = msgData.payload?.headers || []
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
      const from = headers.find((h: any) => h.name === 'From')?.value || ''

      results.push({ id: msg.id, subject, from })
    }

    return NextResponse.json({ emails: results, total: messages.length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur Gmail' }, { status: 500 })
  }
}
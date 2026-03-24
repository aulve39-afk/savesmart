import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { checkRateLimit } from '../../../lib/rateLimit'
import OpenAI from 'openai'

const PROMPT = 'Tu es un expert comptable francais. Analyse ce releve bancaire et detecte TOUS les prelevements recurrents (abonnements, factures mensuelles). Pour chaque prelevement recurrent trouve, retourne un objet JSON. Reponds UNIQUEMENT avec un tableau JSON sans markdown: [{"company_name": "Netflix", "amount": 13.99, "billing_cycle": "monthly", "category": "streaming", "details": {}}, ...]. Regles pour category: streaming = Netflix Spotify Disney Canal+. telecom_mobile = forfait mobile SFR Free Orange Bouygues. telecom_box = box internet fibre Livebox Freebox Bbox. energie = EDF Engie electricite gaz. assurance = assurance habitation auto. saas = logiciel abonnement. other = reste. Ignore les achats ponctuels, retraits, virements. Ne retourne QUE les prelevements qui semblent recurrents. Si aucun prelevement recurrent trouve retourne []'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // 5 analyses per minute per user
  const { allowed, retryAfter } = checkRateLimit(`releve:${session.userId}`, 5)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes, réessayez dans un moment' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const { image } = await req.json()

    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Image invalide' }, { status: 400 })
    }
    if (image.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image trop grande (max 7,5 Mo)' }, { status: 400 })
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: image, detail: 'high' },
            },
            {
              type: 'text',
              text: PROMPT,
            },
          ],
        },
      ],
    })

    const content = response.choices[0].message.content || '[]'
    const cleaned = content.replace(/```json|```/g, '').trim()
    let result: unknown
    try {
      result = JSON.parse(cleaned)
    } catch {
      result = []
    }

    return NextResponse.json({ subscriptions: Array.isArray(result) ? result : [] })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}

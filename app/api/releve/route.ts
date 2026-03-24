import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '../../../lib/rateLimit'
import Anthropic from '@anthropic-ai/sdk'

const PROMPT = 'Tu es un expert comptable francais. Analyse ce releve bancaire et detecte TOUS les prelevements recurrents (abonnements, factures mensuelles). Pour chaque prelevement recurrent trouve, retourne un objet JSON. Reponds UNIQUEMENT avec un tableau JSON sans markdown: [{"company_name": "Netflix", "amount": 13.99, "billing_cycle": "monthly", "category": "streaming", "details": {}}, ...]. Regles pour category: streaming = Netflix Spotify Disney Canal+. telecom_mobile = forfait mobile SFR Free Orange Bouygues. telecom_box = box internet fibre Livebox Freebox Bbox. energie = EDF Engie electricite gaz. assurance = assurance habitation auto. saas = logiciel abonnement. other = reste. Ignore les achats ponctuels, retraits, virements. Ne retourne QUE les prelevements qui semblent recurrents. Si aucun prelevement recurrent trouve retourne []'

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const { allowed, retryAfter } = checkRateLimit(`releve:${ip}`, 5)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes, réessayez dans un moment' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const { image } = await req.json()

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Image invalide' }, { status: 400 })
    }
    if (image.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image trop grande (max 7,5 Mo)' }, { status: 400 })
    }

    const match = image.match(/^data:(image\/[a-z]+);base64,(.+)$/)
    if (!match || !ALLOWED_MEDIA_TYPES.has(match[1])) {
      return NextResponse.json({ error: 'Image invalide' }, { status: 400 })
    }
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    const data = match[2]

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    const content = textBlock?.type === 'text' ? textBlock.text : '[]'
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

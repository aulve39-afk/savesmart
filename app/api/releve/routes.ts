import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const PROMPT = 'Tu es un expert comptable francais. Analyse ce releve bancaire et detecte TOUS les prelevements recurrents (abonnements, factures mensuelles). Pour chaque prelevement recurrent trouve, retourne un objet JSON. Reponds UNIQUEMENT avec un tableau JSON sans markdown: [{"company_name": "Netflix", "amount": 13.99, "billing_cycle": "monthly", "category": "streaming", "details": {}}, ...]. Regles pour category: streaming = Netflix Spotify Disney Canal+. telecom_mobile = forfait mobile SFR Free Orange Bouygues. telecom_box = box internet fibre Livebox Freebox Bbox. energie = EDF Engie electricite gaz. assurance = assurance habitation auto. saas = logiciel abonnement. other = reste. Ignore les achats ponctuels, retraits, virements. Ne retourne QUE les prelevements qui semblent recurrents. Si aucun prelevement recurrent trouve retourne []'

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()

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
    const result = JSON.parse(cleaned)

    return NextResponse.json({ subscriptions: Array.isArray(result) ? result : [] })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}
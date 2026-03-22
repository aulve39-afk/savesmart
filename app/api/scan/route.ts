import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PROMPT = 'Tu es un expert comptable francais. Analyse cette facture. Reponds UNIQUEMENT en JSON sans markdown. Format: {"is_invoice": true, "company_name": "Bouygues Telecom", "amount": 23.99, "billing_cycle": "monthly", "category": "telecom_box", "details": {"debit_mbps": 200, "type": "fibre"}}. IMPORTANT pour category: Si la facture mentionne BOX, FIBRE, ADSL, INTERNET, LIVEBOX, FREEBOX, BBOX = mettre telecom_box. Si la facture mentionne forfait mobile, Go, smartphone = mettre telecom_mobile. streaming = Netflix Spotify Disney+. energie = EDF electricite gaz. assurance = habitation auto. saas = logiciel. other = reste. Si pas une facture reponds {"is_invoice": false}'
export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
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

    const content = response.choices[0].message.content || '{}'
    const cleaned = content.replace(/```json|```/g, '').trim()
    const result = JSON.parse(cleaned)

    console.log('Resultat IA:', JSON.stringify(result))

    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}
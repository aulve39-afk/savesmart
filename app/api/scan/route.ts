import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      },
      `Analyse cette image de facture ou abonnement. Réponds UNIQUEMENT en JSON sans markdown :
{
  "is_invoice": true,
  "company_name": "nom du service",
  "amount": 12.99,
  "billing_cycle": "monthly",
  "category": "streaming"
}
billing_cycle doit être : monthly, yearly, quarterly ou one_time
category doit être : streaming, telecom, energie, assurance, saas ou other
Si ce n'est pas une facture, réponds uniquement: {"is_invoice": false}`,
    ])

    const text = result.response.text()
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}
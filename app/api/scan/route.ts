import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const PROMPT = `Tu es un expert juridique et comptable français spécialisé dans l'analyse de factures d'abonnements. Examine ATTENTIVEMENT cette image de facture ou relevé.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.

Format de réponse:
{"is_invoice": true, "company_name": "Bouygues Telecom", "amount": 23.99, "billing_cycle": "monthly", "category": "telecom_box", "details": {"engagement_end_date": "2026-11-15", "debit_mbps": 200, "type": "fibre", "out_of_bundle_cost": 0, "trial_end_date": null, "is_trial": false, "contract_start_date": "2024-11-15", "cancellation_notice_days": 30}}

RÈGLES pour category: telecom_box si BOX/FIBRE/ADSL/INTERNET/LIVEBOX/FREEBOX/BBOX. telecom_mobile si forfait mobile/Go/SIM/4G/5G. streaming si Netflix/Spotify/Disney+/Deezer/Apple TV+/Canal+. energie si EDF/Engie/électricité/gaz. assurance si habitation/auto/santé/mutuelle. saas si logiciel/cloud/Microsoft 365/Adobe. other sinon.

RÈGLES pour details (cherche ACTIVEMENT dans toute la facture):
- engagement_end_date: Date fin d'engagement YYYY-MM-DD. Cherche "engagement jusqu'au", "fin d'engagement", "engagement 24 mois", "sans engagement jusqu'au". Calcule depuis date début + durée si nécessaire.
- debit_mbps: Débit en Mbps (1 Gbit/s = 1000 Mbps).
- type: "fibre", "adsl", "vdsl", "cable", "4g", "5g".
- out_of_bundle_cost: Montant hors-forfait facturé ce mois (0 si aucun).
- trial_end_date: Date de fin d'essai gratuit YYYY-MM-DD si présente.
- is_trial: true si offre d'essai ou période gratuite.
- contract_start_date: Date de début de contrat YYYY-MM-DD si visible.
- cancellation_notice_days: Délai de préavis résiliation en jours si mentionné.

Si ce n'est pas une facture reconnaissable, réponds uniquement: {"is_invoice": false}`

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const { image } = await req.json()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
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

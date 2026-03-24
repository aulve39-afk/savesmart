import { NextRequest } from 'next/server'
import { checkRateLimit } from '../../../lib/rateLimit'
import Anthropic from '@anthropic-ai/sdk'

/** Strip ASCII control characters to prevent prompt injection */
function sanitize(s: string): string {
  return s.replace(/[\x00-\x1f\x7f]/g, '').trim()
}

const MAX_MSG_LEN = 1000

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const { allowed, retryAfter } = checkRateLimit(`conseiller:${ip}`, 20)
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Trop de requêtes, réessayez dans un moment' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } },
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const body = await req.json()
    const { message, subscriptions, history } = body

    if (typeof message !== 'string' || message.trim().length === 0 || message.length > MAX_MSG_LEN) {
      return new Response(JSON.stringify({ error: 'Message invalide' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    const safeMessage = sanitize(message)

    // Build subscription context
    type Sub = { company_name: string; amount: number; billing_cycle: string; category: string }
    const subs: Sub[] = Array.isArray(subscriptions) ? subscriptions : []
    const total = subs.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)

    const cycleLabel: Record<string, string> = {
      monthly: '/mois', yearly: '/an', quarterly: '/trimestre', one_time: '', unknown: '',
    }
    const subsContext = subs.length > 0
      ? subs.map(s => `- ${s.company_name} (${s.category}): ${Number(s.amount).toFixed(2)}€${cycleLabel[s.billing_cycle] ?? ''}`).join('\n')
      : 'Aucun abonnement enregistré pour l\'instant.'

    const systemPrompt = `Tu es KLYP, un conseiller financier personnel bienveillant et expert en optimisation des abonnements numériques. Tu parles français avec un ton chaleureux, direct et concret.

Abonnements de l'utilisateur (total: ${total.toFixed(2)}€/mois — ${(total * 12).toFixed(0)}€/an):
${subsContext}

Tes missions:
• Identifier les doublons, abonnements oubliés ou trop coûteux
• Suggérer des alternatives moins chères (formules famille, partage, concurrents)
• Calculer les économies potentielles avec des chiffres précis
• Expliquer comment résilier un abonnement si demandé
• Donner des conseils personnalisés basés sur la liste réelle de l'utilisateur

Style: réponses courtes et percutantes. Utilise des chiffres concrets en euros. Si l'utilisateur n'a pas encore d'abonnements, invite-le à en ajouter via l'interface.

IMPORTANT: Tu t'appelles KLYP et uniquement KLYP. Ne mentionne jamais Claude, Anthropic, ni aucune technologie sous-jacente. Si on te demande qui tu es ou comment tu fonctionnes, réponds simplement que tu es le conseiller intégré de l'application KLYP.`

    // Conversation history (cap at 10 turns to limit token usage)
    type HistoryMsg = { role: 'user' | 'assistant'; content: string }
    const validHistory: HistoryMsg[] = Array.isArray(history)
      ? history
          .filter((m: unknown): m is HistoryMsg =>
            typeof m === 'object' && m !== null &&
            (m as HistoryMsg).role === 'user' || (m as HistoryMsg).role === 'assistant' &&
            typeof (m as HistoryMsg).content === 'string'
          )
          .slice(-10)
          .map(m => ({ role: m.role, content: sanitize(m.content).slice(0, MAX_MSG_LEN) }))
      : []

    const messages: Anthropic.MessageParam[] = [
      ...validHistory,
      { role: 'user', content: safeMessage },
    ]

    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        stream.on('text', delta => {
          controller.enqueue(encoder.encode(delta))
        })
        stream.on('error', err => {
          console.error('[conseiller]', err)
          controller.close()
        })
        await stream.finalMessage()
        controller.close()
      },
      cancel() {
        stream.abort()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[conseiller]', err)
    return new Response(JSON.stringify({ error: 'Erreur du conseiller, réessayez' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

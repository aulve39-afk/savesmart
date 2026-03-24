import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '../../../lib/rateLimit'
import Anthropic from '@anthropic-ai/sdk'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Strip ASCII control characters to prevent prompt injection */
function sanitize(s: string): string {
  return s.replace(/[\x00-\x1f\x7f]/g, '').trim()
}

const MOTIF_INSTRUCTIONS: Record<string, string> = {
  libre: `L'utilisateur n'est plus engagé. La lettre doit être ferme, directe et sans appel. Citer l'article L215-1 du Code de la consommation (droit de résiliation à tout moment pour les contrats à tacite reconduction). Exiger la confirmation de résiliation sous 10 jours.`,
  engagement: `L'utilisateur est encore sous période d'engagement. La lettre doit demander explicitement le calcul exact des frais de résiliation anticipée conformément à l'article L224-28 du Code de la consommation. Mentionner que les frais ne peuvent dépasser le montant des mensualités restantes et exiger un décompte détaillé.`,
  demenagement: `Motif légitime : déménagement. En France, le déménagement est un motif légalement reconnu pour résilier sans frais (article L224-29 CPCE pour les opérateurs télécom). La lettre doit mentionner le déménagement comme motif légitime, demander la résiliation sans frais, et indiquer qu'un justificatif de domicile sera fourni sur demande.`,
  insatisfaction: `L'utilisateur résilie pour insatisfaction / qualité de service insuffisante. La lettre doit être factuelle, mentionner les manquements constatés, et invoquer la clause de résiliation pour manquement aux obligations contractuelles (articles 1217 et 1224 du Code civil). Demander un remboursement prorata si applicable.`,
  sante: `Motif légitime : raison de santé / force majeure. La lettre doit mentionner les circonstances de santé comme motif légitime imprévu (article 1218 du Code civil sur la force majeure), demander la résiliation sans frais ni pénalités, et indiquer qu'un certificat médical peut être fourni sur demande.`,
  deces: `Motif : décès du titulaire (lettre rédigée par un proche/ayant droit). La lettre doit mentionner le décès du titulaire, invoquer la fin automatique du contrat personnel en cas de décès, demander la résiliation immédiate et le remboursement de tout prélèvement postérieur au décès. Ton respectueux et formel.`,
}

const MAX_FIELD_LEN = 200

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const { allowed, retryAfter } = checkRateLimit(`resiliation:${ip}`, 10)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes, réessayez dans un moment' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const { prenom, nom, adresse, ville, service, motif, engagementEndDate } = await req.json()

    if (
      typeof prenom !== 'string' || prenom.trim().length === 0 || prenom.length > MAX_FIELD_LEN ||
      typeof nom !== 'string' || nom.trim().length === 0 || nom.length > MAX_FIELD_LEN ||
      typeof adresse !== 'string' || adresse.trim().length === 0 || adresse.length > MAX_FIELD_LEN ||
      typeof ville !== 'string' || ville.trim().length === 0 || ville.length > MAX_FIELD_LEN ||
      typeof service !== 'string' || service.trim().length === 0 || service.length > MAX_FIELD_LEN ||
      typeof motif !== 'string' || !Object.prototype.hasOwnProperty.call(MOTIF_INSTRUCTIONS, motif)
    ) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    if (
      engagementEndDate !== undefined &&
      engagementEndDate !== null &&
      engagementEndDate !== '' &&
      (typeof engagementEndDate !== 'string' || !DATE_RE.test(engagementEndDate))
    ) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    const safePrenom = sanitize(prenom)
    const safeNom = sanitize(nom)
    const safeAdresse = sanitize(adresse)
    const safeVille = sanitize(ville)
    const safeService = sanitize(service)

    const motifInstruction = MOTIF_INSTRUCTIONS[motif] || MOTIF_INSTRUCTIONS.libre
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const engagementInfo = engagementEndDate
      ? `L'utilisateur a un engagement jusqu'au ${engagementEndDate}.`
      : `Pas d'information sur une période d'engagement.`

    const prompt = `Tu es un juriste expert en droit de la consommation français. Rédige une lettre de résiliation formelle et juridiquement précise.

Expéditeur: ${safePrenom} ${safeNom}, ${safeAdresse}, ${safeVille}
Service à résilier: ${safeService}
Date: ${today}
Motif de résiliation: ${motif}
${engagementInfo}

Instructions spécifiques pour ce motif: ${motifInstruction}

Rédige la lettre complète en HTML simple (utilise <p>, <strong>, <br> uniquement). La lettre doit:
- Commencer par les coordonnées de l'expéditeur
- Inclure les coordonnées du destinataire (Service Résiliation, ${safeService})
- La date à droite
- L'objet en gras
- Corps de lettre avec les arguments juridiques appropriés
- Formule de politesse
- Signature

Réponds UNIQUEMENT avec le HTML de la lettre, sans markdown, sans explication.`

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    const letter = textBlock?.type === 'text' ? textBlock.text : ''

    return NextResponse.json({ letter })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur génération lettre' }, { status: 500 })
  }
}

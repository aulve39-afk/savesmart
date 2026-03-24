/**
 * Sanitisation centralisée — utilisée côté client ET serveur.
 *
 * Principe : on ne stocke jamais de HTML dans la DB.
 * Les données texte sont du texte brut ; React se charge de l'échappement à l'affichage.
 */

/**
 * Nettoie un champ texte libre (nom de service, prénom, etc.)
 * - Supprime les balises HTML
 * - Supprime les protocoles dangereux (javascript:, data:, vbscript:)
 * - Supprime les gestionnaires d'événements inline (onerror=, onclick=, …)
 * - Tronque à maxLength caractères
 */
export function sanitizeText(input: unknown, maxLength = 200): string {
  const s = String(input ?? '').trim()
  return s
    .replace(/<[^>]*>/g, '')                    // strip toutes les balises HTML
    .replace(/javascript\s*:/gi, '')             // strip javascript:
    .replace(/vbscript\s*:/gi, '')               // strip vbscript:
    .replace(/data\s*:/gi, '')                   // strip data: URI
    .replace(/on[a-z]+\s*=\s*["'][^"']*["']/gi, '') // strip onerror="…" onclick="…"
    .replace(/on[a-z]+\s*=\s*[^\s>]*/gi, '')    // strip onerror=… sans guillemets
    .replace(/[^\S\n]+/g, ' ')                   // normalise les espaces
    .trim()
    .slice(0, maxLength)
}

/**
 * Nettoie un montant venant de l'IA ou d'un formulaire.
 * Retourne 0 si invalide.
 */
export function sanitizeAmount(val: unknown): number {
  const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''))
  if (isNaN(n) || n <= 0) return 0
  if (n > 99999) return 99999
  return Math.round(n * 100) / 100
}

/**
 * Sanitise le HTML d'une lettre générée par IA avant dangerouslySetInnerHTML.
 * Seules les balises de mise en forme sûres sont conservées.
 * Tous les attributs sont supprimés (prévient href=javascript:, onerror=, etc.)
 */
export function sanitizeLetterHtml(html: string): string {
  const SAFE_TAGS = new Set([
    'p','br','b','strong','i','em','u','s','ul','ol','li',
    'h1','h2','h3','h4','div','span','hr','blockquote',
  ])

  return html
    // Supprimer les balises script/style/iframe et leur contenu
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    // Supprimer tous les attributs (href=, src=, onerror=, on*=, style=…)
    .replace(/<(\/?[a-z][a-z0-9]*)\s[^>]*(\/?)>/gi, (_, tag, selfClose) => {
      const t = tag.replace('/', '').toLowerCase()
      if (!SAFE_TAGS.has(t)) return ''
      return `<${tag}${selfClose}>`
    })
    // Supprimer les balises non autorisées (sans attributs, déjà filtrées)
    .replace(/<\/?([a-z][a-z0-9]*)[^>]*>/gi, (match, tag) => {
      if (SAFE_TAGS.has(tag.toLowerCase())) return match
      return ''
    })
    // Supprimer les protocoles dangereux qui auraient survécu
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
}

'use client'
import { useRouter } from 'next/navigation'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const sections = [
  {
    title: '1. Objet',
    content: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application SaveSmart. En utilisant l'application, tu acceptes les présentes conditions dans leur intégralité.`,
  },
  {
    title: '2. Description du service',
    content: `SaveSmart est un outil personnel d'aide à la gestion des abonnements récurrents. L'application permet de :
• Importer et suivre tes abonnements
• Analyser tes factures par intelligence artificielle
• Recevoir des alertes de renouvellement
• Comparer les offres et identifier des économies potentielles

SaveSmart est un outil d'aide à la décision. Les montants affichés sont informatifs et ne constituent pas un relevé bancaire officiel.`,
  },
  {
    title: '3. Accès au service',
    content: `L'application est accessible sans création de compte. Un identifiant anonyme est généré automatiquement. Tu es responsable de la sauvegarde de tes données ; la perte de l'identifiant local (effacement du navigateur ou de l'application) entraîne la perte d'accès à tes données. Aucune récupération par email n'est possible en version gratuite.`,
  },
  {
    title: '4. Utilisation acceptable',
    content: `Tu t'engages à :
• Utiliser l'application à des fins personnelles et légales uniquement
• Ne pas tenter d'accéder aux données d'autres utilisateurs
• Ne pas utiliser de moyens automatisés pour solliciter le service de façon abusive

Tout usage frauduleux ou contraire à la loi entraîne la suspension immédiate du compte.`,
  },
  {
    title: '5. Propriété intellectuelle',
    content: `L'application, son interface, ses algorithmes et son contenu sont protégés par le droit de la propriété intellectuelle. Toute reproduction, modification ou exploitation non autorisée est interdite.

Les marques tierces (Netflix, Spotify, EDF, etc.) mentionnées dans l'application à titre d'illustration appartiennent à leurs propriétaires respectifs.`,
  },
  {
    title: '6. Limitation de responsabilité',
    content: `SaveSmart ne constitue pas un conseil financier. Les économies estimées et comparaisons d'offres sont indicatives.

SaveSmart ne peut être tenu responsable de :
• Toute décision financière prise sur la base des informations affichées
• L'indisponibilité temporaire du service
• La perte de données consécutive à un effacement volontaire ou involontaire de l'appareil`,
  },
  {
    title: '7. Modification des CGU',
    content: `SaveSmart se réserve le droit de modifier les présentes CGU. Les modifications prennent effet à leur publication. L'utilisation continue de l'application après modification vaut acceptation des nouvelles conditions.`,
  },
  {
    title: '8. Droit applicable',
    content: `Les présentes CGU sont soumises au droit français. En cas de litige, les tribunaux compétents sont ceux du ressort du siège de l'éditeur, sauf disposition légale contraire.`,
  },
]

export default function CguPage() {
  const router = useRouter()

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => router.back()}
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Conditions d'utilisation</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Mise à jour le 23 mars 2026</p>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {sections.map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '18px 20px', marginBottom: '10px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 10px' }}>{s.title}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.65', whiteSpace: 'pre-line' }}>{s.content}</p>
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: '16px 0 0' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Questions ? Contacte-nous à <strong>support@savesmart.fr</strong></p>
        </div>
      </div>
    </main>
  )
}

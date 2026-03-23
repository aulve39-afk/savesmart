'use client'
import { useRouter } from 'next/navigation'

const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const sections = [
  {
    title: '1. Qui sommes-nous ?',
    content: `SaveSmart est une application mobile d'analyse et de suivi des abonnements récurrents. Éditeur : SaveSmart (contact : privacy@savesmart.fr). La présente politique décrit quelles données sont collectées, pourquoi, et comment elles sont protégées.`,
  },
  {
    title: '2. Données collectées',
    content: `Données que tu fournis :
• Nom et prénom (facultatifs, stockés uniquement sur ton appareil)
• Abonnements saisis manuellement (nom du service, montant, fréquence, catégorie)

Données générées automatiquement :
• Un identifiant anonyme (UUID) créé aléatoirement à la première ouverture — il n'est lié à aucune identité réelle
• Les factures ou relevés bancaires que tu importes sont analysés par IA puis immédiatement supprimés — ils ne sont jamais stockés sur nos serveurs

Données que nous ne collectons PAS :
• Aucun numéro de carte bancaire
• Aucun identifiant bancaire
• Aucune donnée de localisation
• Aucune donnée biométrique`,
  },
  {
    title: '3. Finalité du traitement',
    content: `Tes données sont utilisées exclusivement pour :
• Afficher et gérer ta liste d'abonnements
• Calculer ton total mensuel et annuel
• T'envoyer des alertes de renouvellement ou de fin d'essai
• Générer des recommandations d'économies

Tes données ne sont jamais utilisées à des fins publicitaires, ni vendues, ni partagées avec des tiers à des fins commerciales.`,
  },
  {
    title: '4. Hébergement et sécurité',
    content: `Tes données sont stockées sur Supabase (infrastructure AWS, serveurs en Europe — eu-west-1). Les communications sont chiffrées via TLS 1.3. La base de données est protégée par Row Level Security (RLS) : chaque utilisateur n'accède qu'à ses propres données.

L'analyse des factures est réalisée par l'API OpenAI (GPT-4 Vision). Les images sont transmises de façon sécurisée et ne sont pas conservées par OpenAI au-delà du traitement.`,
  },
  {
    title: '5. Durée de conservation',
    content: `• Tant que ton identifiant est actif dans l'application
• En cas de suppression du compte : toutes les données sont effacées de nos serveurs dans les 24 heures
• L'identifiant local est supprimé de ton appareil en même temps`,
  },
  {
    title: '6. Tes droits (RGPD)',
    content: `Conformément au Règlement Général sur la Protection des Données (RGPD), tu disposes des droits suivants :
• Droit d'accès : obtenir une copie de tes données
• Droit de rectification : corriger des informations inexactes
• Droit à l'effacement : supprimer ton compte et toutes tes données
• Droit à la portabilité : recevoir tes données dans un format structuré
• Droit d'opposition : t'opposer à certains traitements

Pour exercer ces droits : privacy@savesmart.fr — nous répondons dans les 30 jours.

Tu peux également supprimer ton compte directement depuis l'application (Mon compte → Supprimer mon compte).`,
  },
  {
    title: '7. Cookies et traceurs',
    content: `SaveSmart n'utilise pas de cookies publicitaires. Un identifiant technique anonyme est stocké dans le stockage local de ton appareil (localStorage) pour maintenir ta session. Cet identifiant ne te suit pas en dehors de l'application.`,
  },
  {
    title: '8. Modifications',
    content: `Cette politique peut être mise à jour. En cas de modification substantielle, tu seras informé lors de ton prochain accès à l'application. La date de mise à jour est indiquée en haut de cette page.`,
  },
]

export default function ConfidentialitePage() {
  const router = useRouter()

  return (
    <main style={{ fontFamily: font, maxWidth: '430px', margin: '0 auto', background: 'var(--bg)', minHeight: '100vh', paddingBottom: '40px' }}>

      <div style={{ background: 'var(--bg-card)', padding: '52px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => router.back()}
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >←</button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Politique de confidentialité</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Mise à jour le 23 mars 2026</p>
        </div>
      </div>

      {/* Bandeau récapitulatif */}
      <div style={{ margin: '16px 16px 0', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', borderRadius: '16px', padding: '16px 18px' }}>
        <p style={{ fontSize: '13px', fontWeight: '700', color: '#166534', margin: '0 0 8px' }}>🔒 Nos engagements en bref</p>
        <ul style={{ margin: '0', padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {['Tes données ne sont jamais vendues', 'Aucun numéro bancaire collecté', 'Suppression complète sur demande', 'Hébergement en Europe (RGPD)'].map(e => (
            <li key={e} style={{ fontSize: '12px', color: '#15803d', fontWeight: '500' }}>{e}</li>
          ))}
        </ul>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {sections.map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '18px 20px', marginBottom: '10px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 10px' }}>{s.title}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.65', whiteSpace: 'pre-line' }}>{s.content}</p>
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: '16px 0 0' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>Questions ? Écris-nous à <strong>privacy@savesmart.fr</strong></p>
        </div>
      </div>
    </main>
  )
}

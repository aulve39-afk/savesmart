'use client'

import { Settings, Shield, Bell, Globe, Key, ChevronRight } from 'lucide-react'

const SETTINGS_SECTIONS = [
  {
    id: 'account',
    icon: Shield,
    title: 'Sécurité & Confidentialité',
    items: [
      { label: 'Chiffrement des données', value: 'AES-256 activé', badge: 'Actif' },
      { label: 'Anonymisation PII', value: 'Avant envoi à l'IA', badge: 'Actif' },
      { label: 'Région de stockage', value: 'EU (Frankfurt)', badge: 'RGPD' },
    ],
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Alertes & Notifications',
    items: [
      { label: 'Email avant préavis', value: '30 jours avant la deadline' },
      { label: 'Rappel de renouvellement', value: '90 jours avant' },
      { label: 'Alerte critique', value: 'Immédiate (≤ 7 jours)' },
    ],
  },
  {
    id: 'api',
    icon: Key,
    title: 'Intégrations & API',
    items: [
      { label: 'Modèle IA', value: 'GPT-4o (phase dev)' },
      { label: 'Clé API', value: '•••••••••••••HUC9' },
      { label: 'Limite par contrat', value: '$0.50 max' },
    ],
  },
  {
    id: 'language',
    icon: Globe,
    title: 'Langue & Localisation',
    items: [
      { label: 'Langue d'interface', value: 'Français' },
      { label: 'Devise par défaut', value: 'Euro (€)' },
      { label: 'Format de date', value: 'JJ/MM/AAAA' },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">
          <Settings size={20} strokeWidth={2} />
          Paramètres
        </h1>
        <p className="page-sub">Configurez votre espace d'analyse contractuelle.</p>
      </div>

      <div className="sections">
        {SETTINGS_SECTIONS.map(({ id, icon: Icon, title, items }) => (
          <section key={id} className="settings-section">
            <div className="section-header">
              <Icon size={16} strokeWidth={2} className="section-icon" />
              <span className="section-title">{title}</span>
            </div>
            <div className="section-body">
              {items.map(({ label, value, badge }) => (
                <div key={label} className="setting-row">
                  <div className="setting-info">
                    <span className="setting-label">{label}</span>
                    <span className="setting-value">{value}</span>
                  </div>
                  <div className="setting-right">
                    {badge && <span className="setting-badge">{badge}</span>}
                    <ChevronRight size={14} className="setting-arrow" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="version-note">Audit Agent · v1.0.0 · Phase de développement</p>

      <style jsx>{`
        .settings-page {
          max-width: 680px;
          margin: 0 auto;
          padding: 48px 24px 64px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .page-header { display: flex; flex-direction: column; gap: 8px; }

        .page-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
        }

        .page-sub { font-size: 14px; color: #475569; margin: 0; }

        .sections { display: flex; flex-direction: column; gap: 16px; }

        .settings-section {
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 14px;
          overflow: hidden;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 14px 18px;
          border-bottom: 1px solid #1a2540;
        }

        :global(.section-icon) { color: #3b82f6; }

        .section-title {
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.2px;
        }

        .section-body { display: flex; flex-direction: column; }

        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 18px;
          border-bottom: 1px solid #0d1526;
          cursor: pointer;
          transition: background 0.12s;
        }

        .setting-row:last-child { border-bottom: none; }
        .setting-row:hover { background: #0d1526; }

        .setting-info { display: flex; flex-direction: column; gap: 2px; }

        .setting-label { font-size: 13.5px; color: #cbd5e1; }

        .setting-value { font-size: 12px; color: #475569; }

        .setting-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .setting-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 99px;
          background: rgba(34,197,94,0.1);
          color: #4ade80;
          border: 1px solid rgba(34,197,94,0.2);
        }

        :global(.setting-arrow) { color: #1e2d45; }

        .version-note {
          text-align: center;
          font-size: 11px;
          color: #1e2d45;
          margin: 0;
        }
      `}</style>
    </div>
  )
}

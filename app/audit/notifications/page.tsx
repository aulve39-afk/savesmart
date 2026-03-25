'use client'

import { Bell, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

// Données de démo — à remplacer par les vraies alertes de préavis depuis l'API
const DEMO_ALERTS = [
  {
    id: '1',
    type: 'critical' as const,
    title: 'Préavis à envoyer avant le 15 avril',
    contract: 'Contrat maintenance Siemens',
    detail: 'Délai de préavis de 3 mois — renouvellement tacite le 15 juillet',
    daysLeft: 12,
  },
  {
    id: '2',
    type: 'warning' as const,
    title: 'Hausse tarifaire automatique en mai',
    contract: 'Abonnement SaaS Salesforce',
    detail: 'Indexation +4.5% — clause §8.2 — montant estimé +€ 1 200/an',
    daysLeft: 28,
  },
  {
    id: '3',
    type: 'info' as const,
    title: 'Renouvellement dans 90 jours',
    contract: 'Bail commercial — Paris 11e',
    detail: 'Préavis de 6 mois requis. Prochaine action recommandée : mars 2026',
    daysLeft: 87,
  },
]

const TYPE_CONFIG = {
  critical: {
    icon: AlertTriangle,
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.2)',
    color: '#fca5a5',
    dot: '#ef4444',
    label: 'Critique',
  },
  warning: {
    icon: Clock,
    bg: 'rgba(234,179,8,0.06)',
    border: 'rgba(234,179,8,0.2)',
    color: '#fde047',
    dot: '#eab308',
    label: 'Attention',
  },
  info: {
    icon: CheckCircle2,
    bg: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.18)',
    color: '#93c5fd',
    dot: '#3b82f6',
    label: 'Info',
  },
}

export default function NotificationsPage() {
  return (
    <div className="notifications-page">
      <div className="page-header">
        <h1 className="page-title">
          <Bell size={20} strokeWidth={2} />
          Alertes & Préavis
        </h1>
        <p className="page-sub">
          Toutes les échéances contractuelles détectées par l'IA, triées par urgence.
        </p>
      </div>

      <div className="alerts-list">
        {DEMO_ALERTS.map((alert) => {
          const cfg = TYPE_CONFIG[alert.type]
          const Icon = cfg.icon
          return (
            <div
              key={alert.id}
              className="alert-card"
              style={{ background: cfg.bg, borderColor: cfg.border }}
            >
              <div className="alert-icon-wrap" style={{ color: cfg.color }}>
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="alert-body">
                <div className="alert-meta">
                  <span className="alert-badge" style={{ color: cfg.color, borderColor: cfg.border }}>
                    <span className="alert-dot" style={{ background: cfg.dot }} />
                    {cfg.label}
                  </span>
                  <span className="alert-days" style={{ color: cfg.color }}>
                    J-{alert.daysLeft}
                  </span>
                </div>
                <p className="alert-title">{alert.title}</p>
                <p className="alert-contract">{alert.contract}</p>
                <p className="alert-detail">{alert.detail}</p>
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .notifications-page {
          max-width: 680px;
          margin: 0 auto;
          padding: 48px 24px 64px;
          display: flex;
          flex-direction: column;
          gap: 32px;
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

        .alerts-list { display: flex; flex-direction: column; gap: 12px; }

        .alert-card {
          display: flex;
          gap: 16px;
          border: 1px solid;
          border-radius: 14px;
          padding: 18px;
        }

        .alert-icon-wrap {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .alert-body { flex: 1; min-width: 0; }

        .alert-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .alert-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 99px;
          border: 1px solid;
          background: rgba(255,255,255,0.04);
        }

        .alert-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .alert-days {
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .alert-title {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0 0 3px;
        }

        .alert-contract {
          font-size: 12px;
          color: #64748b;
          margin: 0 0 6px;
          font-style: italic;
        }

        .alert-detail {
          font-size: 12px;
          color: #475569;
          margin: 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  Filter,
  Search,
  FileText,
  ArrowRight,
  Euro,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

// ── Mock data ─────────────────────────────────────────────────────────────────

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type ContractStatus = 'active' | 'expiring' | 'expired'

interface Contract {
  id: string
  name: string
  supplier: string
  type: string
  endDate: string
  noticeDays: number
  noticeDeadlineDays: number // days until notice deadline
  riskLevel: RiskLevel
  annualAmount: number
  status: ContractStatus
  autoRenewal: boolean
  priceEscalation: boolean
  flags: string[]
}

const CONTRACTS: Contract[] = [
  {
    id: 'c1',
    name: 'Bail commercial Bureau Paris 8e',
    supplier: 'Foncière SCI Haussmann',
    type: 'Bail',
    endDate: '2025-09-30',
    noticeDays: 180,
    noticeDeadlineDays: 12,
    riskLevel: 'CRITICAL',
    annualAmount: 84000,
    status: 'expiring',
    autoRenewal: true,
    priceEscalation: true,
    flags: ['Délai préavis 180j', 'Indexation ILAT +3.8%/an', 'Renouvellement tacite'],
  },
  {
    id: 'c2',
    name: 'Contrat SaaS Salesforce CRM',
    supplier: 'Salesforce Inc.',
    type: 'SaaS',
    endDate: '2025-07-15',
    noticeDays: 90,
    noticeDeadlineDays: 28,
    riskLevel: 'HIGH',
    annualAmount: 36000,
    status: 'expiring',
    autoRenewal: true,
    priceEscalation: true,
    flags: ['Hausse +15% an 3', 'Résiliation 90j', 'Auto-renewal'],
  },
  {
    id: 'c3',
    name: 'Maintenance photocopieurs Xerox',
    supplier: 'Xerox France SAS',
    type: 'Maintenance',
    endDate: '2025-11-30',
    noticeDays: 60,
    noticeDeadlineDays: 65,
    riskLevel: 'MEDIUM',
    annualAmount: 8400,
    status: 'active',
    autoRenewal: true,
    priceEscalation: false,
    flags: ['Clause de révision prix', 'Pénalité 3 mois'],
  },
  {
    id: 'c4',
    name: 'Abonnement Microsoft 365 Business',
    supplier: 'Microsoft France',
    type: 'SaaS',
    endDate: '2026-01-31',
    noticeDays: 30,
    noticeDeadlineDays: 120,
    riskLevel: 'LOW',
    annualAmount: 12000,
    status: 'active',
    autoRenewal: false,
    priceEscalation: false,
    flags: [],
  },
  {
    id: 'c5',
    name: 'Nettoyage bureaux ISSA Services',
    supplier: 'ISSA Services',
    type: 'Prestation',
    endDate: '2025-06-30',
    noticeDays: 30,
    noticeDeadlineDays: -4,
    riskLevel: 'CRITICAL',
    annualAmount: 18000,
    status: 'expired',
    autoRenewal: true,
    priceEscalation: true,
    flags: ['EXPIRED — préavis manqué', 'Reconduction tacite active', 'Hausse +5%/an'],
  },
  {
    id: 'c6',
    name: 'Assurance multirisques professionnelle',
    supplier: 'AXA Entreprises',
    type: 'Assurance',
    endDate: '2026-03-15',
    noticeDays: 60,
    noticeDeadlineDays: 180,
    riskLevel: 'LOW',
    annualAmount: 6200,
    status: 'active',
    autoRenewal: false,
    priceEscalation: false,
    flags: [],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Critique' },
  HIGH: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', label: 'Élevé' },
  MEDIUM: { color: '#eab308', bg: 'rgba(234,179,8,0.1)', label: 'Moyen' },
  LOW: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Faible' },
}

function formatEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
}

function NoticeCountdown({ days }: { days: number }) {
  if (days < 0) return <span className="countdown expired">Expiré</span>
  if (days === 0) return <span className="countdown today">Aujourd'hui !</span>
  if (days <= 14) return <span className="countdown critical">{days}j</span>
  if (days <= 30) return <span className="countdown warning">{days}j</span>
  if (days <= 60) return <span className="countdown caution">{days}j</span>
  return <span className="countdown ok">{days}j</span>
}

// ── Stats cards (Bento) ───────────────────────────────────────────────────────

function BentoStats({ contracts }: { contracts: Contract[] }) {
  const total = contracts.length
  const critical = contracts.filter(c => c.riskLevel === 'CRITICAL').length
  const expiring30 = contracts.filter(c => c.noticeDeadlineDays >= 0 && c.noticeDeadlineDays <= 30).length
  const totalExposure = contracts.filter(c => ['CRITICAL', 'HIGH'].includes(c.riskLevel))
    .reduce((s, c) => s + c.annualAmount, 0)

  return (
    <div className="bento-grid">
      <div className="bento-card bento-large">
        <div className="bento-icon-wrap critical">
          <AlertTriangle size={20} />
        </div>
        <p className="bento-value">{critical}</p>
        <p className="bento-label">Contrats critiques</p>
        <p className="bento-sub">Action immédiate requise</p>
      </div>

      <div className="bento-card">
        <div className="bento-icon-wrap warning">
          <Clock size={18} />
        </div>
        <p className="bento-value">{expiring30}</p>
        <p className="bento-label">Préavis &lt; 30j</p>
      </div>

      <div className="bento-card">
        <div className="bento-icon-wrap blue">
          <FileText size={18} />
        </div>
        <p className="bento-value">{total}</p>
        <p className="bento-label">Contrats actifs</p>
      </div>

      <div className="bento-card bento-wide">
        <div className="bento-icon-wrap green">
          <Euro size={18} />
        </div>
        <p className="bento-value">{formatEur(totalExposure)}</p>
        <p className="bento-label">Exposition annuelle à risque</p>
        <p className="bento-sub">Contrats critiques + élevés</p>
      </div>

      <div className="bento-card">
        <div className="bento-icon-wrap purple">
          <TrendingUp size={18} />
        </div>
        <p className="bento-value">{contracts.filter(c => c.priceEscalation).length}</p>
        <p className="bento-label">Hausses auto</p>
      </div>

      <div className="bento-card">
        <div className="bento-icon-wrap teal">
          <CheckCircle2 size={18} />
        </div>
        <p className="bento-value">{contracts.filter(c => c.riskLevel === 'LOW').length}</p>
        <p className="bento-label">Sans risque</p>
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

type SortField = 'name' | 'endDate' | 'noticeDeadlineDays' | 'riskLevel' | 'annualAmount'

export default function DashboardPage() {
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'ALL'>('ALL')
  const [filterExpiring, setFilterExpiring] = useState(false)
  const [filterPriceHike, setFilterPriceHike] = useState(false)
  const [sortField, setSortField] = useState<SortField>('noticeDeadlineDays')
  const [sortAsc, setSortAsc] = useState(true)

  const filtered = CONTRACTS
    .filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
          !c.supplier.toLowerCase().includes(search.toLowerCase())) return false
      if (filterRisk !== 'ALL' && c.riskLevel !== filterRisk) return false
      if (filterExpiring && c.noticeDeadlineDays > 30) return false
      if (filterPriceHike && !c.priceEscalation) return false
      return true
    })
    .sort((a, b) => {
      let va: number | string = a[sortField]
      let vb: number | string = b[sortField]
      if (sortField === 'riskLevel') {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
        va = order[a.riskLevel]
        vb = order[b.riskLevel]
      }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="sort-icon dim">↕</span>
    return sortAsc
      ? <ChevronUp size={12} className="sort-icon active" />
      : <ChevronDown size={12} className="sort-icon active" />
  }

  return (
    <div className="dashboard-page">
      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Inventaire des contrats</h1>
          <p className="dash-sub">{CONTRACTS.length} contrats · {CONTRACTS.filter(c => c.riskLevel === 'CRITICAL').length} alertes critiques</p>
        </div>
        <Link href="/audit" className="dash-cta">
          <FileText size={15} />
          Analyser un contrat
        </Link>
      </div>

      {/* ── Bento Grid ── */}
      <BentoStats contracts={CONTRACTS} />

      {/* ── Filters ── */}
      <div className="filters-row">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Rechercher un contrat ou fournisseur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-chips">
          <Filter size={13} className="filter-label-icon" />
          <button
            className={`chip${filterExpiring ? ' active' : ''}`}
            onClick={() => setFilterExpiring(!filterExpiring)}
          >
            Préavis &lt; 30j
          </button>
          <button
            className={`chip${filterPriceHike ? ' active' : ''}`}
            onClick={() => setFilterPriceHike(!filterPriceHike)}
          >
            Hausses automatiques
          </button>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(r => (
            <button
              key={r}
              className={`chip${filterRisk === r ? ' active' : ''}`}
              onClick={() => setFilterRisk(r)}
            >
              {r === 'ALL' ? 'Tous les risques' : RISK_CONFIG[r].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-wrap">
        <table className="contract-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('name')} className="th-sort">
                Contrat <SortIcon field="name" />
              </th>
              <th>Fournisseur</th>
              <th onClick={() => toggleSort('endDate')} className="th-sort">
                Fin de contrat <SortIcon field="endDate" />
              </th>
              <th onClick={() => toggleSort('noticeDeadlineDays')} className="th-sort">
                Délai préavis <SortIcon field="noticeDeadlineDays" />
              </th>
              <th onClick={() => toggleSort('riskLevel')} className="th-sort">
                Risque <SortIcon field="riskLevel" />
              </th>
              <th onClick={() => toggleSort('annualAmount')} className="th-sort">
                Montant/an <SortIcon field="annualAmount" />
              </th>
              <th>Flags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const risk = RISK_CONFIG[c.riskLevel]
              return (
                <tr key={c.id} className={`contract-row${c.riskLevel === 'CRITICAL' ? ' row-critical' : ''}`}>
                  <td>
                    <div className="contract-name-cell">
                      <div className="contract-type-badge">{c.type}</div>
                      <span className="contract-name">{c.name}</span>
                    </div>
                  </td>
                  <td className="td-secondary">{c.supplier}</td>
                  <td className="td-date">{formatDate(c.endDate)}</td>
                  <td>
                    <NoticeCountdown days={c.noticeDeadlineDays} />
                  </td>
                  <td>
                    <span
                      className="risk-badge"
                      style={{ color: risk.color, background: risk.bg }}
                    >
                      {risk.label}
                    </span>
                  </td>
                  <td className="td-amount">{formatEur(c.annualAmount)}</td>
                  <td>
                    <div className="flags-cell">
                      {c.autoRenewal && <span className="flag flag-renewal">Tacite</span>}
                      {c.priceEscalation && <span className="flag flag-price">+prix</span>}
                    </div>
                  </td>
                  <td>
                    <Link href={`/audit/analyse/${c.id}`} className="row-action">
                      Voir <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="table-empty">Aucun contrat ne correspond à ces filtres.</div>
        )}
      </div>

      <style jsx>{`
        .dashboard-page {
          padding: 36px 32px 64px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Header ── */
        .dash-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .dash-title {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -0.4px;
          margin-bottom: 4px;
        }

        .dash-sub { font-size: 13px; color: #475569; }

        .dash-cta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 16px;
          background: #3b82f6;
          color: white;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s;
        }

        .dash-cta:hover { background: #2563eb; }

        /* ── Bento ── */
        .bento-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: auto auto;
          gap: 12px;
        }

        .bento-card {
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 14px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .bento-large { grid-column: span 1; grid-row: span 1; }
        .bento-wide { grid-column: span 2; }

        .bento-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

        .bento-icon-wrap.critical { background: rgba(239,68,68,0.12); color: #ef4444; }
        .bento-icon-wrap.warning { background: rgba(234,179,8,0.12); color: #eab308; }
        .bento-icon-wrap.blue { background: rgba(59,130,246,0.12); color: #60a5fa; }
        .bento-icon-wrap.green { background: rgba(34,197,94,0.12); color: #22c55e; }
        .bento-icon-wrap.purple { background: rgba(168,85,247,0.12); color: #a78bfa; }
        .bento-icon-wrap.teal { background: rgba(20,184,166,0.12); color: #2dd4bf; }

        .bento-value {
          font-size: 26px;
          font-weight: 800;
          color: #f1f5f9;
          letter-spacing: -0.8px;
          line-height: 1;
        }

        .bento-label { font-size: 13px; color: #64748b; font-weight: 500; }
        .bento-sub { font-size: 11px; color: #334155; }

        /* ── Filters ── */
        .filters-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .search-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #334155;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 9px 12px 9px 34px;
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }

        .search-input::placeholder { color: #334155; }
        .search-input:focus { border-color: #3b82f6; }

        .filter-chips {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .filter-label-icon { color: #334155; }

        .chip {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          background: #0a0f1e;
          border: 1px solid #1a2540;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .chip:hover { border-color: #2d3f60; color: #94a3b8; }
        .chip.active { background: rgba(59,130,246,0.1); border-color: #3b82f6; color: #60a5fa; }

        /* ── Table ── */
        .table-wrap {
          background: #0a0f1e;
          border: 1px solid #1a2540;
          border-radius: 14px;
          overflow: hidden;
        }

        .contract-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .contract-table thead tr {
          background: #0d1526;
          border-bottom: 1px solid #1a2540;
        }

        .contract-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          white-space: nowrap;
          user-select: none;
        }

        .th-sort { cursor: pointer; }
        .th-sort:hover { color: #64748b; }

        :global(.sort-icon) { display: inline-block; margin-left: 4px; }
        :global(.sort-icon.dim) { color: #1e2d45; }
        :global(.sort-icon.active) { color: #60a5fa; }

        .contract-table tbody tr {
          border-bottom: 1px solid #111827;
          transition: background 0.12s;
        }

        .contract-table tbody tr:last-child { border-bottom: none; }
        .contract-table tbody tr:hover { background: #0d1526; }

        .row-critical { border-left: 2px solid rgba(239,68,68,0.4); }

        .contract-table td { padding: 14px 16px; vertical-align: middle; }

        .contract-name-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .contract-type-badge {
          display: inline-block;
          padding: 2px 7px;
          background: #111827;
          border: 1px solid #1a2540;
          border-radius: 4px;
          font-size: 10px;
          color: #475569;
          width: fit-content;
        }

        .contract-name {
          color: #e2e8f0;
          font-weight: 500;
          max-width: 200px;
          line-height: 1.4;
        }

        .td-secondary { color: #475569; }
        .td-date { color: #64748b; white-space: nowrap; }
        .td-amount { color: #94a3b8; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }

        /* Countdown */
        :global(.countdown) {
          display: inline-block;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        :global(.countdown.expired) { background: rgba(239,68,68,0.15); color: #ef4444; }
        :global(.countdown.today) { background: rgba(239,68,68,0.2); color: #ef4444; animation: pulse 1s infinite; }
        :global(.countdown.critical) { background: rgba(239,68,68,0.1); color: #fca5a5; }
        :global(.countdown.warning) { background: rgba(249,115,22,0.1); color: #fb923c; }
        :global(.countdown.caution) { background: rgba(234,179,8,0.1); color: #facc15; }
        :global(.countdown.ok) { background: rgba(34,197,94,0.07); color: #4ade80; }

        .risk-badge {
          display: inline-block;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .flags-cell { display: flex; gap: 4px; flex-wrap: wrap; }

        .flag {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
        }

        .flag-renewal { background: rgba(168,85,247,0.1); color: #c084fc; }
        .flag-price { background: rgba(249,115,22,0.1); color: #fb923c; }

        .row-action {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: #111827;
          border: 1px solid #1a2540;
          border-radius: 7px;
          font-size: 12px;
          color: #64748b;
          text-decoration: none;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .row-action:hover { border-color: #3b82f6; color: #60a5fa; background: rgba(59,130,246,0.06); }

        .table-empty {
          padding: 48px;
          text-align: center;
          color: #334155;
          font-size: 14px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

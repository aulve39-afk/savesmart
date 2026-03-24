'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Bell,
  Settings,
  Shield,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

const NAV = [
  { href: '/audit', label: 'Upload', icon: Sparkles, exact: true },
  { href: '/audit/dashboard', label: 'Contrats', icon: LayoutDashboard },
  { href: '/audit/notifications', label: 'Alertes', icon: Bell, badge: 3 },
  { href: '/audit/settings', label: 'Paramètres', icon: Settings },
]

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="audit-shell">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="audit-sidebar">
        {/* Logo */}
        <div className="audit-logo">
          <div className="audit-logo-icon">
            <Shield size={18} strokeWidth={2.5} />
          </div>
          <div>
            <span className="audit-logo-name">Audit<span className="audit-logo-accent">AI</span></span>
            <span className="audit-logo-tagline">Contrats intelligents</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="audit-nav">
          {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={`audit-nav-item${active ? ' active' : ''}`}>
                <Icon size={18} />
                <span>{label}</span>
                {badge ? <span className="audit-nav-badge">{badge}</span> : null}
                {active && <ChevronRight size={14} className="audit-nav-arrow" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="audit-sidebar-footer">
          <div className="audit-plan-pill">
            <span className="audit-plan-dot" />
            Plan Pro · 8/10 analyses
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="audit-main">
        {children}
      </main>

      <style jsx>{`
        .audit-shell {
          display: flex;
          min-height: 100vh;
          background: #060a14;
          color: #e2e8f0;
          font-family: var(--font-geist-sans, system-ui, sans-serif);
        }

        /* ── Sidebar ── */
        .audit-sidebar {
          width: 220px;
          flex-shrink: 0;
          background: #0a0f1e;
          border-right: 1px solid #1a2540;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .audit-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 4px 28px;
          border-bottom: 1px solid #1a2540;
          margin-bottom: 20px;
        }

        .audit-logo-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .audit-logo-name {
          display: block;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.3px;
          color: #f1f5f9;
        }

        .audit-logo-accent {
          color: #60a5fa;
        }

        .audit-logo-tagline {
          display: block;
          font-size: 10px;
          color: #475569;
          margin-top: 1px;
        }

        .audit-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .audit-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13.5px;
          color: #64748b;
          text-decoration: none;
          transition: all 0.15s;
          position: relative;
        }

        .audit-nav-item:hover {
          background: #111827;
          color: #94a3b8;
        }

        .audit-nav-item.active {
          background: rgba(59, 130, 246, 0.12);
          color: #60a5fa;
          font-weight: 500;
        }

        .audit-nav-badge {
          margin-left: auto;
          background: #ef4444;
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: 99px;
          padding: 1px 6px;
          min-width: 18px;
          text-align: center;
        }

        .audit-nav-arrow {
          margin-left: auto;
          opacity: 0.5;
        }

        .audit-sidebar-footer {
          padding-top: 16px;
          border-top: 1px solid #1a2540;
        }

        .audit-plan-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: #475569;
          padding: 8px 12px;
          background: #0d1526;
          border-radius: 8px;
          border: 1px solid #1a2540;
        }

        .audit-plan-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
        }

        /* ── Main ── */
        .audit-main {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
        }
      `}</style>
    </div>
  )
}

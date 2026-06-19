'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

const navItems = [
  { label: '적재 현황', href: '/ingest' },
  { label: '임베딩 팩터', href: '/vectors' },
  { label: '매칭 시뮬레이터', href: '/simulator' },
  { label: '배차 로직', href: '/dispatch-logic' },
] as const

export function PrimaryNav({
  active,
  title = 'KONAMOBILITY',
  subtitle = 'AI DISPATCH',
  rightSlot,
}: {
  active: string
  title?: string
  subtitle?: string
  rightSlot?: ReactNode
}) {
  return (
    <header className="nav">
      <div className="inner">
        <Link href="/ingest" className="brand" aria-label="적재 현황으로 이동">
          <span className="mark" aria-hidden>
            KM
          </span>
          <span className="brandText">
            <b>{title}</b>
            <em>{subtitle}</em>
          </span>
        </Link>

        <nav aria-label="주요 화면">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.href === active ? 'tab on' : 'tab'}
              aria-current={item.href === active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="right">{rightSlot}</div>
      </div>

      <style jsx>{`
        .nav {
          position: sticky;
          top: 0;
          z-index: 140;
          border-bottom: 1px solid var(--line);
          background: color-mix(in srgb, var(--bg-0) 86%, transparent);
          backdrop-filter: blur(16px) saturate(145%);
        }
        .inner {
          max-width: var(--maxw);
          margin: 0 auto;
          min-height: var(--nav-h);
          padding: 10px clamp(16px, 2vw, 28px);
          display: grid;
          grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr);
          align-items: center;
          gap: 18px;
        }
        .brand {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          justify-self: start;
        }
        .mark {
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: var(--accent);
          background: var(--accent-soft);
          border: 1px solid var(--accent-line);
          box-shadow: 0 0 22px rgba(56, 189, 248, 0.12);
        }
        .brandText {
          min-width: 0;
          display: grid;
          gap: 2px;
          line-height: 1.08;
        }
        .brandText b {
          font-size: 17px;
          font-weight: 850;
          letter-spacing: -0.02em;
          color: var(--ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brandText em {
          font-size: 11px;
          font-style: normal;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        nav {
          justify-self: center;
          display: inline-flex;
          gap: 4px;
          padding: 4px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
        }
        .tab {
          display: inline-grid;
          place-items: center;
          height: 40px;
          padding: 0 18px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 750;
          letter-spacing: -0.02em;
          color: var(--ink-3);
          white-space: nowrap;
          transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
        }
        .tab:hover {
          color: var(--ink);
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-1px);
        }
        .tab.on {
          color: var(--accent);
          background: var(--accent-soft);
          box-shadow: inset 0 0 0 1px var(--accent-line), 0 0 24px rgba(56, 189, 248, 0.12);
        }
        .right {
          justify-self: end;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        @media (max-width: 1080px) {
          .inner {
            grid-template-columns: 1fr auto;
            grid-auto-rows: auto;
            gap: 10px;
          }
          nav {
            grid-column: 1 / -1;
            justify-self: stretch;
            justify-content: space-between;
            overflow-x: auto;
          }
          .tab {
            flex: 1;
            min-width: max-content;
            padding: 0 14px;
          }
          .right {
            grid-row: 1;
            grid-column: 2;
          }
        }
      `}</style>
    </header>
  )
}

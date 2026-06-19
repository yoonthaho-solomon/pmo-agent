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
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(5, 8, 14, 0.88);
          backdrop-filter: blur(18px) saturate(150%);
        }
        .inner {
          max-width: var(--maxw);
          min-height: 78px;
          margin: 0 auto;
          padding: 12px clamp(18px, 2vw, 30px);
          display: grid;
          grid-template-columns: minmax(230px, 1fr) auto minmax(230px, 1fr);
          align-items: center;
          gap: 22px;
        }
        .brand {
          min-width: 0;
          justify-self: start;
          display: inline-flex;
          align-items: center;
          gap: 13px;
        }
        .mark {
          width: 40px;
          height: 40px;
          flex: 0 0 auto;
          border-radius: 13px;
          display: grid;
          place-items: center;
          color: #06111f;
          background: linear-gradient(135deg, #7dd3fc, #8b5cf6);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 0 34px rgba(56, 189, 248, 0.22);
          font-size: 14px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }
        .brandText {
          min-width: 0;
          display: grid;
          gap: 2px;
          line-height: 1.05;
        }
        .brandText b {
          color: var(--ink);
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brandText em {
          color: var(--accent);
          font-size: 12px;
          font-style: normal;
          font-weight: 850;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        nav {
          justify-self: center;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 7px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 999px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018)),
            rgba(3, 6, 12, 0.72);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 60px rgba(0,0,0,0.24);
        }
        .tab {
          display: inline-grid;
          place-items: center;
          min-width: 116px;
          height: 44px;
          padding: 0 20px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 999px;
          color: rgba(231, 235, 242, 0.76);
          background: rgba(15, 23, 42, 0.62);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.035em;
          white-space: nowrap;
          transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease, box-shadow 150ms ease;
        }
        .tab:hover {
          color: #ffffff;
          border-color: rgba(125, 211, 252, 0.48);
          background: rgba(15, 23, 42, 0.92);
          transform: translateY(-1px);
          box-shadow: 0 0 22px rgba(56, 189, 248, 0.12);
        }
        .tab.on {
          color: #06111f;
          border-color: rgba(125, 211, 252, 0.9);
          background: linear-gradient(135deg, #7dd3fc, #34d399);
          box-shadow: 0 0 30px rgba(56, 189, 248, 0.26), inset 0 1px 0 rgba(255,255,255,0.35);
        }
        .right {
          justify-self: end;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        @media (max-width: 1180px) {
          .inner {
            grid-template-columns: 1fr auto;
            grid-auto-rows: auto;
            gap: 12px;
          }
          nav {
            grid-column: 1 / -1;
            justify-self: stretch;
            overflow-x: auto;
            justify-content: flex-start;
            border-radius: 20px;
          }
          .tab {
            min-width: max-content;
            flex: 1 0 auto;
          }
          .right {
            grid-row: 1;
            grid-column: 2;
          }
        }
        @media (max-width: 680px) {
          .brandText b {
            font-size: 18px;
          }
          .tab {
            height: 42px;
            padding: 0 16px;
            font-size: 15px;
          }
        }
      `}</style>
    </header>
  )
}

'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

const navItems = [
  { label: '적재현황', href: '/ingest', tone: '#10B981' },
  { label: '팩터리스트', href: '/vectors', tone: '#22D3EE' },
  { label: '시뮬레이터', href: '/simulator', tone: '#8B5CF6' },
  { label: '배차로직', href: '/dispatch-logic', tone: '#FB923C' },
] as const

export function PrimaryNav({
  active,
  title = 'Happycall PMO',
  subtitle = 'AI 우선배차',
  rightSlot,
}: {
  active: string
  title?: string
  subtitle?: string
  rightSlot?: ReactNode
}) {
  return (
    <header className="primary-nav">
      <Link href="/ingest" className="brand" aria-label="적재현황으로 이동">
        <span className="mark">PM</span>
        <span className="brand-text">
          <b>{title}</b>
          <em>{subtitle}</em>
        </span>
      </Link>

      <nav aria-label="주요 화면">
        {navItems.map((item) => {
          const isActive = item.href === active
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? 'active' : ''}
              style={{ '--tone': item.tone } as CSSProperties}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="right-slot">{rightSlot}</div>

      <style jsx>{`
        .primary-nav {
          position: sticky;
          top: 0;
          z-index: 120;
          min-height: 76px;
          display: grid;
          grid-template-columns: minmax(280px, 1fr) auto minmax(240px, 1fr);
          align-items: center;
          gap: 18px;
          padding: 0 clamp(18px, 2.4vw, 36px);
          border-bottom: 1px solid rgba(103,232,249,.24);
          background: linear-gradient(90deg, rgba(4,7,16,.96), rgba(10,16,32,.94), rgba(4,7,16,.96));
          backdrop-filter: blur(18px);
          box-shadow: 0 22px 70px rgba(0,0,0,.38), inset 0 -1px 0 rgba(255,255,255,.04);
        }
        .brand {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: #F5F7FB;
          text-decoration: none;
        }
        .mark {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          color: #06101B;
          background: linear-gradient(135deg, #22D3EE, #8B5CF6);
          font-size: 16px;
          font-weight: 950;
          box-shadow: 0 0 26px rgba(34,211,238,.28);
        }
        .brand-text {
          min-width: 0;
          display: grid;
          gap: 2px;
        }
        .brand-text b {
          color: #F5F7FB;
          font-size: clamp(18px, 1.25vw, 22px);
          line-height: 1.05;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brand-text em {
          color: #22D3EE;
          font-size: clamp(13px, .9vw, 15px);
          line-height: 1.15;
          font-style: normal;
          font-weight: 900;
        }
        nav {
          display: grid;
          grid-template-columns: repeat(4, minmax(118px, 1fr));
          gap: 10px;
          justify-self: center;
        }
        nav a {
          height: 50px;
          min-width: 132px;
          display: grid;
          place-items: center;
          border: 1px solid #22314F;
          border-radius: 16px;
          color: #AAB7CB;
          background: linear-gradient(180deg, rgba(22,32,58,.82), rgba(10,15,29,.82));
          text-decoration: none;
          font-size: clamp(16px, 1vw, 19px);
          font-weight: 950;
          letter-spacing: 0;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease;
        }
        nav a:hover,
        nav a.active {
          transform: translateY(-1px);
          color: #F5F7FB;
          border-color: var(--tone);
          background: linear-gradient(180deg, color-mix(in srgb, var(--tone) 26%, rgba(22,32,58,.9)), rgba(8,13,26,.92));
          box-shadow: 0 0 28px color-mix(in srgb, var(--tone) 28%, transparent);
        }
        .right-slot {
          justify-self: end;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          min-width: 0;
        }
        .right-slot :global(button) {
          min-height: 50px;
          padding: 0 22px;
          border: 0;
          border-radius: 14px;
          color: #06101B;
          background: linear-gradient(135deg, #67E8F9, #8B5CF6);
          box-shadow: 0 18px 42px rgba(34,211,238,.24);
          font-size: clamp(16px, 1vw, 19px);
          font-weight: 950;
          cursor: pointer;
        }
        .right-slot :global(button:disabled) {
          opacity: .55;
          cursor: wait;
        }
        .right-slot :global(a),
        .right-slot :global(span) {
          min-height: 44px;
          border-radius: 16px;
          font-size: clamp(13px, .9vw, 15px);
          font-weight: 950;
        }
        @media (max-width: 1120px) {
          .primary-nav {
            grid-template-columns: 1fr;
            align-items: stretch;
            padding-top: 14px;
            padding-bottom: 14px;
          }
          nav {
            justify-self: stretch;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          nav a {
            min-width: 0;
          }
          .right-slot {
            justify-self: stretch;
            justify-content: flex-start;
          }
        }
        @media (max-width: 680px) {
          nav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </header>
  )
}
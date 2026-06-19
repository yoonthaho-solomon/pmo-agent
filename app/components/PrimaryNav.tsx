'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

const navItems = [
  { label: '데이터 현황', href: '/ingest', tone: '#10B981' },
  { label: '임베딩 팩터', href: '/vectors', tone: '#22D3EE' },
  { label: '매칭 시뮬레이터', href: '/simulator', tone: '#8B5CF6' },
] as const

export function PrimaryNav({
  active,
  title = 'Happycall PMO',
  subtitle = 'AI Dispatch Workbench',
  rightSlot,
}: {
  active: string
  title?: string
  subtitle?: string
  rightSlot?: ReactNode
}) {
  return (
    <header className="primary-nav">
      <Link href="/ingest" className="brand" aria-label="데이터 현황으로 이동">
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
          z-index: 140;
          min-height: 84px;
          display: grid;
          grid-template-columns: minmax(300px, 1fr) auto minmax(260px, 1fr);
          align-items: center;
          gap: 20px;
          padding: 0 clamp(20px, 2.4vw, 40px);
          border-bottom: 1px solid rgba(103,232,249,.24);
          background: linear-gradient(90deg, rgba(4,7,16,.98), rgba(10,16,32,.96), rgba(4,7,16,.98));
          backdrop-filter: blur(18px);
          box-shadow: 0 22px 70px rgba(0,0,0,.38), inset 0 -1px 0 rgba(255,255,255,.04);
        }
        .brand {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 14px;
          color: #F5F7FB;
          text-decoration: none;
        }
        .mark {
          width: 48px;
          height: 48px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          color: #06101B;
          background: linear-gradient(135deg, #22D3EE, #8B5CF6);
          font-size: 17px;
          font-weight: 950;
          box-shadow: 0 0 30px rgba(34,211,238,.32);
        }
        .brand-text {
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        .brand-text b {
          color: #F5F7FB;
          font-size: clamp(21px, 1.35vw, 27px);
          line-height: 1.05;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brand-text em {
          color: #67E8F9;
          font-size: clamp(14px, .95vw, 17px);
          line-height: 1.15;
          font-style: normal;
          font-weight: 900;
        }
        nav {
          display: grid;
          grid-template-columns: repeat(3, minmax(150px, 1fr));
          gap: 12px;
          justify-self: center;
        }
        nav a {
          height: 54px;
          min-width: 160px;
          display: grid;
          place-items: center;
          border: 1px solid #22314F;
          border-radius: 18px;
          color: #AAB7CB;
          background: linear-gradient(180deg, rgba(22,32,58,.82), rgba(10,15,29,.82));
          text-decoration: none;
          font-size: clamp(18px, 1.05vw, 22px);
          font-weight: 950;
          letter-spacing: 0;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease, box-shadow 160ms ease;
        }
        nav a:hover,
        nav a.active {
          transform: translateY(-1px);
          color: #F5F7FB;
          border-color: var(--tone);
          background: linear-gradient(180deg, color-mix(in srgb, var(--tone) 26%, rgba(22,32,58,.9)), rgba(8,13,26,.92));
          box-shadow: 0 0 32px color-mix(in srgb, var(--tone) 28%, transparent);
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
          min-height: 52px;
          padding: 0 24px;
          border: 0;
          border-radius: 16px;
          color: #06101B;
          background: linear-gradient(135deg, #67E8F9, #8B5CF6);
          box-shadow: 0 18px 42px rgba(34,211,238,.24);
          font-size: clamp(17px, 1vw, 20px);
          font-weight: 950;
          cursor: pointer;
          transition: transform 160ms ease, filter 160ms ease;
        }
        .right-slot :global(button:active) {
          transform: scale(.96);
        }
        .right-slot :global(button:disabled) {
          opacity: .55;
          cursor: wait;
        }
        .right-slot :global(a),
        .right-slot :global(span) {
          min-height: 46px;
          border-radius: 16px;
          font-size: clamp(14px, .9vw, 16px);
          font-weight: 950;
        }
        @media (max-width: 1180px) {
          .primary-nav {
            grid-template-columns: 1fr;
            align-items: stretch;
            padding-top: 14px;
            padding-bottom: 14px;
          }
          nav {
            justify-self: stretch;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          nav a {
            min-width: 0;
          }
          .right-slot {
            justify-self: stretch;
            justify-content: flex-start;
          }
        }
        @media (max-width: 720px) {
          nav {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </header>
  )
}

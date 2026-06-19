'use client'

import type { CSSProperties } from 'react'

const steps = [
  { key: 'request', label: '승객 호출', sub: '앱 호출', icon: '☎', color: '#F472B6' },
  { key: 'callcard', label: '호출 정보 생성', sub: '콜카드 조건', icon: '▣', color: '#60A5FA' },
  { key: 'search', label: '주변 기사 탐색', sub: '후보 기사군', icon: '⌖', color: '#34D399' },
  { key: 'similarity', label: '유사도 계산', sub: '22D + H3', icon: '◎', color: '#A78BFA' },
  { key: 'rank', label: '우선순위 정렬', sub: 'Top N 선정', icon: '◆', color: '#22D3EE' },
  { key: 'send', label: '콜카드 발송', sub: '1순위 우선', icon: '✈', color: '#38BDF8' },
  { key: 'accept', label: '기사 수락', sub: '응답 대기', icon: '✓', color: '#34D399' },
  { key: 'dispatch', label: '배차 완료', sub: '승객 픽업 이동', icon: '🚕', color: '#FB923C' },
  { key: 'complete', label: '운행 완료', sub: '데이터 적재', icon: '●', color: '#FBBF24' },
] as const

type FlowKey = typeof steps[number]['key']

export function DispatchFlow({
  active = [],
  compact = false,
}: {
  active?: FlowKey[]
  compact?: boolean
}) {
  const activeSet = new Set(active)
  return (
    <section className={compact ? 'dispatch-flow compact' : 'dispatch-flow'} aria-label="전체 배차 흐름도">
      <div className="flow-head">
        <span>GLOBAL DISPATCH FLOW</span>
        <b>콜 발생부터 운행 완료까지 한 줄로 보는 AI 우선배차 흐름</b>
      </div>
      <div className="flow-track">
        {steps.map((step, index) => {
          const isActive = activeSet.size === 0 || activeSet.has(step.key)
          return (
            <div key={step.key} className={isActive ? 'flow-step active' : 'flow-step'} style={{ '--tone': step.color } as CSSProperties}>
              <div className="flow-icon">{step.icon}</div>
              <strong>{step.label}</strong>
              <em>{step.sub}</em>
              {index < steps.length - 1 && <i className="arrow">→</i>}
            </div>
          )
        })}
      </div>
      <style jsx>{`
        .dispatch-flow {
          margin: 0;
          padding: 18px clamp(20px, 2.4vw, 40px);
          border-bottom: 1px solid rgba(148,163,184,.18);
          background:
            radial-gradient(circle at 12% 10%, rgba(34,211,238,.12), transparent 26rem),
            rgba(5,8,16,.86);
          color: #F8FAFC;
        }
        .dispatch-flow.compact {
          padding-top: 14px;
          padding-bottom: 14px;
        }
        .flow-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }
        .flow-head span {
          color: #67E8F9;
          font-size: 20px;
          font-weight: 950;
        }
        .flow-head b {
          color: #CBD5E1;
          font-size: 20px;
          font-weight: 850;
          text-align: right;
        }
        .flow-track {
          display: grid;
          grid-template-columns: repeat(9, minmax(0, 1fr));
          gap: 10px;
          align-items: stretch;
        }
        .flow-step {
          position: relative;
          min-width: 0;
          display: grid;
          justify-items: center;
          align-content: start;
          gap: 6px;
          opacity: .42;
          filter: saturate(.65);
          transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
        }
        .flow-step.active {
          opacity: 1;
          filter: saturate(1.1);
        }
        .flow-step.active .flow-icon {
          border-color: var(--tone);
          background: color-mix(in srgb, var(--tone) 18%, #111827);
          box-shadow: 0 0 22px color-mix(in srgb, var(--tone) 28%, transparent);
        }
        .flow-icon {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 18px;
          background: rgba(15,23,42,.78);
          font-size: 24px;
          line-height: 1;
        }
        .flow-step strong {
          color: #F8FAFC;
          font-size: 20px;
          line-height: 1.15;
          font-weight: 950;
          text-align: center;
          white-space: normal;
        }
        .flow-step em {
          color: #94A3B8;
          font-size: 20px;
          line-height: 1.15;
          font-style: normal;
          font-weight: 850;
          text-align: center;
        }
        .arrow {
          position: absolute;
          top: 15px;
          right: -15px;
          color: #64748B;
          font-size: 22px;
          font-style: normal;
          z-index: 1;
        }
        @media (max-width: 1320px) {
          .flow-track {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .arrow { display: none; }
        }
        @media (max-width: 720px) {
          .flow-head { display: grid; }
          .flow-head b { text-align: left; }
          .flow-track { grid-template-columns: 1fr; }
          .flow-step { justify-items: start; grid-template-columns: 54px 1fr; column-gap: 14px; }
          .flow-step strong, .flow-step em { text-align: left; }
          .flow-step em { grid-column: 2; }
        }
      `}</style>
    </section>
  )
}

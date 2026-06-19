'use client'

const steps = [
  { key: 'request', label: '승객 호출', sub: '콜 발생', icon: '01' },
  { key: 'callcard', label: '콜카드 생성', sub: '조건 추출', icon: '02' },
  { key: 'search', label: '후보 탐색', sub: '기존 범위', icon: '03' },
  { key: 'similarity', label: '유사도 계산', sub: '22D + H3', icon: '04' },
  { key: 'rank', label: '우선순위', sub: '먼저 보낼 순서', icon: '05' },
  { key: 'send', label: '콜카드 발송', sub: '1순위 먼저', icon: '06' },
  { key: 'accept', label: '기사 수락', sub: '응답 확인', icon: '07' },
  { key: 'dispatch', label: '배차 완료', sub: '승객 픽업', icon: '08' },
  { key: 'complete', label: '운행 완료', sub: '결과 적재', icon: '09' },
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
    <section className={compact ? 'dispatch-flow compact' : 'dispatch-flow'} aria-label="전체 배차 흐름">
      <div className="flow-inner">
        {!compact && (
          <div className="flow-head">
            <span>DISPATCH FLOW</span>
            <b>콜수락율을 높이기 위한 후보 생성부터 우선발송까지</b>
          </div>
        )}
        <div className="flow-track">
          {steps.map((step, index) => {
            const isActive = activeSet.size === 0 || activeSet.has(step.key)
            return (
              <div key={step.key} className={isActive ? 'flow-step active' : 'flow-step'}>
                <div className="flow-icon">{step.icon}</div>
                <strong>{step.label}</strong>
                <em>{step.sub}</em>
                {index < steps.length - 1 && <i className="arrow">→</i>}
              </div>
            )
          })}
        </div>
      </div>
      <style jsx>{`
        .dispatch-flow {
          border-bottom: 1px solid var(--line);
          background: linear-gradient(180deg, var(--bg-1), rgba(255, 255, 255, 0.015));
        }
        .dispatch-flow.compact {
          background: rgba(7, 10, 16, 0.58);
        }
        .flow-inner {
          max-width: var(--maxw);
          margin: 0 auto;
          padding: 16px clamp(16px, 2vw, 28px);
        }
        .dispatch-flow.compact .flow-inner {
          padding-top: 10px;
          padding-bottom: 10px;
        }
        .flow-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }
        .flow-head span {
          color: var(--accent);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .flow-head b {
          color: var(--ink-2);
          font-size: 15px;
          font-weight: 650;
          text-align: right;
        }
        .flow-track {
          display: grid;
          grid-template-columns: repeat(9, minmax(0, 1fr));
          gap: 10px;
          align-items: stretch;
        }
        .dispatch-flow.compact .flow-track {
          gap: 6px;
        }
        .flow-step {
          position: relative;
          min-width: 0;
          display: grid;
          justify-items: center;
          align-content: start;
          gap: 6px;
          opacity: 0.34;
          transition: opacity 160ms ease, transform 160ms ease;
        }
        .flow-step.active {
          opacity: 1;
        }
        .flow-step.active .flow-icon {
          border-color: var(--accent-line);
          background: var(--accent-soft);
          color: var(--accent);
          box-shadow: 0 0 22px rgba(56, 189, 248, 0.14);
        }
        .flow-step:hover {
          transform: translateY(-2px);
        }
        .flow-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid var(--line);
          border-radius: 13px;
          background: var(--bg-2);
          color: var(--ink-3);
          font-size: 13px;
          line-height: 1;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .dispatch-flow.compact .flow-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          font-size: 11px;
        }
        .flow-step strong {
          color: var(--ink);
          font-size: 14px;
          line-height: 1.2;
          font-weight: 800;
          text-align: center;
        }
        .dispatch-flow.compact .flow-step strong {
          font-size: 12px;
          font-weight: 800;
        }
        .flow-step em {
          color: var(--ink-3);
          font-size: 12px;
          line-height: 1.2;
          font-style: normal;
          font-weight: 550;
          text-align: center;
        }
        .dispatch-flow.compact .flow-step em {
          display: none;
        }
        .arrow {
          position: absolute;
          top: 12px;
          right: -12px;
          color: var(--ink-4);
          font-size: 15px;
          font-style: normal;
          z-index: 1;
        }
        .dispatch-flow.compact .arrow {
          top: 8px;
          right: -8px;
          font-size: 12px;
          opacity: 0.5;
        }
        @media (max-width: 1320px) {
          .flow-track {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            row-gap: 16px;
          }
          .arrow {
            display: none;
          }
        }
        @media (max-width: 720px) {
          .flow-head {
            display: grid;
          }
          .flow-head b {
            text-align: left;
          }
          .flow-track {
            grid-template-columns: 1fr;
          }
          .flow-step {
            justify-items: start;
            grid-template-columns: 42px 1fr;
            column-gap: 12px;
          }
          .dispatch-flow.compact .flow-step {
            grid-template-columns: 32px 1fr;
          }
          .flow-step strong,
          .flow-step em {
            text-align: left;
          }
          .flow-step em {
            grid-column: 2;
          }
        }
      `}</style>
    </section>
  )
}

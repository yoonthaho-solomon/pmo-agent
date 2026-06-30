'use client'

const km = {
  cyan: '#22d3ee',
  cyanBright: '#5ce0f0',
  violet: '#a78bfa',
  violetBright: '#c3acff',
  green: '#4ade80',
  greenText: '#7ee0a3',
  amber: '#fbbf24',
  amberText: '#fbd77a',
  red: '#f87171',
  textHi: '#e8edf6',
  textMid: '#aab6c8',
  textDim: '#8b98ae',
  textFaint: '#7c89a0',
  panel: 'rgba(9,14,23,.72)',
  card: 'rgba(14,22,36,.62)',
  border: 'rgba(148,163,184,.13)',
}

const contracts = [
  {
    mark: '01',
    title: '후보군은 기존 배차',
    desc: '반경, 지역, 기사 상태, 정책 필터는 기존 배차 엔진이 그대로 만든다.',
    color: km.greenText,
    bg: 'rgba(74,222,128,.13)',
    border: 'rgba(74,222,128,.22)',
  },
  {
    mark: '02',
    title: 'AI는 순서만 바꿈',
    desc: '후보군 안에서 22D 성향과 공간 적합도로 우선 발송 순서를 정렬한다.',
    color: km.cyanBright,
    bg: 'rgba(34,211,238,.13)',
    border: 'rgba(34,211,238,.24)',
  },
  {
    mark: '03',
    title: '콜카드 먼저 발송',
    desc: '가장 잘 맞는 기사에게 먼저 보여주고, 수락 여부를 짧게 확인한다.',
    color: km.violetBright,
    bg: 'rgba(167,139,250,.15)',
    border: 'rgba(167,139,250,.24)',
  },
  {
    mark: '04',
    title: '미수락 시 복귀',
    desc: '응답이 없거나 조건이 맞지 않으면 기존 순차·반경 배차 흐름으로 넘긴다.',
    color: km.amberText,
    bg: 'rgba(251,191,36,.13)',
    border: 'rgba(251,191,36,.24)',
  },
]

const flowSteps = [
  {
    n: '01',
    title: '콜 발생',
    tag: '입력',
    desc: '콜카드의 출발·도착 H3, 시간대, 예상 거리·요금, 상품 조건을 받는다.',
    color: km.cyanBright,
    bg: `linear-gradient(180deg, ${km.cyan}, #1bb8d4)`,
    border: 'rgba(34,211,238,.24)',
  },
  {
    n: '02',
    title: '기존 배차가 후보군 생성',
    tag: '기존 로직',
    desc: '현재 운영 중인 반경, 지역, 기사 상태, 정책 조건으로 보낼 수 있는 기사만 남긴다.',
    color: km.greenText,
    bg: km.green,
    border: 'rgba(74,222,128,.24)',
  },
  {
    n: '03',
    title: 'AI 우선순위 산정',
    tag: 'AI 레이어',
    desc: '후보군 안에서 콜카드와 기사 벡터의 방향, 출발·도착 공간 적합도를 함께 본다.',
    color: km.violetBright,
    bg: `linear-gradient(180deg, ${km.violet}, #8a6eea)`,
    border: 'rgba(167,139,250,.24)',
    code: 'score = 0.75 * cosine(22D) + 0.25 * spatial(H3)',
  },
  {
    n: '04',
    title: '우선 발송',
    tag: '개입 지점',
    desc: '점수가 높은 기사부터 콜카드를 먼저 발송한다. 기존 배차와 달라지는 유일한 구간이다.',
    color: km.cyanBright,
    bg: `linear-gradient(180deg, ${km.cyan}, #19a8c0)`,
    border: 'rgba(34,211,238,.26)',
  },
  {
    n: '05',
    title: '수락 여부 분기',
    tag: '안전장치',
    desc: '수락하면 운행으로 이어지고, 미수락·타임아웃이면 기존 배차 흐름으로 안전하게 복귀한다.',
    color: km.amberText,
    bg: km.amber,
    border: 'rgba(251,191,36,.26)',
  },
]

const signals = [
  {
    label: '성향 유사도',
    value: '75%',
    desc: '콜카드 22D 벡터와 기사 22D 벡터의 방향이 얼마나 비슷한지 본다.',
    color: km.violetBright,
    width: '75%',
  },
  {
    label: '공간 적합도',
    value: '25%',
    desc: '출발·도착 H3 기준으로 해당 기사가 익숙한 공간과 얼마나 맞는지 본다.',
    color: km.greenText,
    width: '25%',
  },
]

const principles = [
  {
    title: '대체가 아니라 앞단 레이어',
    desc: 'AI는 기존 배차 엔진 밖에서 후보를 새로 만들지 않는다. 기존 후보군의 발송 순서만 조정한다.',
    color: km.cyanBright,
  },
  {
    title: '실패 비용을 낮게 유지',
    desc: '우선 발송이 실패해도 기존 순차·반경 배차가 바로 이어지므로 운영 흐름이 끊기지 않는다.',
    color: km.amberText,
  },
  {
    title: '검증 지표는 수락률',
    desc: '호출 총량이 아니라 발송 대비 수락률, fallback 비율, 응답 시간을 보고 효과를 판단한다.',
    color: km.greenText,
  },
]

export function DispatchLogicView() {
  return (
    <div className="dispatch-view">
      <style>{`
        .dispatch-view {
          max-width: 1560px;
          margin: 0 auto;
          padding: 22px 22px 40px;
        }
        .dispatch-title {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }
        .dispatch-title h1 {
          color: ${km.textHi};
          font-size: 31px;
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1.18;
          margin: 0;
        }
        .dispatch-title p {
          color: ${km.textDim};
          font-size: 16px;
          line-height: 1.65;
          max-width: 890px;
          margin: 0;
        }
        .contract-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }
        .contract-card,
        .flow-panel,
        .side-panel {
          background: ${km.panel};
          border: 1px solid ${km.border};
          box-shadow: 0 22px 52px rgba(0,0,0,.45);
          backdrop-filter: blur(20px) saturate(135%);
          -webkit-backdrop-filter: blur(20px) saturate(135%);
        }
        .contract-card {
          display: flex;
          gap: 14px;
          min-width: 0;
          border-radius: 8px;
          padding: 17px 18px;
        }
        .contract-mark {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: none;
          font-family: var(--km-font-mono);
          font-size: 14px;
          font-weight: 800;
        }
        .contract-card h2 {
          color: ${km.textHi};
          font-size: 16px;
          font-weight: 800;
          line-height: 1.25;
          margin: 0 0 6px;
        }
        .contract-card p {
          color: ${km.textDim};
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }
        .dispatch-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          gap: 14px;
          align-items: start;
        }
        .dispatch-map {
          background: ${km.panel};
          border: 1px solid ${km.border};
          border-radius: 8px;
          box-shadow: 0 22px 52px rgba(0,0,0,.45);
          margin-bottom: 14px;
          overflow: hidden;
          padding: 20px 22px 18px;
        }
        .dispatch-map-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 10px;
        }
        .dispatch-map h2 {
          color: ${km.textHi};
          font-size: 19px;
          font-weight: 800;
          margin: 0;
        }
        .dispatch-map p {
          color: ${km.textDim};
          font-size: 14px;
          line-height: 1.55;
          margin: 4px 0 0;
          max-width: 660px;
        }
        .dispatch-map-badge {
          color: ${km.greenText};
          background: rgba(74,222,128,.08);
          border: 1px solid rgba(74,222,128,.2);
          border-radius: 999px;
          flex: none;
          font-size: 13px;
          font-weight: 800;
          padding: 7px 12px;
        }
        .dispatch-route-svg {
          width: 100%;
          height: 340px;
          display: block;
        }
        .flow-panel,
        .side-panel {
          border-radius: 8px;
        }
        .flow-panel {
          padding: 24px;
        }
        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }
        .panel-heading h2,
        .side-panel h2 {
          color: ${km.textHi};
          font-size: 19px;
          font-weight: 800;
          line-height: 1.3;
          margin: 0;
        }
        .panel-heading p {
          color: ${km.textDim};
          font-size: 14px;
          line-height: 1.45;
          max-width: 460px;
          margin: 4px 0 0;
        }
        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }
        .legend span {
          color: ${km.textMid};
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          white-space: nowrap;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
        }
        .flow-list {
          display: flex;
          flex-direction: column;
        }
        .flow-step {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 17px;
        }
        .rail {
          display: flex;
          align-items: center;
          flex-direction: column;
        }
        .rail-number {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          color: #05070d;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: none;
          font-family: var(--km-font-mono);
          font-size: 15px;
          font-weight: 800;
          box-shadow: 0 5px 16px rgba(34,211,238,.25);
        }
        .rail-line {
          flex: 1;
          width: 2px;
          min-height: 24px;
          margin: 5px 0;
          background: rgba(148,163,184,.20);
        }
        .flow-card {
          background: ${km.card};
          border-radius: 8px;
          margin-bottom: 12px;
          padding: 17px 19px;
        }
        .flow-title {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 7px;
        }
        .flow-title strong {
          color: ${km.textHi};
          font-size: 17px;
          font-weight: 800;
          line-height: 1.25;
        }
        .tag {
          border-radius: 6px;
          font-size: 12px;
          font-weight: 800;
          padding: 3px 8px;
        }
        .flow-card p {
          color: ${km.textMid};
          font-size: 15px;
          line-height: 1.58;
          margin: 0;
        }
        .code-pill {
          display: inline-block;
          color: #7fd9ec;
          background: rgba(34,211,238,.08);
          border: 1px solid rgba(34,211,238,.18);
          border-radius: 6px;
          font-family: var(--km-font-mono);
          font-size: 13px;
          font-weight: 700;
          margin-top: 10px;
          padding: 5px 10px;
        }
        .outcome-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-left: 65px;
          margin-top: 2px;
        }
        .outcome {
          border-radius: 8px;
          padding: 16px 18px;
        }
        .outcome strong {
          display: block;
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 6px;
        }
        .outcome p {
          color: ${km.textMid};
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }
        .side-stack {
          display: flex;
          flex-direction: column;
          gap: 14px;
          position: sticky;
          top: 80px;
        }
        .side-panel {
          padding: 20px;
        }
        .side-note {
          color: ${km.textDim};
          font-size: 14px;
          line-height: 1.55;
          margin: 8px 0 16px;
        }
        .signal {
          margin-bottom: 16px;
        }
        .signal-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 7px;
        }
        .signal-head strong {
          font-size: 15px;
          font-weight: 800;
        }
        .signal-head span {
          font-family: var(--km-font-mono);
          font-size: 14px;
          font-weight: 800;
        }
        .signal p {
          color: ${km.textDim};
          font-size: 14px;
          line-height: 1.5;
          margin: 7px 0 0;
        }
        .bar {
          height: 7px;
          border-radius: 999px;
          background: rgba(148,163,184,.14);
          overflow: hidden;
        }
        .bar > span {
          display: block;
          height: 100%;
          border-radius: 999px;
        }
        .principle {
          background: rgba(20,28,42,.50);
          border: 1px solid rgba(148,163,184,.10);
          border-radius: 8px;
          padding: 14px 15px;
        }
        .principle + .principle {
          margin-top: 11px;
        }
        .principle strong {
          display: block;
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 5px;
        }
        .principle p {
          color: ${km.textDim};
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }
        @media (max-width: 1100px) {
          .contract-grid,
          .dispatch-grid {
            grid-template-columns: 1fr !important;
          }
          .side-stack {
            position: static;
          }
        }
        @media (max-width: 720px) {
          .dispatch-view {
            padding: 18px 16px 30px;
            overflow-x: hidden;
          }
          .dispatch-title h1 {
            font-size: 27px;
          }
          .dispatch-title p {
            font-size: 15px;
          }
          .flow-panel,
          .side-panel {
            padding: 18px;
          }
          .panel-heading {
            flex-direction: column;
          }
          .legend {
            justify-content: flex-start;
          }
          .flow-step {
            grid-template-columns: 42px minmax(0, 1fr);
            gap: 13px;
          }
          .rail-number {
            width: 36px;
            height: 36px;
            font-size: 14px;
          }
          .flow-card {
            padding: 15px;
          }
          .outcome-grid {
            grid-template-columns: 1fr;
            margin-left: 55px;
          }
          .code-pill {
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .dispatch-map {
            padding: 18px;
          }
          .dispatch-map-head {
            flex-direction: column;
          }
          .dispatch-route-svg {
            height: 285px;
          }
        }
        @keyframes routeDash {
          from { stroke-dashoffset: 140; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes routeBlink {
          0%, 100% { opacity: .45; }
          50% { opacity: 1; }
        }
        @keyframes layerScan {
          from { stroke-dashoffset: 180; opacity: .25; }
          50% { opacity: .95; }
          to { stroke-dashoffset: 0; opacity: .25; }
        }
        @keyframes dispatchSweep {
          from { transform: translateX(-18%); opacity: .10; }
          50% { opacity: .42; }
          to { transform: translateX(118%); opacity: .10; }
        }
        .dispatch-map {
          position: relative;
          background:
            radial-gradient(circle at 18% 18%, rgba(34,211,238,.11), transparent 32%),
            radial-gradient(circle at 82% 68%, rgba(251,191,36,.08), transparent 34%),
            linear-gradient(150deg, rgba(8,13,23,.94), rgba(4,7,14,.98));
        }
        .dispatch-map::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent);
          transform: translateX(-18%);
          animation: dispatchSweep 6.2s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      <div className="dispatch-title">
        <h1>배차 로직 — AI 우선배차 레이어</h1>
        <p>
          기존 배차를 버리는 화면이 아니라, <span style={{ color: km.cyanBright, fontWeight: 800 }}>기존 후보군 안에서
          가장 받을 가능성이 높은 기사에게 먼저 발송하는 안전한 앞단 레이어</span>를 설명하는 화면입니다.
          미수락이면 기존 순차·반경 배차로 자연스럽게 복귀합니다.
        </p>
      </div>

      <div className="contract-grid">
        {contracts.map((item) => (
          <section className="contract-card" key={item.title} style={{ borderColor: item.border }}>
            <span className="contract-mark" style={{ color: item.color, background: item.bg }}>
              {item.mark}
            </span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.desc}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="dispatch-map">
        <div className="dispatch-map-head">
          <div>
            <h2>기존 배차 위에 얇은 AI 레이어가 올라갑니다</h2>
            <p>운영 트랙은 끊기지 않고, AI는 후보군 위에 우선 발송 레이어만 잠깐 얹습니다. 실패하면 같은 트랙으로 조용히 복귀합니다.</p>
          </div>
          <span className="dispatch-map-badge">Fallback always on</span>
        </div>
        <svg className="dispatch-route-svg" viewBox="0 0 1040 340" role="img" aria-label="기존 배차 트랙 위에 AI 레이어가 얹히는 관제 맵">
          <defs>
            <linearGradient id="dispatchGround" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7ee0a3" stopOpacity=".10" />
              <stop offset="50%" stopColor="#9aa7bd" stopOpacity=".18" />
              <stop offset="100%" stopColor="#fbd77a" stopOpacity=".18" />
            </linearGradient>
            <linearGradient id="aiLayer" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity=".12" />
              <stop offset="48%" stopColor="#5ce0f0" stopOpacity=".9" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity=".45" />
            </linearGradient>
            <filter id="mapGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect x="48" y="38" width="944" height="250" rx="26" fill="rgba(255,255,255,.025)" stroke="rgba(148,163,184,.10)" />
          <path d="M84 232 C220 188 330 230 458 196 S680 152 934 190" fill="none" stroke="rgba(34,211,238,.07)" strokeWidth="38" strokeLinecap="round" />
          <path d="M90 72 C254 104 342 58 486 82 S734 92 954 64" fill="none" stroke="rgba(167,139,250,.06)" strokeWidth="30" strokeLinecap="round" />
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={i} x1={98 + i * 84} y1="58" x2={98 + i * 84} y2="220" stroke="rgba(148,163,184,.055)" />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={i} x1="68" y1={72 + i * 34} x2="970" y2={72 + i * 34} stroke="rgba(148,163,184,.045)" />
          ))}

          <path d="M105 162 C255 130 365 154 505 142 S744 112 930 140" fill="none" stroke="url(#dispatchGround)" strokeWidth="56" strokeLinecap="round" />
          <path d="M105 162 C255 130 365 154 505 142 S744 112 930 140" fill="none" stroke="rgba(148,163,184,.22)" strokeWidth="2" strokeLinecap="round" />
          <path d="M260 138 C374 74 522 72 646 104 S795 130 930 140" fill="none" stroke="url(#aiLayer)" strokeWidth="7" strokeLinecap="round" strokeDasharray="28 18" style={{ animation: 'layerScan 5s linear infinite' }} filter="url(#mapGlow)" />
          <path d="M646 104 C700 132 744 145 806 142" fill="none" stroke="#fbbf24" strokeOpacity=".58" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 15" style={{ animation: 'layerScan 5.6s linear infinite' }} />

          {[
            { x: 120, y: 162, title: 'CALL', sub: '입력', c: '#22d3ee' },
            { x: 260, y: 138, title: 'POOL', sub: '기존 후보군', c: '#7ee0a3' },
            { x: 610, y: 88, title: 'AI LAYER', sub: '우선 발송', c: '#5ce0f0' },
            { x: 812, y: 142, title: 'RETURN', sub: 'fallback', c: '#fbd77a' },
            { x: 930, y: 140, title: 'BASE', sub: '계속 운영', c: '#9aa7bd' },
          ].map((node) => (
            <g key={node.title}>
              <rect x={node.x - 52} y={node.y - 26} width="104" height="52" rx="12" fill="rgba(6,10,18,.86)" stroke={node.c} strokeOpacity=".34" />
              <text x={node.x} y={node.y - 3} textAnchor="middle" fill={node.c} fontSize="13" fontWeight="800" fontFamily="JetBrains Mono, monospace">{node.title}</text>
              <text x={node.x} y={node.y + 16} textAnchor="middle" fill="#aab6c8" fontSize="12" fontWeight="700" fontFamily="Pretendard, sans-serif">{node.sub}</text>
            </g>
          ))}

          <text x="70" y="315" fill="#7c89a0" fontSize="12" fontWeight="700" fontFamily="JetBrains Mono, monospace">BASE DISPATCH TRACK</text>
          <text x="825" y="315" fill="#5ce0f0" fontSize="12" fontWeight="700" fontFamily="JetBrains Mono, monospace">AI PRIORITY OVERLAY</text>
        </svg>
      </section>

      <div className="dispatch-grid">
        <section className="flow-panel">
          <div className="panel-heading">
            <div>
              <h2>기존 배차 위에 얹는 우선 발송 흐름</h2>
              <p>AI가 만드는 것은 새 배차 엔진이 아니라, 기존 후보군 안에서의 발송 순서입니다.</p>
            </div>
            <div className="legend">
              <span><i className="dot" style={{ background: km.green }} />기존 배차</span>
              <span><i className="dot" style={{ background: km.cyan }} />AI 레이어</span>
              <span><i className="dot" style={{ background: km.amber }} />Fallback</span>
            </div>
          </div>

          <div className="flow-list">
            {flowSteps.map((step, index) => (
              <div className="flow-step" key={step.n}>
                <div className="rail">
                  <span className="rail-number" style={{ background: step.bg }}>{step.n}</span>
                  {index < flowSteps.length - 1 && <span className="rail-line" />}
                </div>
                <div className="flow-card" style={{ border: `1px solid ${step.border}` }}>
                  <div className="flow-title">
                    <strong>{step.title}</strong>
                    <span className="tag" style={{ color: step.color, background: 'rgba(148,163,184,.10)' }}>
                      {step.tag}
                    </span>
                  </div>
                  <p>{step.desc}</p>
                  {step.code && <span className="code-pill">{step.code}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="outcome-grid">
            <div className="outcome" style={{
              background: 'linear-gradient(150deg, rgba(18,40,30,.70), rgba(12,20,16,.60))',
              border: '1px solid rgba(74,222,128,.32)',
            }}>
              <strong style={{ color: km.greenText }}>수락 → 운행 시작</strong>
              <p>우선 발송이 실제 수락으로 이어졌는지 기록하고, 기존 배차 대비 개선 효과를 본다.</p>
            </div>
            <div className="outcome" style={{
              background: 'linear-gradient(150deg, rgba(40,30,10,.70), rgba(20,16,6,.60))',
              border: '1px solid rgba(251,191,36,.30)',
            }}>
              <strong style={{ color: km.amberText }}>미수락 → 기존 배차</strong>
              <p>타임아웃, 거절, 조건 불일치가 발생하면 기존 배차 흐름으로 넘겨 운영 공백을 막는다.</p>
            </div>
          </div>
        </section>

        <div className="side-stack">
          <section className="side-panel">
            <h2>우선순위 점수는 입력 신호</h2>
            <p className="side-note">
              자세한 22D 축 해석은 벡터 워크벤치에서 다루고, 이 화면에서는 배차 흐름에 들어가는 신호로만 보여줍니다.
            </p>
            {signals.map((signal) => (
              <div className="signal" key={signal.label}>
                <div className="signal-head">
                  <strong style={{ color: signal.color }}>{signal.label}</strong>
                  <span style={{ color: signal.color }}>{signal.value}</span>
                </div>
                <div className="bar">
                  <span style={{
                    width: signal.width,
                    background: signal.label === '성향 유사도'
                      ? `linear-gradient(90deg, ${km.violet}, ${km.cyan})`
                      : km.green,
                  }} />
                </div>
                <p>{signal.desc}</p>
              </div>
            ))}
          </section>

          <section className="side-panel">
            <h2>운영 계약</h2>
            <p className="side-note">현장 적용 관점에서는 계산식보다 이 세 가지 약속이 더 중요합니다.</p>
            {principles.map((item) => (
              <div className="principle" key={item.title}>
                <strong style={{ color: item.color }}>{item.title}</strong>
                <p>{item.desc}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}

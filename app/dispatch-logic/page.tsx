'use client'

import type { CSSProperties } from 'react'

import { PrimaryNav } from '@/app/components/PrimaryNav'

const C = {
  bg: '#050810',
  ink: '#F8FAFC',
  sub: '#B6C3D8',
  muted: '#7D8BA3',
  line: 'rgba(148, 163, 184, 0.22)',
  cyan: '#22D3EE',
  purple: '#8B5CF6',
  green: '#10B981',
  orange: '#FB923C',
  amber: '#F59E0B',
  red: '#F43F5E',
} as const

const sections = [
  { id: 'overview', label: '개념', title: 'AI 우선배차 개념' },
  { id: 'flow', label: 'FLOW', title: '라이브 배차 흐름' },
  { id: 'handoff', label: 'HANDOFF', title: '개발 전달 데이터' },
  { id: 'score', label: 'SCORE', title: '점수 구성' },
  { id: 'reference', label: 'REFERENCE', title: 'Grab · Uber · DiDi' },
  { id: 'policy', label: 'POLICY', title: '운영 결정' },
] as const

const heroMetrics = [
  { label: '계산 기준', value: '22D + H3', note: '콜카드와 기사 성향 비교', color: C.cyan },
  { label: '후보 생성', value: '기존 엔진', note: '현재 배차 범위와 정책 유지', color: C.green },
  { label: 'Fallback', value: '기존 순차', note: '미수락 시 운영 안정성 보호', color: C.orange },
] as const

const dispatchInputs = [
  {
    title: '콜카드 원본 조건',
    value: '출발·도착·요금·거리·ETA',
    desc: '승객 출발지/도착지 주소와 H3, 예상거리, 예상요금, 승객 탑승 ETA, 호출 시간과 상품 조건을 받습니다.',
    color: C.cyan,
  },
  {
    title: '기존 후보 기사군',
    value: '현재 배차 엔진 유지',
    desc: '온라인, 공차, 반경, 상태 필터 등 실제 운영 후보 생성은 기존 배차 서버의 판단을 우선합니다.',
    color: C.green,
  },
  {
    title: '기사 누적 패턴',
    value: 'driver_mbti 22D',
    desc: '기사별 시간대, 요일, 거리, 요금, 상품 성향과 선호 출발·도착 H3를 조회합니다.',
    color: C.purple,
  },
  {
    title: '추천 출력',
    value: '우선발송 순서',
    desc: '최종 추천점수, 성향 유사도, 공간 적합도, 신뢰도, fallback 기준을 분리해 반환합니다.',
    color: C.orange,
  },
] as const

const flowSteps = [
  {
    title: '콜카드 수신',
    desc: 'call_id, asp_id, 요청 시각, 출발·도착 주소와 H3, 예상거리, 예상요금, 유료콜 여부, ETA 조건을 받습니다.',
    output: '원천 콜카드',
    color: C.cyan,
  },
  {
    title: '후보 기사군 생성',
    desc: '운영 중인 기존 배차 엔진의 반경, 지역, 상태, 정책 기준으로 후보 기사군을 먼저 만듭니다.',
    output: '기존 로직 유지',
    color: C.green,
  },
  {
    title: '콜카드 임베딩',
    desc: '시간대, 요일, 거리, 요금, 상품, ETA 조건을 22차원 콜카드 벡터로 변환합니다.',
    output: 'callcard 22D',
    color: C.purple,
  },
  {
    title: '기사 임베딩 조회',
    desc: 'driver_mbti의 누적 기사 운행 패턴 22D 벡터와 데이터 신뢰도를 조회합니다.',
    output: 'driver_mbti',
    color: C.amber,
  },
  {
    title: '유사도와 공간 적합도 계산',
    desc: '22D 코사인 유사도에 출발·도착 H3 적합도를 참고 점수로 더해 우선순위를 만듭니다.',
    output: 'AI 우선순위',
    color: C.orange,
  },
  {
    title: '우선발송과 fallback',
    desc: '가장 잘 맞는 기사에게 먼저 보내고, 미수락·무응답·만료 시 기존 순차 또는 반경 확장 흐름으로 넘깁니다.',
    output: '운영 안정성 보호',
    color: C.red,
  },
] as const

const handoffRows = [
  {
    name: '입력 데이터',
    value: '콜카드 + 기존 후보 기사군',
    desc: '콜 발생 시점의 조건과 기존 배차 엔진이 만든 후보군을 그대로 받습니다.',
  },
  {
    name: '비교 데이터',
    value: 'callcard 22D ↔ driver 22D',
    desc: '콜 조건과 기사 누적 운행 패턴을 같은 22차원 기준으로 비교합니다.',
  },
  {
    name: '공간 보조 데이터',
    value: '출발 H3 · 도착 H3 · OD 키',
    desc: '지역 선호를 벡터에 억지로 넣지 않고 별도 공간 적합도로 설명합니다.',
  },
  {
    name: '출력 데이터',
    value: 'Top N 후보 + 점수 구성요소',
    desc: '최종 추천점수, 성향 유사도, 공간 적합도, 신뢰도, 시뮬레이션 값을 분리해 반환합니다.',
  },
  {
    name: '검증 로그',
    value: '발송 · 수락 · 무응답 · 만료 · 취소 · 완료',
    desc: '실제 효과 검증은 이벤트 로그로 기존 배차 대비 결과를 비교합니다.',
  },
] as const

const scoreParts = [
  {
    label: '성향 유사도',
    formula: 'cosine(callcard22D, driver22D)',
    desc: '현재 구현의 핵심값입니다. 콜카드 조건과 기사 누적 운행 패턴이 같은 방향인지 봅니다.',
    color: C.cyan,
  },
  {
    label: '공간 적합도',
    formula: 'origin H3 45% + destination H3 55%',
    desc: '출발지와 목적지 H3가 기사 선호 H3와 가까운지 보조 점수로 계산합니다.',
    color: C.green,
  },
  {
    label: '예상 수락률',
    formula: '운영 검증 전 참고값',
    desc: '아직 운영 모델로 확정하지 않고, 화면에서 비교값으로만 보여줍니다.',
    color: C.orange,
  },
  {
    label: '거리 · ETA',
    formula: '실시간 위치 연동 전 시뮬레이션',
    desc: '기사 현재 위치 데이터가 준비되기 전까지는 최종 추천점수에 섞지 않습니다.',
    color: C.red,
  },
] as const

const references = [
  {
    company: 'Grab',
    role: 'Matching Lab',
    approach: '기존 결과와 AI 결과를 비교하고, 추천 점수가 왜 나왔는지 설명하는 검증실 구조입니다.',
  },
  {
    company: 'Uber',
    role: 'Dispatch Flow',
    approach: '후보 생성, 상태 필터, 랭킹, 콜카드 발송, 반경 확장으로 이어지는 운영 흐름입니다.',
  },
  {
    company: 'DiDi',
    role: 'Driver Pattern',
    approach: '기사 누적 운행패턴과 선호 지역을 반영해 단순 거리보다 수락 가능성을 높이는 방향입니다.',
  },
] as const

const policies = [
  '초기 적용 범위는 기존 후보 기사군 안에서 우선발송 순서만 AI로 정렬합니다.',
  '미수락이 반복되면 다음 유사도 후보로 넘길지, 일정 횟수 후 기존 순차 배차로 넘길지 결정합니다.',
  '실시간 기사 위치·온라인·공차 상태는 개발 배차 서버에서 받을지 별도 테이블로 받을지 정해야 합니다.',
  '발송, 수락, 무응답, EXPIRED, 취소, 운행완료 이벤트를 저장해 기존 배차 대비 효과를 검증합니다.',
] as const

export default function DispatchLogicPage() {
  return (
    <main className="page">
      <PrimaryNav active="/dispatch-logic" title="Happycall PMO" subtitle="AI Dispatch Handoff" />

      <div className="shell">
        <aside className="side" aria-label="배차로직 문서 목차">
          <div className="side-head">
            <span>HANDOFF</span>
            <strong>AI 우선배차 전달서</strong>
            <p>개발자가 구현할 영역과 운영에서 결정할 영역을 분리했습니다.</p>
          </div>

          <nav className="side-nav">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                <span>{section.label}</span>
                <b>{section.title}</b>
              </a>
            ))}
          </nav>

          <div className="side-note">
            <b>고정할 것</b>
            <p>기존 배차 엔진은 유지하고, 후보군 안에서 AI 우선순위만 적용합니다.</p>
          </div>
        </aside>

        <div className="content">
          <section id="overview" className="hero section-block">
            <div className="hero-copy">
              <p className="kicker">AI DISPATCH HANDOFF</p>
              <h1>콜카드 조건과 기사 운행패턴을 비교해 우선발송 순서를 정합니다</h1>
              <p className="lead">
                이 페이지의 핵심은 단순합니다. 기존 배차 엔진을 교체하지 않고, 콜 발생 후 만들어진 후보 기사군 안에서
                콜카드 원본 조건과 기사 누적 패턴을 비교해 먼저 보낼 기사 순서를 정합니다. 미수락이면 기존 순차·반경 확장
                흐름으로 안전하게 돌아갑니다.
              </p>
            </div>

            <div className="metric-grid">
              {heroMetrics.map((item) => (
                <article key={item.label} className="hero-metric" style={{ '--tone': item.color } as CSSProperties}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block input-contract">
            <SectionHeader
              label="INPUT · OUTPUT"
              title="개발자가 연결해야 할 핵심 계약"
              desc="복잡한 모델보다 먼저, 어떤 데이터를 받아 어떤 순서로 후보를 내보낼지 고정합니다."
            />
            <div className="contract-grid">
              {dispatchInputs.map((item) => (
                <article key={item.title} style={{ '--tone': item.color } as CSSProperties}>
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  <p>{item.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="flow" className="section-block split-section">
            <SectionHeader label="FLOW" title="라이브 배차 워크플로우" desc="운영 배차 흐름 안에서 AI가 개입하는 위치만 명확히 분리합니다." />

            <ol className="timeline">
              {flowSteps.map((step, index) => (
                <li key={step.title} style={{ '--tone': step.color } as CSSProperties}>
                  <span className="step-no">{String(index + 1).padStart(2, '0')}</span>
                  <div className="step-card">
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.desc}</p>
                    </div>
                    <em>{step.output}</em>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="handoff" className="section-block">
            <SectionHeader label="HANDOFF" title="개발자에게 전달할 데이터 흐름" desc="무엇을 입력으로 받고, 무엇을 계산하고, 무엇을 출력할지 고정합니다." />

            <div className="handoff-grid">
              {handoffRows.map((row, index) => (
                <article key={row.name} className="handoff-card">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{row.name}</h3>
                  <strong>{row.value}</strong>
                  <p>{row.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="score" className="section-block">
            <SectionHeader label="SCORE" title="점수 구성요소" desc="최종점수에 넣을 것과 아직 참고값으로만 둘 항목을 분리합니다." />

            <div className="score-grid">
              {scoreParts.map((score) => (
                <article key={score.label} className="score-card" style={{ '--tone': score.color } as CSSProperties}>
                  <div>
                    <span>{score.label}</span>
                    <h3>{score.formula}</h3>
                  </div>
                  <p>{score.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="reference" className="section-block">
            <SectionHeader label="REFERENCE" title="Grab · Uber · DiDi에서 가져올 관점" desc="화면 디자인을 베끼는 것이 아니라 검증실·후보생성·운행패턴이라는 역할을 가져옵니다." />

            <div className="reference-grid">
              {references.map((ref) => (
                <article key={ref.company} className="reference-card">
                  <span>{ref.role}</span>
                  <h3>{ref.company}</h3>
                  <p>{ref.approach}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="policy" className="section-block">
            <SectionHeader label="POLICY" title="운영 협의가 필요한 결정" desc="개발 구현 전에 정책으로 정해야 할 항목입니다." />

            <div className="policy-list">
              {policies.map((policy, index) => (
                <article key={policy}>
                  <span>Q{index + 1}</span>
                  <p>{policy}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <style jsx>{pageCss}</style>
    </main>
  )
}

function SectionHeader({ label, title, desc }: { label: string; title: string; desc: string }) {
  return (
    <div className="section-header">
      <p>{label}</p>
      <h2>{title}</h2>
      <span>{desc}</span>
    </div>
  )
}

const pageCss = `
  .page {
    min-height: 100vh;
    color: ${C.ink};
    background:
      linear-gradient(90deg, rgba(34, 211, 238, 0.045) 1px, transparent 1px),
      linear-gradient(180deg, rgba(34, 211, 238, 0.035) 1px, transparent 1px),
      radial-gradient(circle at 18% 12%, rgba(34, 211, 238, 0.14), transparent 30rem),
      radial-gradient(circle at 82% 14%, rgba(139, 92, 246, 0.12), transparent 28rem),
      ${C.bg};
    background-size: 72px 72px, 72px 72px, auto, auto, auto;
    font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 20px;
  }
  .shell {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    max-width: 1720px;
    margin: 0 auto;
    padding: 28px;
    gap: 24px;
  }
  .side {
    position: sticky;
    top: 104px;
    height: calc(100vh - 132px);
    border: 1px solid ${C.line};
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.85), rgba(5, 8, 16, 0.9));
    padding: 24px;
    overflow: auto;
  }
  .side-head span,
  .kicker,
  .section-header p {
    color: ${C.cyan};
    font-size: 20px;
    font-weight: 950;
    letter-spacing: 0;
  }
  .side-head strong {
    display: block;
    margin-top: 10px;
    color: ${C.ink};
    font-size: 30px;
    line-height: 1.12;
    font-weight: 950;
  }
  .side-head p,
  .side-note p {
    margin: 12px 0 0;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.45;
  }
  .side-nav {
    display: grid;
    gap: 10px;
    margin-top: 28px;
  }
  .side-nav a {
    border: 1px solid ${C.line};
    border-radius: 10px;
    color: ${C.ink};
    background: rgba(255,255,255,.03);
    padding: 14px;
    text-decoration: none;
  }
  .side-nav a:hover {
    border-color: ${C.cyan};
    background: rgba(34,211,238,.08);
  }
  .side-nav span {
    display: block;
    color: ${C.muted};
    font-size: 18px;
    font-weight: 900;
  }
  .side-nav b {
    display: block;
    margin-top: 4px;
    font-size: 21px;
  }
  .side-note {
    margin-top: 28px;
    border: 1px solid rgba(16,185,129,.34);
    border-radius: 10px;
    background: rgba(16,185,129,.08);
    padding: 18px;
  }
  .side-note b {
    color: ${C.green};
    font-size: 22px;
  }
  .content {
    display: grid;
    gap: 24px;
    min-width: 0;
  }
  .section-block {
    border: 1px solid ${C.line};
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.8), rgba(5, 8, 16, 0.88));
    box-shadow: 0 28px 90px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    padding: 32px;
    scroll-margin-top: 110px;
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 420px;
    gap: 28px;
    align-items: stretch;
  }
  h1, h2, h3, p {
    margin: 0;
  }
  h1 {
    margin-top: 10px;
    max-width: 980px;
    font-size: clamp(44px, 3.5vw, 72px);
    line-height: 1.04;
    font-weight: 950;
  }
  .lead {
    margin-top: 18px;
    max-width: 1100px;
    color: ${C.sub};
    font-size: 24px;
    line-height: 1.48;
    font-weight: 750;
  }
  .metric-grid {
    display: grid;
    gap: 14px;
  }
  .contract-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  .contract-grid article {
    min-width: 0;
    min-height: 230px;
    display: grid;
    align-content: start;
    gap: 12px;
    padding: 22px;
    border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
    border-radius: 10px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--tone) 11%, transparent), rgba(15, 23, 42, 0.64));
  }
  .contract-grid span {
    color: var(--tone);
    font-size: 20px;
    font-weight: 950;
  }
  .contract-grid strong {
    color: ${C.ink};
    font-size: 31px;
    line-height: 1.08;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .contract-grid p {
    margin: 0;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.42;
    font-weight: 700;
  }
  .hero-metric,
  .handoff-card,
  .score-card,
  .reference-card,
  .policy-list article {
    border: 1px solid ${C.line};
    border-radius: 10px;
    background: rgba(255,255,255,.035);
  }
  .hero-metric {
    border-color: color-mix(in srgb, var(--tone) 38%, ${C.line});
    background: color-mix(in srgb, var(--tone) 9%, transparent);
    padding: 22px;
  }
  .hero-metric span {
    color: ${C.sub};
    font-size: 20px;
    font-weight: 900;
  }
  .hero-metric strong {
    display: block;
    margin-top: 8px;
    color: var(--tone);
    font-size: 42px;
    line-height: 1;
    font-weight: 950;
  }
  .hero-metric p {
    margin-top: 8px;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.35;
  }
  .section-header {
    margin-bottom: 24px;
  }
  .section-header h2 {
    margin-top: 8px;
    font-size: clamp(34px, 2.5vw, 52px);
    line-height: 1.08;
    font-weight: 950;
  }
  .section-header span {
    display: block;
    margin-top: 10px;
    color: ${C.sub};
    font-size: 22px;
    line-height: 1.42;
  }
  .timeline {
    position: relative;
    display: grid;
    gap: 18px;
    margin: 0;
    padding: 0 0 0 28px;
    list-style: none;
    border-left: 2px solid rgba(148,163,184,.28);
  }
  .timeline li {
    position: relative;
  }
  .step-no {
    position: absolute;
    left: -47px;
    top: 18px;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--tone) 60%, transparent);
    border-radius: 999px;
    color: ${C.bg};
    background: var(--tone);
    font-size: 18px;
    font-weight: 950;
  }
  .step-card {
    border: 1px solid color-mix(in srgb, var(--tone) 34%, ${C.line});
    border-radius: 10px;
    background: color-mix(in srgb, var(--tone) 8%, transparent);
    padding: 20px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 20px;
    align-items: center;
  }
  .step-card h3 {
    font-size: 28px;
    font-weight: 950;
  }
  .step-card p {
    margin-top: 8px;
    color: ${C.sub};
    font-size: 21px;
    line-height: 1.45;
  }
  .step-card em {
    min-width: 170px;
    border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
    border-radius: 999px;
    color: var(--tone);
    background: rgba(255,255,255,.035);
    padding: 10px 14px;
    text-align: center;
    font-size: 20px;
    font-style: normal;
    font-weight: 950;
  }
  .handoff-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
  }
  .handoff-card,
  .score-card,
  .reference-card,
  .policy-list article {
    padding: 20px;
  }
  .handoff-card span {
    color: ${C.orange};
    font-size: 22px;
    font-weight: 950;
  }
  .handoff-card h3,
  .score-card h3,
  .reference-card h3 {
    margin-top: 10px;
    font-size: 26px;
    line-height: 1.15;
  }
  .handoff-card strong {
    display: block;
    margin-top: 12px;
    color: ${C.cyan};
    font-size: 22px;
    line-height: 1.25;
  }
  .handoff-card p,
  .score-card p,
  .reference-card p,
  .policy-list p {
    margin-top: 12px;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.45;
  }
  .score-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  .score-card {
    border-color: color-mix(in srgb, var(--tone) 38%, ${C.line});
    background: color-mix(in srgb, var(--tone) 8%, transparent);
  }
  .score-card span {
    color: var(--tone);
    font-size: 20px;
    font-weight: 950;
  }
  .reference-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .reference-card span {
    color: ${C.green};
    font-size: 20px;
    font-weight: 950;
  }
  .policy-list {
    display: grid;
    gap: 12px;
  }
  .policy-list article {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 18px;
    align-items: center;
  }
  .policy-list span {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    color: ${C.bg};
    background: ${C.orange};
    font-size: 22px;
    font-weight: 950;
  }
  .policy-list p {
    margin: 0;
  }
  @media (max-width: 1320px) {
    .shell {
      grid-template-columns: 1fr;
    }
    .side {
      position: static;
      height: auto;
    }
    .side-nav {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .hero {
      grid-template-columns: 1fr;
    }
    .metric-grid,
    .contract-grid,
    .score-grid,
    .reference-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .handoff-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 760px) {
    .shell {
      padding: 16px;
    }
    .section-block,
    .side {
      padding: 22px;
    }
    .side-nav,
    .metric-grid,
    .contract-grid,
    .score-grid,
    .reference-grid,
    .handoff-grid {
      grid-template-columns: 1fr;
    }
    .step-card {
      grid-template-columns: 1fr;
    }
    .policy-list article {
      grid-template-columns: 1fr;
    }
  }
`

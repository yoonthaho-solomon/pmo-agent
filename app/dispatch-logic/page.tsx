'use client'

import type { CSSProperties } from 'react'

import { PrimaryNav } from '@/app/components/PrimaryNav'

const C = {
  bg: '#050810',
  panel: '#0A101D',
  panelSoft: 'rgba(15, 23, 42, 0.72)',
  ink: '#F8FAFC',
  sub: '#B6C3D8',
  muted: '#7D8BA3',
  line: 'rgba(148, 163, 184, 0.22)',
  cyan: '#22D3EE',
  purple: '#8B5CF6',
  green: '#10B981',
  orange: '#FB923C',
  amber: '#F59E0B',
} as const

const sections = [
  { id: 'overview', label: '개념', title: 'AI 우선배차 레이어' },
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

const flowSteps = [
  {
    title: '콜카드 수신',
    desc: 'call_id, asp_id, 요청 시각, 출발·도착 좌표, 예상거리, 예상요금, 유료콜 여부, ETA 조건을 받습니다.',
    output: '원천 콜카드',
    color: C.cyan,
  },
  {
    title: '후보 기사군 생성',
    desc: '운영 중인 기존 배차 엔진이 반경, 지역, 상태, 정책 기준으로 후보 기사군을 먼저 만듭니다.',
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
    desc: 'driver_mbti에 누적된 기사 운행 패턴 22D 벡터와 데이터 신뢰도를 조회합니다.',
    output: 'driver_mbti',
    color: C.amber,
  },
  {
    title: '유사도와 공간 적합도 계산',
    desc: '22D 코사인 유사도에 출발·도착 H3 적합도를 보조 신호로 더해 우선순위를 정합니다.',
    output: 'AI 우선순위',
    color: C.orange,
  },
  {
    title: '우선발송과 Fallback',
    desc: '가장 맞는 기사에게 먼저 보내고, 미수락·무응답·만료 시 기존 순차 또는 반경 확장으로 이어갑니다.',
    output: '운영 안정성 보호',
    color: '#F43F5E',
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
    desc: '지역 선호를 벡터에 억지로 섞지 않고 별도 공간 적합도로 설명합니다.',
  },
  {
    name: '출력 데이터',
    value: 'Top N 후보 + 점수 구성요소',
    desc: '최종 추천점수, 성향 유사도, 공간 적합도, 신뢰도, 시뮬레이션 값을 분리해서 반환합니다.',
  },
  {
    name: '검증 로그',
    value: '발송 · 수락 · 무응답 · 만료 · 취소 · 완료',
    desc: '실제 효과 검증은 이벤트 로그로 기존 배차와 AI 우선배차를 비교합니다.',
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
    desc: '아직 운영 모델로 확정하지 않고 시뮬레이션 비교값으로만 표시합니다.',
    color: C.orange,
  },
  {
    label: '거리 · ETA',
    formula: '실시간 위치 연동 전 시뮬레이션',
    desc: '기사 현재 위치 데이터가 준비되기 전까지는 최종 추천점수에 넣지 않습니다.',
    color: '#F43F5E',
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
    approach: '기사 누적 운행패턴과 선호 지역을 반영해 단순 거리순보다 수락 가능성을 높이는 방향입니다.',
  },
] as const

const policies = [
  '초기 적용 범위는 기존 후보 기사군 안에서 우선발송 순서만 AI로 정렬합니다.',
  '미수락이 반복되면 다음 유사도 후보로 넘길지, 일정 횟수 후 기존 순차 배차로 넘길지 결정합니다.',
  '실시간 기사 위치·온라인·공차 상태는 개발 배차 서버와 연동할지 별도 테이블로 받을지 정합니다.',
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
            <p>개발팀이 구현 범위와 열어둘 영역을 한눈에 구분하도록 정리했습니다.</p>
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
              <h1>후보 기사군 안에서 가장 잘 받을 기사에게 먼저 보낸다</h1>
              <p className="lead">
                이 페이지의 핵심은 단순합니다. 기존 배차 엔진을 교체하지 않고, 콜 발생 후 만들어진 후보 기사군 안에서
                콜카드 22D와 기사 누적 22D를 비교해 우선발송 순서를 정합니다. 미수락이면 기존 순차·반경 확장 흐름으로 되돌아갑니다.
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
            <SectionHeader label="SCORE" title="점수 구성요소" desc="최종점수에 무엇을 넣고, 아직 참고값으로만 둘 항목이 무엇인지 분리합니다." />

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
            <SectionHeader label="REFERENCE" title="Grab · Uber · DiDi에서 가져올 관점" desc="화면 디자인을 흉내내는 것이 아니라, 검증실·후보생성·운행패턴이라는 역할을 가져옵니다." />

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

          <section id="policy" className="section-block policy-section">
            <SectionHeader label="POLICY" title="개발 전에 합의할 운영 결정" desc="개발자가 너무 좁게 고정하지 않도록 정책 판단이 필요한 부분은 열린 항목으로 남깁니다." />

            <div className="policy-list">
              {policies.map((policy, index) => (
                <article key={policy} className="policy-card">
                  <span>Q{index + 1}</span>
                  <p>{policy}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          color: ${C.ink};
          background:
            linear-gradient(90deg, rgba(34, 211, 238, 0.05) 1px, transparent 1px),
            linear-gradient(180deg, rgba(34, 211, 238, 0.04) 1px, transparent 1px),
            radial-gradient(circle at 16% 8%, rgba(34, 211, 238, 0.14), transparent 28rem),
            radial-gradient(circle at 86% 16%, rgba(139, 92, 246, 0.12), transparent 30rem),
            ${C.bg};
          background-size: 72px 72px, 72px 72px, auto, auto, auto;
          font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .shell {
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr);
          min-height: calc(100vh - 76px);
        }

        .side {
          position: sticky;
          top: 76px;
          height: calc(100vh - 76px);
          padding: 28px 22px;
          overflow-y: auto;
          border-right: 1px solid ${C.line};
          background: rgba(5, 8, 16, 0.74);
          backdrop-filter: blur(18px);
        }

        .side-head {
          display: grid;
          gap: 10px;
          padding: 18px;
          border: 1px solid rgba(34, 211, 238, 0.28);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(34, 211, 238, 0.12), rgba(15, 23, 42, 0.42));
        }

        .side-head span,
        .kicker,
        .section-label,
        .hero-metric span,
        .handoff-card span,
        .score-card span,
        .reference-card span {
          color: ${C.cyan};
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0;
        }

        .side-head strong {
          font-size: 26px;
          line-height: 1.16;
        }

        .side-head p,
        .side-note p {
          margin: 0;
          color: ${C.sub};
          font-size: 17px;
          line-height: 1.5;
          font-weight: 650;
        }

        .side-nav {
          display: grid;
          gap: 10px;
          margin: 18px 0;
        }

        .side-nav a {
          display: grid;
          gap: 4px;
          padding: 15px 16px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          color: ${C.ink};
          text-decoration: none;
          background: rgba(15, 23, 42, 0.45);
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .side-nav a:hover {
          transform: translateX(4px);
          border-color: rgba(34, 211, 238, 0.55);
          background: rgba(34, 211, 238, 0.1);
        }

        .side-nav a span {
          color: ${C.muted};
          font-size: 16px;
          font-weight: 900;
        }

        .side-nav a b {
          font-size: 19px;
          line-height: 1.2;
        }

        .side-note {
          padding: 18px;
          border: 1px solid rgba(251, 146, 60, 0.42);
          border-radius: 8px;
          background: rgba(251, 146, 60, 0.1);
        }

        .side-note b {
          display: block;
          margin-bottom: 8px;
          color: ${C.orange};
          font-size: 20px;
        }

        .content {
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
          padding: 36px 42px 84px;
          display: grid;
          gap: 28px;
        }

        .section-block {
          min-width: 0;
          scroll-margin-top: 104px;
          border: 1px solid ${C.line};
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(5, 8, 16, 0.84));
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 30px;
          align-items: stretch;
          padding: 42px;
        }

        .hero-copy {
          display: grid;
          align-content: center;
          gap: 18px;
        }

        h1 {
          max-width: 940px;
          margin: 0;
          font-size: 64px;
          line-height: 1.02;
          letter-spacing: 0;
        }

        .lead {
          max-width: 920px;
          margin: 0;
          color: ${C.sub};
          font-size: 22px;
          line-height: 1.58;
          font-weight: 650;
        }

        .metric-grid {
          display: grid;
          gap: 14px;
        }

        .hero-metric {
          display: grid;
          gap: 7px;
          padding: 20px;
          border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
          border-radius: 8px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 13%, transparent), rgba(15, 23, 42, 0.64));
        }

        .hero-metric strong {
          color: var(--tone);
          font-size: 38px;
          line-height: 1.05;
        }

        .hero-metric p {
          margin: 0;
          color: ${C.sub};
          font-size: 17px;
          line-height: 1.4;
          font-weight: 650;
        }

        .split-section,
        .section-block:not(.hero) {
          padding: 34px;
        }

        .section-head {
          display: grid;
          gap: 8px;
          margin-bottom: 26px;
        }

        .section-head h2 {
          margin: 0;
          font-size: 38px;
          line-height: 1.12;
          letter-spacing: 0;
        }

        .section-head p {
          max-width: 820px;
          margin: 0;
          color: ${C.sub};
          font-size: 19px;
          line-height: 1.5;
          font-weight: 650;
        }

        .timeline {
          position: relative;
          display: grid;
          gap: 18px;
          margin: 0 0 0 22px;
          padding: 0 0 0 30px;
          border-left: 2px solid rgba(148, 163, 184, 0.24);
          list-style: none;
        }

        .timeline li {
          position: relative;
        }

        .step-no {
          position: absolute;
          left: -53px;
          top: 18px;
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--tone) 72%, rgba(148, 163, 184, 0.4));
          border-radius: 50%;
          color: ${C.bg};
          background: var(--tone);
          font-size: 17px;
          font-weight: 950;
          box-shadow: 0 0 24px color-mix(in srgb, var(--tone) 35%, transparent);
        }

        .step-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: center;
          padding: 20px 22px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 10%, transparent), rgba(15, 23, 42, 0.54));
        }

        .step-card h3 {
          margin: 0 0 8px;
          font-size: 25px;
          line-height: 1.18;
        }

        .step-card p {
          margin: 0;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.48;
          font-weight: 650;
        }

        .step-card em {
          min-width: 160px;
          padding: 12px 16px;
          border: 1px solid color-mix(in srgb, var(--tone) 48%, transparent);
          border-radius: 8px;
          color: var(--tone);
          background: rgba(5, 8, 16, 0.52);
          font-size: 17px;
          font-style: normal;
          font-weight: 950;
          text-align: center;
        }

        .handoff-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .handoff-card,
        .score-card,
        .reference-card,
        .policy-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.54);
        }

        .handoff-card {
          min-height: 240px;
          padding: 20px;
          display: grid;
          align-content: start;
          gap: 12px;
        }

        .handoff-card h3 {
          margin: 0;
          font-size: 24px;
        }

        .handoff-card strong {
          color: ${C.ink};
          font-size: 20px;
          line-height: 1.25;
        }

        .handoff-card p,
        .score-card p,
        .reference-card p,
        .policy-card p {
          margin: 0;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.48;
          font-weight: 650;
        }

        .score-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .score-card {
          min-height: 210px;
          padding: 22px;
          display: grid;
          align-content: space-between;
          gap: 22px;
          border-color: color-mix(in srgb, var(--tone) 36%, rgba(148, 163, 184, 0.18));
          background: linear-gradient(140deg, color-mix(in srgb, var(--tone) 10%, transparent), rgba(15, 23, 42, 0.58));
        }

        .score-card span {
          color: var(--tone);
        }

        .score-card h3 {
          margin: 8px 0 0;
          font-size: 25px;
          line-height: 1.2;
        }

        .reference-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .reference-card {
          min-height: 230px;
          padding: 24px;
          display: grid;
          align-content: start;
          gap: 12px;
          background:
            linear-gradient(180deg, rgba(34, 211, 238, 0.08), transparent 42%),
            rgba(15, 23, 42, 0.54);
        }

        .reference-card h3 {
          margin: 0;
          font-size: 40px;
          line-height: 1;
        }

        .policy-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .policy-card {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr);
          gap: 18px;
          align-items: center;
          min-height: 126px;
          padding: 20px;
        }

        .policy-card span {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: ${C.bg};
          background: linear-gradient(135deg, ${C.cyan}, ${C.green});
          font-size: 20px;
          font-weight: 950;
        }

        @media (max-width: 1180px) {
          .shell {
            grid-template-columns: 1fr;
          }

          .side {
            display: none;
          }

          .content {
            padding: 28px 22px 72px;
          }

          .hero {
            grid-template-columns: 1fr;
          }

          .metric-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .handoff-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .hero,
          .split-section,
          .section-block:not(.hero) {
            padding: 24px;
          }

          h1 {
            font-size: 42px;
          }

          .lead {
            font-size: 19px;
          }

          .metric-grid,
          .score-grid,
          .reference-grid,
          .policy-list,
          .handoff-grid {
            grid-template-columns: 1fr;
          }

          .step-card {
            grid-template-columns: 1fr;
          }

          .step-card em {
            min-width: 0;
            text-align: left;
          }
        }

        @media (max-width: 520px) {
          .content {
            padding: 18px 12px 56px;
          }

          h1 {
            font-size: 34px;
          }

          .section-head h2 {
            font-size: 30px;
          }

          .timeline {
            margin-left: 12px;
            padding-left: 24px;
          }

          .step-no {
            left: -45px;
            width: 38px;
            height: 38px;
          }

          .policy-card {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}

function SectionHeader({ label, title, desc }: { label: string; title: string; desc: string }) {
  return (
    <div className="section-head">
      <span className="section-label">{label}</span>
      <h2>{title}</h2>
      <p>{desc}</p>
    </div>
  )
}

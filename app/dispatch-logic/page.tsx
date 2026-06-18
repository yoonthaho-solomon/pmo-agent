'use client'

import { PrimaryNav } from '@/app/components/PrimaryNav'

const C = {
  bg: '#050810',
  card: '#0A101D',
  ink: '#E2E8F0',
  sub: '#94A3B8',
  muted: '#64748B',
  line: '#1E293B',
  cyan: '#22D3EE',
  purple: '#8B5CF6',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#FB923C',
  red: '#F43F5E',
}

const pipeline = [
  {
    no: '01',
    title: '콜카드 수신',
    body: 'call_id, asp_id, 요청시각, 출발/도착 좌표, 예상거리, 예상요금, 유료콜, ETA를 받습니다.',
    state: '기존 호출 데이터',
    color: C.cyan,
  },
  {
    no: '02',
    title: '기존 후보 생성',
    body: '운영 중인 배차 엔진이 반경, 지역, 상태 기준으로 후보 기사군을 먼저 만듭니다.',
    state: '기존 로직 유지',
    color: C.green,
  },
  {
    no: '03',
    title: '콜카드 22D 변환',
    body: '시간대, 요일, 거리, 요금, 콜유형, 상품, ETA를 22차원 콜카드 벡터로 변환합니다.',
    state: 'lib/matching-vector.ts',
    color: C.purple,
  },
  {
    no: '04',
    title: '기사 22D 조회',
    body: '후보 기사들의 driver_mbti 누적 성향 벡터를 조회합니다. 후보 밖 기사는 계산하지 않습니다.',
    state: 'Supabase driver_mbti',
    color: C.yellow,
  },
  {
    no: '05',
    title: '코사인 유사도 정렬',
    body: '콜카드 벡터와 기사 벡터의 cosine similarity를 계산해 높은 순서로 재정렬합니다.',
    state: 'AI 우선순위',
    color: C.orange,
  },
  {
    no: '06',
    title: '우선 발송 + Fallback',
    body: '상위 기사에게 먼저 콜카드를 보내고, 미수락/무응답/만료 시 기존 순차 또는 반경 확장으로 돌아갑니다.',
    state: '기존 배차 보호',
    color: C.red,
  },
]

const handoffRows = [
  ['콜카드 정보', '호출 발생 시점의 시간, 요일, 출발/도착 좌표, 거리, 요금, 유료콜, ETA 조건을 사용합니다.'],
  ['후보 기사군', '기존 배차 로직이 만든 반경/지역/상태 기준 후보 기사 목록을 그대로 받습니다.'],
  ['콜카드 임베딩', '콜 조건을 시간대, 요일, 거리, 요금, 상품, ETA 기준의 22D 벡터로 변환합니다.'],
  ['기사 임베딩', 'driver_mbti에 저장된 기사별 누적 운행 패턴 22D 벡터를 조회합니다.'],
  ['유사도 비교', '콜카드 벡터와 기사 벡터의 코사인 유사도를 계산해 받을 가능성이 높은 순서를 만듭니다.'],
  ['우선 발송', '가장 유사한 기사에게 먼저 콜카드를 보내고, 미수락/무응답이면 기존 배차 흐름으로 이어집니다.'],
]

const scoreParts = [
  ['성향 유사도', '현재 구현의 핵심입니다. 콜카드 22D와 기사 22D가 얼마나 같은 방향인지 보여줍니다.', C.cyan],
  ['공간 적합도', '출발 H3와 도착 H3가 기사 선호 H3와 가까운지 보조로 확인합니다. 22D 벡터에는 섞지 않습니다.', C.green],
  ['수락률/위험도', '운영 검증 전에는 설명 지표로만 사용합니다. 최종 배차 정책에 바로 고정하지 않습니다.', C.orange],
  ['거리/ETA', '실시간 기사 위치가 연결되기 전까지는 시뮬레이션 값입니다. 운영값처럼 표시하지 않습니다.', C.red],
]

const references = [
  ['Grab', '기존 순차/거리순 결과와 AI 유사도 결과를 비교하는 Matching Lab 구조입니다.'],
  ['Uber', '후보 생성, 상태 필터, 1차/2차/3차 반경 확장, ETA 우선 구조입니다.'],
  ['DiDi', '기사 누적 운행패턴을 벡터화해 콜카드 성향과 맞추는 장기 고도화 방향입니다.'],
]

const decisions = [
  '초기 적용 범위: 기존 후보 기사군 안에서 발송 순서만 AI 유사도 순으로 바꿀지 결정',
  '미수락 처리: 다음 유사도 후보에게 넘길지, 일정 횟수 후 기존 순차/반경 배차로 돌릴지 결정',
  '실시간 위치 연동: 기사 위치/온라인/공차 상태는 개발 배차 시스템에서 받을지 별도 테이블로 받을지 결정',
  '효과 검증: 발송, 수락, 무응답, 만료, 취소, 운행완료 이벤트를 저장해 기존 배차와 비교',
]

export default function DispatchLogicPage() {
  return (
    <main className="page">
      <Topbar />

      <section className="hero">
        <div>
          <p className="eyebrow">AI DISPATCH HANDOFF</p>
          <h1>호출 발생 시 후보 기사군을 AI 유사도 순서로 재정렬한다</h1>
          <p className="lead">
            배차 엔진을 갈아엎는 작업이 아닙니다. 콜 발생 후 기존 로직이 만든 후보 기사군을 유지하고,
            그 안에서 콜카드 팩터와 기사 누적 패턴이 가장 잘 맞는 기사에게 먼저 콜카드를 보내는 우선순위 레이어입니다.
          </p>
        </div>
        <div className="hero-card">
          <Metric label="계산 기준" value="22D Cosine" color={C.cyan} />
          <Metric label="후보 생성" value="기존 엔진 유지" color={C.green} />
          <Metric label="Fallback" value="기존 배차 보호" color={C.orange} />
        </div>
      </section>

      <section className="board">
        <SectionTitle kicker="FLOW" title="라이브 배차 처리 순서" />
        <div className="pipeline">
          {pipeline.map((step) => (
            <article key={step.no} className="step" style={{ borderColor: `${step.color}66`, background: `${step.color}10` }}>
              <div className="step-top">
                <span style={{ color: step.color }}>{step.no}</span>
                <i style={{ background: step.color, boxShadow: `0 0 18px ${step.color}88` }} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <em style={{ color: step.color, background: `${step.color}16` }}>{step.state}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="grid">
        <div className="panel wide">
          <SectionTitle kicker="HANDOFF" title="개발자에게 전달할 데이터 흐름" />
          <div className="contract">
            {handoffRows.map(([name, desc], index) => (
              <div key={name} className="contract-row">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <b>{name}</b>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <SectionTitle kicker="SCORE" title="점수 구성요소는 분리해서 설명" />
          <div className="score-list">
            {scoreParts.map(([name, desc, color]) => (
              <div key={name} className="score-card">
                <b style={{ color }}>{name}</b>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid bottom">
        <div className="panel">
          <SectionTitle kicker="REFERENCE" title="Uber · Grab · DiDi 반영 위치" />
          <div className="reference-list">
            {references.map(([name, desc]) => (
              <div key={name} className="reference-card">
                <b>{name}</b>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel wide">
          <SectionTitle kicker="POLICY" title="개발팀과 함께 결정할 운영 정책" />
          <div className="decision-list">
            {decisions.map((item, index) => (
              <div key={item} className="decision">
                <span>{index + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 16% 14%, rgba(34,211,238,.12), transparent 28%),
            radial-gradient(circle at 84% 8%, rgba(139,92,246,.12), transparent 24%),
            ${C.bg};
          color: ${C.ink};
          font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
          gap: 1.2rem;
          padding: clamp(1.2rem, 3vw, 2.2rem);
          border-bottom: 1px solid ${C.line};
        }
        .eyebrow {
          margin: 0 0 .6rem;
          color: ${C.cyan};
          font-size: clamp(.78rem, 1.4vw, .92rem);
          font-weight: 950;
          letter-spacing: .14em;
        }
        h1 {
          max-width: 980px;
          margin: 0;
          font-size: clamp(2rem, 4.6vw, 4.6rem);
          line-height: 1.02;
          letter-spacing: 0;
        }
        .lead {
          max-width: 860px;
          color: ${C.sub};
          font-size: clamp(1rem, 1.8vw, 1.22rem);
          line-height: 1.58;
          margin: 1rem 0 0;
          font-weight: 650;
        }
        .hero-card,
        .panel {
          border: 1px solid ${C.line};
          border-radius: 20px;
          background: rgba(10,16,29,.84);
          box-shadow: 0 22px 70px rgba(0,0,0,.28);
        }
        .hero-card {
          display: grid;
          gap: .8rem;
          align-self: stretch;
          padding: 1rem;
        }
        .board,
        .grid {
          padding: clamp(1.2rem, 3vw, 2.2rem);
        }
        .pipeline {
          display: grid;
          grid-template-columns: repeat(6, minmax(160px, 1fr));
          gap: .9rem;
          overflow-x: auto;
          padding-bottom: .2rem;
        }
        .step {
          min-height: 13rem;
          border: 1px solid;
          border-radius: 18px;
          padding: 1rem;
          display: grid;
          align-content: start;
          gap: .65rem;
        }
        .step-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .step-top span {
          font-size: clamp(.95rem, 1.7vw, 1.2rem);
          font-weight: 950;
        }
        .step-top i {
          width: .7rem;
          height: .7rem;
          border-radius: 999px;
        }
        .step h3 {
          margin: 0;
          font-size: clamp(1.05rem, 1.8vw, 1.35rem);
          line-height: 1.18;
        }
        .step p,
        .score-card p,
        .reference-card p,
        .decision p,
        .contract-row p {
          margin: 0;
          color: ${C.sub};
          line-height: 1.46;
          font-size: clamp(.84rem, 1.45vw, .96rem);
          font-weight: 650;
        }
        .step em {
          justify-self: start;
          align-self: end;
          border-radius: 999px;
          padding: .28rem .55rem;
          font-style: normal;
          font-size: .72rem;
          font-weight: 950;
        }
        .grid {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(280px, .75fr);
          gap: 1rem;
          padding-top: 0;
        }
        .grid.bottom {
          grid-template-columns: minmax(280px, .8fr) minmax(0, 1.4fr);
        }
        .panel {
          padding: clamp(1rem, 2vw, 1.3rem);
          min-width: 0;
        }
        .contract {
          display: grid;
          gap: .65rem;
        }
        .contract-row {
          display: grid;
          grid-template-columns: 5.4rem minmax(8rem, .7fr) minmax(0, 1.8fr);
          gap: .8rem;
          align-items: center;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 14px;
          background: rgba(255,255,255,.025);
          padding: .8rem;
        }
        .contract-row span {
          color: ${C.cyan};
          font-size: .78rem;
          font-weight: 950;
        }
        .contract-row b {
          color: ${C.ink};
          font-size: clamp(.95rem, 1.7vw, 1.15rem);
          font-weight: 950;
        }
        .score-list,
        .reference-list,
        .decision-list {
          display: grid;
          gap: .75rem;
        }
        .score-card,
        .reference-card,
        .decision {
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 14px;
          background: rgba(255,255,255,.025);
          padding: .85rem;
        }
        .score-card b,
        .reference-card b {
          display: block;
          font-size: clamp(1rem, 1.8vw, 1.2rem);
          font-weight: 950;
          margin-bottom: .4rem;
        }
        .reference-card b {
          color: ${C.purple};
        }
        .decision {
          display: grid;
          grid-template-columns: 2.2rem 1fr;
          gap: .75rem;
          align-items: start;
        }
        .decision span {
          width: 2.2rem;
          height: 2.2rem;
          border-radius: 10px;
          display: grid;
          place-items: center;
          color: ${C.bg};
          background: ${C.cyan};
          font-weight: 950;
        }
        @media (max-width: 980px) {
          .hero,
          .grid,
          .grid.bottom {
            grid-template-columns: 1fr;
          }
          .pipeline {
            grid-template-columns: repeat(3, minmax(180px, 1fr));
            overflow-x: visible;
          }
        }
        @media (max-width: 640px) {
          .pipeline {
            grid-template-columns: 1fr;
          }
          .contract-row {
            grid-template-columns: 1fr;
            gap: .25rem;
          }
        }
      `}</style>
    </main>
  )
}

function Topbar() {
  return <PrimaryNav active="/dispatch-logic" title="Happycall PMO" subtitle="AI Dispatch" />
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b style={{ color }}>{value}</b>
      <style jsx>{`
        .metric {
          border: 1px solid ${C.line};
          border-radius: 16px;
          background: rgba(255,255,255,.025);
          padding: .9rem;
          display: grid;
          gap: .3rem;
        }
        span {
          color: ${C.muted};
          font-size: clamp(.78rem, 1.3vw, .9rem);
          font-weight: 900;
        }
        b {
          font-size: clamp(1.35rem, 2.6vw, 1.75rem);
          font-weight: 950;
        }
      `}</style>
    </div>
  )
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="section-title">
      <span>{kicker}</span>
      <h2>{title}</h2>
      <style jsx>{`
        .section-title {
          margin-bottom: 1rem;
        }
        span {
          color: ${C.muted};
          font-size: clamp(.72rem, 1.25vw, .84rem);
          font-weight: 950;
          letter-spacing: .14em;
        }
        h2 {
          margin: .32rem 0 0;
          font-size: clamp(1.3rem, 2.6vw, 2rem);
          line-height: 1.15;
        }
      `}</style>
    </div>
  )
}

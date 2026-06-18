'use client'

import Link from 'next/link'

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

const nav = [
  ['적재현황', '/ingest'],
  ['벡터리스트', '/vectors'],
  ['시뮬레이터', '/simulator'],
  ['배차로직', '/dispatch-logic'],
]

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

const contractRows = [
  ['Request', 'callcard', 'asp_id, request_datetime, passenger_lat/lng, dest_lat/lng, expected_distance, expected_fare, call_fee, eta_distance'],
  ['Request', 'candidate_drivers', '기존 배차 엔진이 만든 후보 기사 ID, 상태, 거리 또는 ETA'],
  ['Lookup', 'driver_mbti', 'driver_id 기준 22차원 기사 성향 벡터'],
  ['Compute', 'call_vector', '콜카드를 22D 벡터로 변환한 값'],
  ['Compute', 'vector_cosine', 'cosine_similarity(call_vector, driver_vector)'],
  ['Response', 'ranked_candidates', 'rank, driver_id, cosine_score, score_components, send_order'],
]

const scoreParts = [
  ['성향 유사도', '22D 코사인 유사도. 초기 운영 점수의 중심값입니다.', C.cyan],
  ['예상 수락률', '검증 전에는 설명 지표로만 표시하고 최종 점수에 바로 섞지 않습니다.', C.green],
  ['ETA/접근성', '실시간 위치 데이터가 연결되면 거리보다 ETA를 우선 반영합니다.', C.orange],
  ['콜 위험도', 'expired/canceled 위험도는 정책 비교용 별도 지표로 유지합니다.', C.red],
]

const references = [
  ['Grab', '기존 순차/거리순 결과와 AI 유사도 결과를 비교하는 Matching Lab 구조입니다.'],
  ['Uber', '후보 생성, 상태 필터, 1차/2차/3차 반경 확장, ETA 우선 구조입니다.'],
  ['DiDi', '기사 누적 운행패턴을 벡터화해 콜카드 성향과 맞추는 장기 고도화 방향입니다.'],
]

const decisions = [
  '실시간 기사 상태를 기존 배차 엔진에서 받을지, driver_realtime_state 테이블로 받을지 결정',
  '1차 운영은 코사인 유사도 정렬만 적용하고 ETA/위험도는 설명값으로만 노출',
  '미수락 시 다음 AI 후보로 갈지, 일정 횟수 후 기존 순차 배차로 돌아갈지 정책 결정',
  '효과 검증을 위해 발송, 수락, 무응답, 만료, 취소, 운행완료 이벤트 저장 필요',
]

export default function DispatchLogicPage() {
  return (
    <main className="page">
      <Topbar />

      <section className="hero">
        <div>
          <p className="eyebrow">DEVELOPER HANDOFF</p>
          <h1>기존 배차 후보를 22D 코사인 유사도 순서로 재정렬한다</h1>
          <p className="lead">
            배차 엔진을 갈아엎는 작업이 아닙니다. 콜 발생 후 기존 로직이 만든 후보 기사군을 유지하고,
            그 안에서 콜카드와 기사 성향이 가장 잘 맞는 순서로 콜카드 발송 순서만 바꾸는 작업입니다.
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
          <SectionTitle kicker="API CONTRACT" title="개발자에게 넘길 입출력 계약" />
          <div className="contract">
            {contractRows.map(([kind, name, desc]) => (
              <div key={name} className="contract-row">
                <span>{kind}</span>
                <b>{name}</b>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <SectionTitle kicker="SCORE" title="점수는 섞지 말고 분리" />
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
          <SectionTitle kicker="NEXT DECISIONS" title="개발 전에 결정할 것" />
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
  return (
    <header className="topbar">
      <Link href="/dashboard" className="brand">
        Happycall PMO <b>AI Dispatch</b>
      </Link>
      <nav>
        {nav.map(([label, href]) => (
          <Link key={href} href={href} className={href === '/dispatch-logic' ? 'active' : ''}>
            {label}
          </Link>
        ))}
      </nav>
      <style jsx>{`
        .topbar {
          position: sticky;
          top: 0;
          z-index: 80;
          min-height: 64px;
          display: grid;
          grid-template-columns: minmax(220px, 1fr) auto;
          gap: 1rem;
          align-items: center;
          padding: 0 clamp(1rem, 3vw, 2rem);
          border-bottom: 1px solid ${C.line};
          background: rgba(5,8,16,.88);
        }
        .brand {
          color: ${C.ink};
          text-decoration: none;
          font-size: clamp(1.05rem, 2vw, 1.3rem);
          font-weight: 950;
        }
        .brand b {
          color: ${C.cyan};
        }
        nav {
          display: flex;
          gap: .45rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        nav a {
          color: ${C.sub};
          text-decoration: none;
          border: 1px solid ${C.line};
          border-radius: 10px;
          padding: .55rem .7rem;
          font-size: clamp(.78rem, 1.3vw, .9rem);
          font-weight: 900;
          background: rgba(15,23,42,.7);
        }
        nav a.active {
          color: ${C.cyan};
          border-color: ${C.cyan};
          background: rgba(34,211,238,.1);
        }
        @media (max-width: 760px) {
          .topbar {
            grid-template-columns: 1fr;
            padding-top: .8rem;
            padding-bottom: .8rem;
          }
          nav {
            justify-content: flex-start;
          }
        }
      `}</style>
    </header>
  )
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

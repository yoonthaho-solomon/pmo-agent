import Link from 'next/link'
import type { ReactNode } from 'react'

const C = {
  bg: '#070A12',
  ink: '#F5F7FB',
  sub: '#AAB7CB',
  muted: '#657189',
  panel: 'rgba(9,14,26,.92)',
  border: '#22314F',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#FB923C',
  red: '#F43F5E',
  purple: '#8B5CF6',
}

const steps = [
  ['01', '콜 발생', 'call_id, asp_id, 요청시각, 출발/도착 좌표, 예상거리, 예상요금, 콜수수료, ETA를 받습니다.', C.cyan],
  ['02', '기존 후보 생성', '현재 배차 엔진이 만드는 반경/상태/지역 조건의 기사 후보군은 그대로 사용합니다.', C.green],
  ['03', '콜카드 22D 변환', '시간대, 요일, 거리, 요금, 콜유형, 상품, ETA를 콜카드 벡터로 변환합니다.', C.purple],
  ['04', '기사 22D 조회', 'driver_mbti에서 후보 기사별 누적 운행 성향 벡터를 조회합니다.', C.yellow],
  ['05', '코사인 유사도 계산', '콜카드 벡터와 기사 벡터의 cosine similarity로 우선순위를 재정렬합니다.', C.orange],
  ['06', '우선 발송 + fallback', '유사도 높은 기사부터 발송하고 미수락/만료 시 기존 순차/반경 배차로 돌아갑니다.', C.red],
]

const apiRows = [
  ['입력', 'callcard', 'call_id, asp_id, request_datetime, passenger/dest lat/lng, expected_distance, expected_fare, call_fee, eta'],
  ['입력', 'candidate_drivers', '기존 배차 엔진이 만든 후보 기사 목록과 현재 상태'],
  ['조회', 'driver_mbti', 'driver_id별 22차원 기사 성향 벡터'],
  ['계산', 'call_vector', '콜 조건을 22D 벡터로 변환한 값'],
  ['계산', 'ai_priority_score', 'cosine_similarity(call_vector, driver_vector)'],
  ['출력', 'ranked_candidates', 'driver_id, rank, cosine_score, score_components, send_order'],
  ['fallback', 'existing_dispatch', '미수락, 무응답, 만료 시 기존 배차 방식 유지'],
]

const lanes = [
  { title: 'Grab', desc: '기존 로직과 AI 우선정렬 결과를 비교하고 정책별 수락률, 만료율, 배차시간을 검증합니다.', color: C.purple },
  { title: 'Uber', desc: '후보 생성, 상태 필터, 반경 확장, ETA 우선 구조는 기존 배차 엔진 또는 실시간 상태 테이블이 담당합니다.', color: C.cyan },
  { title: 'DiDi', desc: '기사의 누적 운행패턴과 장기 성향은 driver_mbti 22D 벡터에서 시작합니다.', color: C.green },
]

export default function DispatchLogicPage() {
  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Topbar />
      <KpiRail />

      <section style={{ position: 'relative', minHeight: 'calc(100vh - 126px)', overflow: 'hidden', borderTop: `1px solid ${C.border}` }}>
        <MapBackdrop />

        <aside style={leftPanel}>
          <PanelTitle kicker="SCOPE" title="이번 개발 범위" />
          <ScopeCard title="바꾸는 것" items={['후보 기사 정렬 순서', '콜카드 22D 변환', '기사 22D 조회', '코사인 유사도 계산', 'Top N 발송 순서']} color={C.green} />
          <ScopeCard title="바꾸지 않는 것" items={['기존 배차 엔진', '실제 콜 발송 API', '미수락 fallback', '운영 배차 정책', 'DB 스키마 핵심 구조']} color={C.yellow} />
        </aside>

        <section style={stagePanel}>
          <div style={{ position: 'relative', zIndex: 4 }}>
            <div style={{ color: C.cyan, fontSize: 14, fontWeight: 950, letterSpacing: '.12em' }}>DEVELOPER HANDOFF BOARD</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 38, lineHeight: 1.08, fontWeight: 950 }}>기존 배차 후보를 AI 유사도 순서로 재정렬한다</h1>
            <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, maxWidth: 760, marginTop: 12 }}>
              개발자에게 전달할 핵심은 간단합니다. 콜 호출 시 기존 방식으로 후보를 만든 뒤, 콜카드와 기사 벡터의 코사인 유사도에 따라 우선 발송 순서만 바꿉니다.
            </p>
          </div>
          <FlowBoard />
        </section>

        <aside style={rightPanel}>
          <PanelTitle kicker="REFERENCE" title="레퍼런스 반영 위치" />
          {lanes.map((lane) => <ReferenceCard key={lane.title} {...lane} />)}
        </aside>

        <BottomContract />
      </section>
    </main>
  )
}

function Topbar() {
  const nav = [
    ['적재현황', '/ingest'],
    ['벡터리스트', '/vectors'],
    ['시뮬레이터', '/simulator'],
    ['배차로직', '/dispatch-logic'],
  ]

  return (
    <header style={{ height: 56, background: '#05070D', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '320px 1fr 260px', alignItems: 'center', padding: '0 18px', gap: 18 }}>
      <Link href="/dashboard" style={{ color: C.ink, textDecoration: 'none', fontSize: 18, fontWeight: 950 }}>
        Happycall PMO <span style={{ color: C.cyan }}>Dev Handoff</span>
      </Link>
      <nav style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {nav.map(([label, href]) => (
          <Link key={href} href={href} style={{ color: href === '/dispatch-logic' ? C.cyan : C.sub, textDecoration: 'none', border: `1px solid ${href === '/dispatch-logic' ? C.cyan : C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 900, background: href === '/dispatch-logic' ? 'rgba(34,211,238,.12)' : 'rgba(15,22,40,.62)' }}>
            {label}
          </Link>
        ))}
      </nav>
      <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
        <Pill color={C.green}>API CONTRACT</Pill>
        <Pill color={C.cyan}>22D</Pill>
      </div>
    </header>
  )
}

function KpiRail() {
  const items = [
    ['핵심 입력', '콜카드', '호출 조건과 좌표', C.cyan],
    ['후보 생성', '기존 엔진', '반경/상태 필터 유지', C.green],
    ['정렬 기준', 'Cosine', '22D 유사도', C.purple],
    ['출력', 'Top N', '발송 순서', C.yellow],
    ['Fallback', '기존 배차', '미수락/만료 시', C.orange],
  ]

  return (
    <section style={{ height: 70, background: '#080B13', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: `1px solid ${C.border}` }}>
      {items.map(([label, value, sub, color]) => (
        <div key={label} style={{ borderRight: `1px solid ${C.border}`, padding: '10px 18px' }}>
          <div style={{ color: C.muted, fontSize: 13, fontWeight: 900 }}>{label}</div>
          <div style={{ color: String(color), fontSize: 26, lineHeight: 1.05, fontWeight: 950, marginTop: 3 }}>{value}</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{sub}</div>
        </div>
      ))}
    </section>
  )
}

function FlowBoard() {
  return (
    <div style={{ position: 'absolute', left: 28, right: 28, bottom: 28, zIndex: 5 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {steps.map(([no, title, desc, color]) => (
          <div key={no} style={{ minHeight: 156, border: `1px solid ${String(color)}66`, borderRadius: 18, background: `${String(color)}10`, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: String(color), fontSize: 15, fontWeight: 950 }}>{no}</span>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: String(color), boxShadow: `0 0 18px ${String(color)}88` }} />
            </div>
            <div style={{ color: C.ink, fontSize: 21, fontWeight: 950, marginTop: 12 }}>{title}</div>
            <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.5, margin: '9px 0 0' }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function BottomContract() {
  return (
    <section style={{ position: 'absolute', left: 350, right: 350, bottom: 18, minHeight: 112, border: `1px solid ${C.border}`, borderRadius: 18, background: 'linear-gradient(90deg, rgba(9,14,26,.96), rgba(9,14,26,.76))', boxShadow: '0 20px 70px rgba(0,0,0,.32)', zIndex: 8, padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {apiRows.slice(0, 4).map(([kind, name, desc]) => (
          <div key={name} style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: 'rgba(15,22,40,.88)', padding: 12 }}>
            <div style={{ color: C.cyan, fontSize: 12, fontWeight: 950 }}>{kind}</div>
            <div style={{ color: C.ink, fontSize: 18, fontWeight: 950, marginTop: 6 }}>{name}</div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 7, lineHeight: 1.35 }}>{desc}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ScopeCard({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div style={{ marginTop: 14, border: `1px solid ${color}66`, borderRadius: 16, background: `${color}12`, padding: 16 }}>
      <div style={{ color, fontSize: 17, fontWeight: 950 }}>{title}</div>
      <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
        {items.map((item) => <div key={item} style={{ color: C.sub, fontSize: 14, fontWeight: 850 }}>{item}</div>)}
      </div>
    </div>
  )
}

function ReferenceCard({ title, desc, color }: { title: string; desc: string; color: string }) {
  return (
    <div style={{ marginTop: 14, border: `1px solid ${color}66`, borderRadius: 16, background: `${color}12`, padding: 16 }}>
      <div style={{ color, fontSize: 22, fontWeight: 950 }}>{title}</div>
      <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.55, margin: '8px 0 0' }}>{desc}</p>
    </div>
  )
}

function PanelTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div style={{ color: C.muted, fontSize: 13, fontWeight: 950, letterSpacing: '.12em' }}>{kicker}</div>
      <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 950 }}>{title}</h2>
    </div>
  )
}

function MapBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 48%, rgba(34,211,238,.12), transparent 30%), linear-gradient(135deg, #121820, #080B13 68%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.36, backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
    </div>
  )
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return <span style={{ color, border: `1px solid ${color}66`, background: `${color}18`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 950 }}>{children}</span>
}

const leftPanel: React.CSSProperties = {
  position: 'absolute',
  left: 18,
  top: 18,
  bottom: 18,
  width: 306,
  zIndex: 7,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  background: C.panel,
  padding: 18,
  boxShadow: '0 20px 70px rgba(0,0,0,.35)',
}

const rightPanel: React.CSSProperties = {
  position: 'absolute',
  right: 18,
  top: 18,
  bottom: 18,
  width: 306,
  zIndex: 7,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  background: C.panel,
  padding: 18,
  boxShadow: '0 20px 70px rgba(0,0,0,.35)',
}

const stagePanel: React.CSSProperties = {
  position: 'absolute',
  left: 342,
  right: 342,
  top: 18,
  bottom: 148,
  zIndex: 4,
  border: `1px solid rgba(34,211,238,.22)`,
  borderRadius: 22,
  background: 'rgba(7,10,18,.28)',
  padding: 24,
  overflow: 'hidden',
}


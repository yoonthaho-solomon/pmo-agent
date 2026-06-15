import Link from 'next/link'

const C = {
  bg: '#080C18',
  panel: '#0F1628',
  border: '#1E2D4A',
  text: '#F1F5F9',
  sub: '#A9B7CC',
  muted: '#6C7D99',
  cyan: '#22D3EE',
  green: '#10B981',
  purple: '#8B5CF6',
  orange: '#FB923C',
  red: '#F43F5E',
}

const steps = [
  ['1', '콜 발생', '호출 위치, 도착지, 예상거리, 예상요금, 유료콜 여부, ETA 정보를 확보합니다.'],
  ['2', '기존 후보 생성', '현재 배차 엔진이 사용하는 반경/상태/지역 조건으로 후보 기사 목록을 만듭니다.'],
  ['3', '콜카드 22D 변환', '콜카드 조건을 시간, 요일, 거리, 요금, 콜유형, 상품, 근접성 팩터로 변환합니다.'],
  ['4', '기사 22D 조회', '누적 호출 수락/운행 패턴으로 생성된 driver_mbti 벡터를 조회합니다.'],
  ['5', '코사인 유사도 계산', '콜카드 벡터와 기사 벡터의 cosine similarity를 계산합니다.'],
  ['6', '우선 발송', '유사도가 높은 기사부터 콜카드를 보내고 실패하면 기존 순차/반경 배차로 fallback합니다.'],
]

const apiRows = [
  ['입력', 'callcard', 'call_id, asp_id, request_datetime, passenger/dest lat,lng, expected_distance, expected_fare, call_fee, eta'],
  ['입력', 'candidate_drivers', '기존 배차 엔진이 만든 후보 기사 목록과 현재 상태'],
  ['조회', 'driver_mbti', 'driver_id별 22차원 기사 성향 벡터'],
  ['계산', 'ai_priority_score', 'cosine_similarity(call_vector, driver_vector)'],
  ['출력', 'ranked_candidates', 'driver_id, rank, cosine_score, score_components, send_order'],
  ['fallback', 'existing_dispatch', '미수락/무응답/만료 시 기존 배차 방식 유지'],
]

export default function DispatchLogicPage() {
  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '30px 28px 46px' }}>
        <TopNav active="배차로직" />
        <header style={{ margin: '22px 0 24px' }}>
          <h1 style={{ fontSize: 36, margin: 0, fontWeight: 950 }}>배차로직</h1>
          <p style={{ color: C.sub, fontSize: 18, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 980 }}>
            개발자에게 전달할 핵심은 기존 배차 엔진을 바꾸는 것이 아닙니다. 기존 후보 기사 목록을 만든 뒤,
            콜카드와 기사 22D 벡터의 코사인 유사도로 우선 발송 순서를 재정렬하는 것입니다.
          </p>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>
          <Panel title="AI 우선배차 처리 흐름" desc="Uber식 후보 생성과 반경 확장은 기존 배차 엔진 또는 추후 실시간 상태 테이블에서 담당하고, 이 페이지의 핵심은 정렬 기준입니다.">
            <div style={{ display: 'grid', gap: 12 }}>
              {steps.map(([no, title, desc]) => (
                <div key={no} style={{ display: 'grid', gridTemplateColumns: '42px 150px 1fr', gap: 14, alignItems: 'start', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: '#0B1222' }}>
                  <strong style={{ color: C.cyan, fontSize: 20 }}>{no}</strong>
                  <strong style={{ fontSize: 18 }}>{title}</strong>
                  <span style={{ color: C.sub, fontSize: 16, lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="서비스 적용 범위" desc="지금 당장 라이브서비스에 넣을 수 있는 최소 범위와 나중에 붙일 범위를 분리합니다.">
            <Block color={C.green} title="이번 적용" items={['22D 콜카드 벡터', '22D 기사 벡터', '코사인 유사도', 'Top N 우선 발송 순서', '기존 배차 fallback']} />
            <Block color={C.orange} title="추후 확장" items={['실시간 기사 위치', '온라인/공차/수신 가능 상태', 'ETA 기반 후보 필터', '도착지역 가치', '배차 균형 점수']} />
            <Block color={C.purple} title="레퍼런스 반영" items={['Grab: 기존/신규 정책 비교', 'Uber: 후보 생성과 반경 확장', 'DiDi: 누적 기사 성향과 장기 효율']} />
          </Panel>
        </section>

        <Panel title="개발 API 계약 초안" desc="이 형태로 개발자에게 전달하면 됩니다. 실제 필드명은 기존 배차 서버 계약에 맞춰 조정하면 됩니다.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr>{['구분', '이름', '내용'].map((h) => <th key={h} style={th()}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {apiRows.map((row) => (
                  <tr key={`${row[0]}-${row[1]}`}>{row.map((cell, i) => <td key={cell} style={td(i === 0 ? C.cyan : C.text)}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="운영 검증 지표" desc="AI 우선배차가 의미 있으려면 단순 추천 목록이 아니라 배차 결과까지 비교해야 합니다.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {['수락률 증가', 'expired 감소', 'canceled 감소', '첫 수락 시간 감소', '운행완료 증가'].map((item) => (
              <div key={item} style={{ minHeight: 92, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: '#0B1222', color: C.sub, fontSize: 17, fontWeight: 900 }}>
                {item}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  )
}

function TopNav({ active }: { active: string }) {
  const links = [
    ['대시보드', '/dashboard'],
    ['적재현황', '/ingest'],
    ['벡터리스트', '/vectors'],
    ['시뮬레이터', '/simulator'],
    ['배차로직', '/dispatch-logic'],
  ]
  return (
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {links.map(([label, href]) => (
        <Link key={href} href={href} style={{ color: label === active ? C.text : C.sub, border: `1px solid ${label === active ? C.orange : C.border}`, background: label === active ? 'rgba(251,146,60,.16)' : 'transparent', borderRadius: 8, padding: '9px 12px', textDecoration: 'none', fontWeight: 900 }}>
          {label}
        </Link>
      ))}
    </nav>
  )
}

function Panel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 18 }}>
      <h2 style={{ fontSize: 23, margin: 0, fontWeight: 950 }}>{title}</h2>
      <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, margin: '8px 0 16px' }}>{desc}</p>
      {children}
    </section>
  )
}

function Block({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: '#0B1222', marginBottom: 12 }}>
      <h3 style={{ color, fontSize: 19, margin: 0, fontWeight: 950 }}>{title}</h3>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {items.map((item) => <div key={item} style={{ color: C.sub, fontSize: 16, fontWeight: 800 }}>{item}</div>)}
      </div>
    </div>
  )
}

function th(): React.CSSProperties {
  return { textAlign: 'left', color: C.sub, padding: '12px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 15 }
}

function td(color = C.text): React.CSSProperties {
  return { color, padding: '12px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 15, lineHeight: 1.45, fontWeight: 780 }
}

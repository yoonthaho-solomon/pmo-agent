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
}

const cards = [
  {
    href: '/ingest',
    title: '적재현황',
    eyebrow: 'Data Coverage',
    desc: '호출데이터와 앱미터데이터가 몇일부터 몇일까지 들어와 있는지, 날짜별 누락이 있는지 확인합니다.',
    points: ['호출데이터 적재 범위', '앱미터데이터 적재 범위', '최근 7일 적재 상태', '자동 폴더 적재 안내'],
    color: C.green,
  },
  {
    href: '/vectors',
    title: '벡터리스트',
    eyebrow: '22D Factors',
    desc: '콜카드 팩터와 기사 팩터를 22차원으로 보고, 실제 코사인 유사도 Top 10을 확인합니다.',
    points: ['콜카드 22D 벡터', '기사 22D 벡터', '팩터별 점수', '코사인 유사도'],
    color: C.cyan,
  },
  {
    href: '/simulator',
    title: '시뮬레이터',
    eyebrow: 'Matching Simulation',
    desc: '콜카드 조건을 입력하면 누적된 기사 정보 중 적합한 기사 후보를 찾아 보여줍니다.',
    points: ['콜카드 조건 입력', '기사 후보 검색', '유사도 Top 10', '반경 확장 검증'],
    color: C.purple,
  },
  {
    href: '/dispatch-logic',
    title: '배차로직',
    eyebrow: 'Developer Handoff',
    desc: '개발자에게 전달할 AI 우선배차 흐름, 입력/출력, 기존 배차 fallback 기준을 정리합니다.',
    points: ['기존 배차 유지', 'AI 우선 정렬 추가', '개발 API 계약', '운영 검증 지표'],
    color: C.orange,
  },
]

export default function DashboardPage() {
  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '34px 28px 46px' }}>
        <header style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'end', marginBottom: 28 }}>
          <div>
            <div style={{ color: C.cyan, fontSize: 16, fontWeight: 950, marginBottom: 10 }}>PMO AI 우선배차 준비 화면</div>
            <h1 style={{ fontSize: 38, lineHeight: 1.15, margin: 0, fontWeight: 950, letterSpacing: 0 }}>
              데이터 적재부터 코사인 유사도 배차까지
            </h1>
            <p style={{ color: C.sub, fontSize: 18, lineHeight: 1.6, margin: '12px 0 0', maxWidth: 900 }}>
              이 대시보드는 한 화면에 모든 기능을 섞지 않습니다. 적재현황, 벡터리스트, 시뮬레이터, 배차로직을 분리해서
              지금 무엇을 확인하는지 바로 알 수 있게 구성했습니다.
            </p>
          </div>
          <div style={{ color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', fontWeight: 850 }}>
            운영 기준: 읽기/검증 중심
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
          {cards.map((card) => (
            <Link key={card.href} href={card.href} style={{ color: 'inherit', textDecoration: 'none' }}>
              <article style={{ minHeight: 360, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ color: card.color, fontSize: 15, fontWeight: 950 }}>{card.eyebrow}</div>
                <div>
                  <h2 style={{ fontSize: 27, margin: 0, fontWeight: 950 }}>{card.title}</h2>
                  <p style={{ color: C.sub, fontSize: 17, lineHeight: 1.55, margin: '12px 0 0' }}>{card.desc}</p>
                </div>
                <div style={{ display: 'grid', gap: 10, marginTop: 'auto' }}>
                  {card.points.map((point) => (
                    <div key={point} style={{ display: 'flex', gap: 9, alignItems: 'center', color: C.sub, fontSize: 16, fontWeight: 780 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: card.color, flex: '0 0 auto' }} />
                      {point}
                    </div>
                  ))}
                </div>
              </article>
            </Link>
          ))}
        </section>

        <section style={{ marginTop: 24, background: '#0B1222', border: `1px solid ${C.border}`, borderRadius: 8, padding: 22 }}>
          <h2 style={{ fontSize: 23, margin: 0, fontWeight: 950 }}>우버·그랩·디디 반영 위치</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
            <Ref title="Grab" desc="시뮬레이터에서 기존 결과와 AI 유사도 결과를 비교하고, 추천 점수 구성요소를 설명합니다." />
            <Ref title="Uber" desc="시뮬레이터와 배차로직에서 주변 후보 생성, 상태 필터, 반경 확장 구조로 반영합니다." />
            <Ref title="DiDi" desc="벡터리스트에서 기사 누적 패턴을 22D 팩터로 보고, 이후 도착지역 가치로 확장합니다." />
          </div>
        </section>
      </div>
    </main>
  )
}

function Ref({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, background: C.panel }}>
      <div style={{ fontSize: 19, fontWeight: 950 }}>{title}</div>
      <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, margin: '8px 0 0' }}>{desc}</p>
    </div>
  )
}

import Link from 'next/link'
import { InsightCard, Panel, PmoShell, ui } from '@/app/components/PmoShell'

const workflows = [
  {
    href: '/ingest',
    title: '적재현황',
    label: '먼저 확인',
    desc: '호출데이터와 앱미터데이터가 어느 날짜까지 들어왔는지 확인합니다.',
    color: ui.green,
  },
  {
    href: '/vectors',
    title: '벡터리스트',
    label: '핵심 설명',
    desc: '콜카드 팩터와 기사 능력치를 카드처럼 비교하고 코사인 유사도를 봅니다.',
    color: ui.cyan,
  },
  {
    href: '/simulator',
    title: '시뮬레이터',
    label: '결과 검증',
    desc: '새 콜 조건을 넣고 누적 기사 정보 중 가장 잘 맞는 후보를 찾습니다.',
    color: ui.purple,
  },
  {
    href: '/dispatch-logic',
    title: '배차로직',
    label: '개발 전달',
    desc: '기존 배차 후보를 AI 유사도 순으로 정렬하는 계약을 정리합니다.',
    color: ui.orange,
  },
]

export default function DashboardPage() {
  return (
    <PmoShell
      active="대시보드"
      kicker="SERVICE MAP"
      title="AI 우선배차를 설명하는 운영 콘솔"
      description="이 화면은 모든 정보를 한 번에 쏟아내지 않습니다. 데이터가 준비됐는지, 벡터가 어떤 의미인지, 실제 추천이 어떻게 나오는지, 개발자에게 무엇을 전달해야 하는지를 순서대로 보여줍니다."
      status="제품 구조 정리"
    >
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
        <InsightCard tone={ui.green} title="1. 데이터" value="적재현황" desc="호출과 앱미터 데이터의 날짜 범위와 누락을 봅니다." />
        <InsightCard tone={ui.cyan} title="2. 벡터" value="22D" desc="콜카드와 기사를 같은 팩터 체계로 변환합니다." />
        <InsightCard tone={ui.purple} title="3. 추천" value="Top 10" desc="코사인 유사도가 높은 기사부터 확인합니다." />
        <InsightCard tone={ui.orange} title="4. 전달" value="API" desc="기존 배차를 유지하고 우선순위만 추가합니다." />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>
        <Panel title="사용 흐름" desc="운영자와 개발자가 같은 흐름으로 이해하도록 화면을 4단계로 나눴습니다.">
          <div style={{ display: 'grid', gap: 12 }}>
            {workflows.map((item, index) => (
              <Link key={item.href} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                <article style={{ display: 'grid', gridTemplateColumns: '50px 150px 1fr 110px', gap: 14, alignItems: 'center', minHeight: 88, border: `1px solid ${ui.border}`, borderRadius: 8, background: '#0B1222', padding: 16 }}>
                  <strong style={{ color: item.color, fontSize: 26 }}>{String(index + 1).padStart(2, '0')}</strong>
                  <div>
                    <div style={{ color: item.color, fontSize: 13, fontWeight: 950 }}>{item.label}</div>
                    <div style={{ fontSize: 21, fontWeight: 950, marginTop: 4 }}>{item.title}</div>
                  </div>
                  <p style={{ color: ui.sub, fontSize: 16, lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
                  <span style={{ color: item.color, fontSize: 15, fontWeight: 950, textAlign: 'right' }}>열기</span>
                </article>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="보여줄 것과 숨길 것" desc="서비스 화면에서는 판단에 필요한 정보만 먼저 보이게 합니다.">
          <div style={{ display: 'grid', gap: 14 }}>
            <Rule tone={ui.green} title="보여줄 것" lines={['데이터 날짜 범위', '콜카드 주요 조건', '기사 능력치 팩터', '코사인 유사도', '개발 전달 흐름']} />
            <Rule tone={ui.red} title="숨길 것" lines={['긴 원본 JSON', '불필요한 내부 테이블명 반복', 'mock 값을 실제 배차처럼 보이는 표현', '확정되지 않은 최종 배차점수']} />
          </div>
        </Panel>
      </section>

      <Panel title="Uber · Grab · DiDi 반영 방식" desc="참고 서비스의 장점은 각각 다른 화면에 녹입니다. 그대로 베끼는 것이 아니라 PMO 배차 설명에 맞게 번역합니다.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Ref title="Grab" color={ui.purple} desc="시뮬레이터에서 기존 정책과 AI 추천 결과를 비교하고, 점수 구성요소를 설명합니다." />
          <Ref title="Uber" color={ui.cyan} desc="배차로직에서 후보 생성, 상태 필터, 반경 확장, fallback 흐름으로 반영합니다." />
          <Ref title="DiDi" color={ui.green} desc="벡터리스트에서 기사 누적 패턴을 능력치처럼 보여주고, 이후 도착지역 가치로 확장합니다." />
        </div>
      </Panel>
    </PmoShell>
  )
}

function Rule({ tone, title, lines }: { tone: string; title: string; lines: string[] }) {
  return (
    <div style={{ border: `1px solid ${ui.border}`, borderRadius: 8, background: '#0B1222', padding: 16 }}>
      <div style={{ color: tone, fontSize: 18, fontWeight: 950 }}>{title}</div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {lines.map((line) => <div key={line} style={{ color: ui.sub, fontSize: 16, fontWeight: 780 }}>{line}</div>)}
      </div>
    </div>
  )
}

function Ref({ title, desc, color }: { title: string; desc: string; color: string }) {
  return (
    <div style={{ border: `1px solid ${ui.border}`, borderRadius: 8, background: '#0B1222', padding: 18 }}>
      <div style={{ color, fontSize: 22, fontWeight: 950 }}>{title}</div>
      <p style={{ color: ui.sub, fontSize: 16, lineHeight: 1.55, margin: '10px 0 0' }}>{desc}</p>
    </div>
  )
}

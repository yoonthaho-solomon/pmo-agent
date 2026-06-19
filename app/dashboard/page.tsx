import Link from 'next/link'
import type { ReactNode } from 'react'

const C = {
  bg: '#080C18',
  top: '#070A12',
  panel: 'rgba(15,22,40,.92)',
  line: '#1E2D4A',
  text: '#F1F5F9',
  sub: '#9FB0C8',
  muted: '#5D6B85',
  cyan: '#22D3EE',
  green: '#10B981',
  red: '#F43F5E',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  orange: '#FB923C',
}

const nav = [
  ['적재현황', '/ingest'],
  ['벡터리스트', '/vectors'],
  ['시뮬레이터', '/simulator'],
  ['배차로직', '/dispatch-logic'],
]

const kpis = [
  { label: '데이터 준비', value: '5/23-6/11', sub: '호출데이터 기준', color: C.cyan },
  { label: '벡터 기준', value: '22D', sub: '콜카드 x 기사', color: C.green },
  { label: '추천 출력', value: 'Top 10', sub: '코사인 유사도', color: C.purple },
  { label: '적용 방식', value: '우선정렬', sub: '기존 배차 유지', color: C.orange },
  { label: 'Fallback', value: '기존순차', sub: '미수락/만료 시', color: C.yellow },
]

const flow = [
  {
    no: '01',
    title: '적재현황',
    href: '/ingest',
    desc: '호출/앱미터 데이터가 어느 날짜까지 준비됐는지 확인합니다.',
    color: C.green,
  },
  {
    no: '02',
    title: '벡터리스트',
    href: '/vectors',
    desc: '콜카드와 기사 능력치를 22D 카드와 연결 그래프로 봅니다.',
    color: C.cyan,
  },
  {
    no: '03',
    title: '시뮬레이터',
    href: '/simulator',
    desc: '콜 조건을 입력하고 가장 잘 맞는 기사 Top 10을 찾습니다.',
    color: C.purple,
  },
  {
    no: '04',
    title: '배차로직',
    href: '/dispatch-logic',
    desc: '개발자에게 전달할 후보 생성, 우선정렬, fallback 구조입니다.',
    color: C.orange,
  },
]

export default function DashboardPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      <TopBar />
      <KpiStrip />

      <section
        style={{
          position: 'relative',
          minHeight: 'calc(100vh - 126px)',
          borderTop: `1px solid ${C.line}`,
          background:
            'radial-gradient(circle at 48% 40%, rgba(34,211,238,.12), transparent 24%), linear-gradient(135deg, rgba(10,18,32,.92), rgba(8,12,24,.98))',
        }}
      >
        <MapGrid />
        <LeftPanel />
        <CenterMission />
        <RightPanel />
        <BottomDock />
      </section>
    </main>
  )
}

function TopBar() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 80,
        height: 56,
        background: C.top,
        borderBottom: `1px solid ${C.line}`,
        display: 'grid',
        gridTemplateColumns: '270px 1fr 260px',
        alignItems: 'center',
        padding: '0 20px',
        gap: 18,
      }}
    >
      <Link href="/ingest" style={{ color: C.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            border: `1px solid ${C.cyan}`,
            background: 'rgba(34,211,238,.14)',
            color: C.cyan,
            fontWeight: 950,
          }}
        >
          PM
        </span>
        <span style={{ fontSize: 16, fontWeight: 950 }}>
          KONAMOBILITY <span style={{ color: C.cyan }}>AI Dispatch</span>
        </span>
      </Link>
      <nav style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {nav.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            style={{
              color: C.sub,
              textDecoration: 'none',
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: '8px 13px',
              fontSize: 14,
              fontWeight: 850,
              background: 'rgba(15,22,40,.72)',
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
        <Badge>LIVE PREP</Badge>
        <Badge color={C.green}>BUILD OK</Badge>
      </div>
    </header>
  )
}

function KpiStrip() {
  return (
    <section style={{ height: 70, background: '#090D17', borderBottom: `1px solid ${C.line}`, display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)` }}>
      {kpis.map((kpi) => (
        <div key={kpi.label} style={{ borderRight: `1px solid ${C.line}`, padding: '10px 18px', display: 'grid', alignContent: 'center' }}>
          <div style={{ color: C.muted, fontSize: 13, fontWeight: 850 }}>{kpi.label}</div>
          <div style={{ color: kpi.color, fontSize: 28, lineHeight: 1, fontWeight: 950, marginTop: 3 }}>{kpi.value}</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{kpi.sub}</div>
        </div>
      ))}
    </section>
  )
}

function MapGrid() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.72 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)',
          backgroundSize: '58px 58px',
        }}
      />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path d="M6 74 C22 62 28 38 44 48 S66 78 92 24" stroke="rgba(34,211,238,.25)" strokeWidth=".35" fill="none" />
        <path d="M10 34 C30 22 58 28 86 70" stroke="rgba(16,185,129,.18)" strokeWidth=".4" fill="none" />
        <path d="M34 10 L68 88" stroke="rgba(139,92,246,.18)" strokeWidth=".25" fill="none" />
        {[
          [48, 48, 6, C.cyan],
          [30, 38, 3, C.green],
          [67, 35, 4, C.purple],
          [74, 66, 3, C.orange],
          [18, 68, 2.4, C.yellow],
        ].map(([x, y, r, color], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={`${color}22`} stroke={`${color}88`} strokeWidth=".35" />
        ))}
      </svg>
    </div>
  )
}

function LeftPanel() {
  return (
    <aside
      style={{
        position: 'absolute',
        left: 18,
        top: 18,
        bottom: 18,
        width: 310,
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: 18,
        boxShadow: '0 20px 60px rgba(0,0,0,.28)',
      }}
    >
      <div style={{ color: C.sub, fontSize: 15, fontWeight: 950, letterSpacing: '.08em' }}>CRITICAL PATH</div>
      <div style={{ height: 1, background: C.line, margin: '12px 0 16px' }} />
      <div style={{ display: 'grid', gap: 12 }}>
        {flow.map((item) => (
          <Link key={item.href} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: '#0B1222', padding: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: item.color, fontSize: 15, fontWeight: 950 }}>{item.no}</span>
                <span style={{ color: item.color, fontSize: 12, fontWeight: 950 }}>OPEN</span>
              </div>
              <div style={{ color: C.text, fontSize: 18, fontWeight: 950, marginTop: 8 }}>{item.title}</div>
              <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.45, margin: '7px 0 0' }}>{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </aside>
  )
}

function CenterMission() {
  return (
    <section style={{ position: 'absolute', left: 354, right: 360, top: 54, bottom: 122, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
      <div style={{ width: 'min(620px, 100%)', border: `1px solid ${C.line}`, borderRadius: 18, background: 'rgba(8,12,24,.72)', padding: 28, boxShadow: '0 30px 90px rgba(0,0,0,.32)' }}>
        <div style={{ color: C.cyan, fontSize: 15, fontWeight: 950, letterSpacing: '.08em' }}>MISSION</div>
        <h1 style={{ fontSize: 42, lineHeight: 1.1, margin: '12px 0 0', fontWeight: 950 }}>
          콜카드와 기사 능력치를 연결해 AI 우선배차를 설명한다
        </h1>
        <p style={{ color: C.sub, fontSize: 18, lineHeight: 1.55, margin: '16px 0 0' }}>
          기존 배차 엔진은 유지합니다. 콜 발생 시 후보 기사군을 22D 코사인 유사도 기준으로 다시 정렬하고, 가장 잘 맞는 기사에게 먼저 콜카드를 보냅니다.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 22 }}>
          <Mini title="Grab" desc="결과 비교" color={C.purple} />
          <Mini title="Uber" desc="후보/반경" color={C.cyan} />
          <Mini title="DiDi" desc="누적성향" color={C.green} />
        </div>
      </div>
    </section>
  )
}

function RightPanel() {
  return (
    <aside style={{ position: 'absolute', right: 18, top: 18, bottom: 18, width: 318, display: 'grid', gridTemplateRows: '1fr auto', gap: 14 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 }}>
        <div style={{ color: C.sub, fontSize: 15, fontWeight: 950, letterSpacing: '.08em' }}>CONTROL NOTES</div>
        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <Note tone={C.green} title="보여줄 것" desc="날짜 범위, 콜 조건, 기사 능력치, 유사도, 우선 발송 순서" />
          <Note tone={C.red} title="숨길 것" desc="긴 JSON, 내부 테이블 반복, 확정되지 않은 최종 배차점수" />
          <Note tone={C.yellow} title="주의" desc="실시간 위치/온라인 상태는 아직 실제 배차점수에 섞지 않음" />
        </div>
      </div>
      <Link href="/vectors" style={{ textDecoration: 'none', color: C.text }}>
        <div style={{ border: `1px solid ${C.cyan}`, background: 'rgba(34,211,238,.14)', borderRadius: 14, padding: 18 }}>
          <div style={{ color: C.cyan, fontSize: 14, fontWeight: 950 }}>NEXT</div>
          <div style={{ fontSize: 22, fontWeight: 950, marginTop: 7 }}>인터랙티브 벡터 매칭 보기</div>
        </div>
      </Link>
    </aside>
  )
}

function BottomDock() {
  return (
    <section
      style={{
        position: 'absolute',
        left: 354,
        right: 360,
        bottom: 18,
        minHeight: 86,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        background: 'linear-gradient(90deg, rgba(15,22,40,.96), rgba(15,22,40,.74))',
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
      }}
    >
      <DockItem title="Data" value="적재현황" href="/ingest" color={C.green} />
      <DockItem title="Vector" value="매칭 그래프" href="/vectors" color={C.cyan} />
      <DockItem title="Sim" value="조건 입력" href="/simulator" color={C.purple} />
      <DockItem title="Logic" value="개발 전달" href="/dispatch-logic" color={C.orange} />
    </section>
  )
}

function DockItem({ title, value, href, color }: { title: string; value: string; href: string; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ height: '100%', border: `1px solid ${C.line}`, borderRadius: 10, background: '#0B1222', padding: 12 }}>
        <div style={{ color: C.muted, fontSize: 12, fontWeight: 850 }}>{title}</div>
        <div style={{ color, fontSize: 18, fontWeight: 950, marginTop: 5 }}>{value}</div>
      </div>
    </Link>
  )
}

function Badge({ children, color = C.cyan }: { children: ReactNode; color?: string }) {
  return <span style={{ border: `1px solid ${color}66`, color, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 950, background: `${color}18` }}>{children}</span>
}

function Mini({ title, desc, color }: { title: string; desc: string; color: string }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: '#0B1222', padding: 12 }}>
      <div style={{ color, fontSize: 18, fontWeight: 950 }}>{title}</div>
      <div style={{ color: C.sub, fontSize: 14, marginTop: 5 }}>{desc}</div>
    </div>
  )
}

function Note({ tone, title, desc }: { tone: string; title: string; desc: string }) {
  return (
    <div style={{ borderLeft: `3px solid ${tone}`, background: '#0B1222', padding: '12px 13px', borderRadius: 8 }}>
      <div style={{ color: tone, fontSize: 16, fontWeight: 950 }}>{title}</div>
      <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.45, margin: '6px 0 0' }}>{desc}</p>
    </div>
  )
}

import Link from 'next/link'

export const ui = {
  bg: '#080C18',
  panel: '#0F1628',
  panel2: '#111A2E',
  border: '#1E2D4A',
  text: '#F1F5F9',
  sub: '#A9B7CC',
  muted: '#6C7D99',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  orange: '#FB923C',
  red: '#F43F5E',
}

const navItems = [
  { label: '대시보드', href: '/dashboard', desc: '전체 흐름' },
  { label: '적재현황', href: '/ingest', desc: '데이터 범위' },
  { label: '벡터리스트', href: '/vectors', desc: '팩터 매칭' },
  { label: '시뮬레이터', href: '/simulator', desc: '추천 검증' },
  { label: '배차로직', href: '/dispatch-logic', desc: '개발 전달' },
]

const accentByPage: Record<string, string> = {
  대시보드: ui.cyan,
  적재현황: ui.green,
  벡터리스트: ui.cyan,
  시뮬레이터: ui.purple,
  배차로직: ui.orange,
}

export function PmoShell({
  active,
  kicker,
  title,
  description,
  children,
  status = '실데이터 검증 중',
}: {
  active: string
  kicker: string
  title: string
  description: string
  children: React.ReactNode
  status?: string
}) {
  const accent = accentByPage[active] ?? ui.cyan

  return (
    <main style={{ minHeight: '100vh', background: ui.bg, color: ui.text, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 20% 0%, rgba(34,211,238,.08), transparent 34%), radial-gradient(circle at 80% 12%, rgba(139,92,246,.08), transparent 30%)' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 20, borderBottom: `1px solid ${ui.border}`, background: 'rgba(8,12,24,.94)', backdropFilter: 'blur(18px)' }}>
          <div style={{ maxWidth: 1480, margin: '0 auto', height: 62, padding: '0 24px', display: 'grid', gridTemplateColumns: '250px 1fr 220px', alignItems: 'center', gap: 18 }}>
            <Link href="/dashboard" style={{ color: ui.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${accent}`, background: `${accent}22`, display: 'grid', placeItems: 'center', color: accent, fontWeight: 950 }}>KM</span>
              <span>
                <span style={{ display: 'block', fontSize: 20, fontWeight: 950 }}>KONAMOBILITY</span>
                <span style={{ display: 'block', color: ui.muted, fontSize: 18, marginTop: 2 }}>AI Dispatch Lab</span>
              </span>
            </Link>

            <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
              {navItems.map((item) => {
                const on = item.label === active
                return (
                  <Link key={item.href} href={item.href} style={{ minHeight: 42, border: `1px solid ${on ? accent : ui.border}`, borderRadius: 8, background: on ? `${accent}1F` : 'rgba(15,22,40,.72)', color: on ? ui.text : ui.sub, textDecoration: 'none', padding: '6px 10px', display: 'grid', alignContent: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 950, lineHeight: 1.1 }}>{item.label}</span>
                    <span style={{ fontSize: 18, color: on ? accent : ui.muted, marginTop: 3 }}>{item.desc}</span>
                  </Link>
                )
              })}
            </nav>

            <div style={{ justifySelf: 'end', border: `1px solid ${ui.border}`, borderRadius: 8, padding: '8px 12px', background: 'rgba(15,22,40,.72)', minWidth: 190 }}>
              <div style={{ color: ui.muted, fontSize: 12, fontWeight: 850 }}>현재 단계</div>
              <div style={{ color: accent, fontSize: 18, fontWeight: 950, marginTop: 2 }}>{status}</div>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 1480, margin: '0 auto', padding: '30px 28px 46px' }}>
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'end', marginBottom: 24 }}>
            <div>
              <div style={{ color: accent, fontSize: 18, fontWeight: 950, letterSpacing: '.03em', marginBottom: 10 }}>{kicker}</div>
              <h1 style={{ fontSize: 40, lineHeight: 1.12, margin: 0, fontWeight: 950, letterSpacing: 0 }}>{title}</h1>
              <p style={{ color: ui.sub, fontSize: 18, lineHeight: 1.6, margin: '12px 0 0', maxWidth: 920 }}>{description}</p>
            </div>
            <div style={{ border: `1px solid ${ui.border}`, borderRadius: 8, padding: 16, background: 'rgba(15,22,40,.78)' }}>
              <div style={{ color: ui.muted, fontSize: 18, fontWeight: 850 }}>화면 사용 원칙</div>
              <div style={{ color: ui.text, fontSize: 18, fontWeight: 950, marginTop: 8 }}>핵심 판단만 먼저</div>
              <p style={{ color: ui.sub, fontSize: 15, lineHeight: 1.5, margin: '8px 0 0' }}>
                상세 계산식은 필요할 때만 아래에서 확인하고, 첫 화면에서는 지금 무엇을 결정해야 하는지부터 봅니다.
              </p>
            </div>
          </section>
          {children}
        </div>
      </div>
    </main>
  )
}

export function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: ui.panel, border: `1px solid ${ui.border}`, borderRadius: 8, padding: 22, minWidth: 0 }}>
      <h2 style={{ fontSize: 24, margin: 0, fontWeight: 950, lineHeight: 1.2 }}>{title}</h2>
      {desc && <p style={{ color: ui.sub, fontSize: 20, lineHeight: 1.55, margin: '8px 0 16px' }}>{desc}</p>}
      {children}
    </section>
  )
}

export function InsightCard({ tone, title, value, desc }: { tone: string; title: string; value: string; desc: string }) {
  return (
    <div style={{ background: ui.panel, border: `1px solid ${ui.border}`, borderRadius: 8, padding: 20, minHeight: 146 }}>
      <div style={{ color: ui.sub, fontSize: 18, fontWeight: 850 }}>{title}</div>
      <div style={{ color: tone, fontSize: 34, fontWeight: 950, lineHeight: 1.05, marginTop: 12 }}>{value}</div>
      <div style={{ color: ui.muted, fontSize: 15, lineHeight: 1.45, marginTop: 10 }}>{desc}</div>
    </div>
  )
}

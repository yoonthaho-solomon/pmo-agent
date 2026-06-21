import type { CSSProperties } from 'react'

// ---- Static data from dc.html ----
const DAYS_COUNT = 26
const METER_START = 17 // 06-08 is index 17 from 05-22

function buildCalendarRows() {
  const G  = { bg: '#2f8f64', border: '1px solid rgba(74,222,128,.35)' }
  const Gs = { bg: '#256a4c', border: '1px solid rgba(74,222,128,.22)' }
  const A  = { bg: '#9c7526', border: '1px solid rgba(251,191,36,.35)' }
  const N  = { bg: 'rgba(148,163,184,.12)', border: '1px solid rgba(148,163,184,.1)' }

  const days = Array.from({ length: DAYS_COUNT }, (_, i) => {
    const d = new Date(2026, 4, 22)
    d.setDate(d.getDate() + i)
    return { mm: String(d.getMonth() + 1).padStart(2, '0'), dd: String(d.getDate()).padStart(2, '0') }
  })

  const callCells = days.map((d, i) => {
    const high = i % 7 !== 5 && i % 7 !== 6
    const c = high ? G : Gs
    return { bg: c.bg, border: c.border, title: `${d.mm}-${d.dd} 호출 ${(high ? 16 : 9) + (i % 5)}K건` }
  })
  const meterCells = days.map((d, i) => {
    if (i < METER_START) return { bg: N.bg, border: N.border, title: `${d.mm}-${d.dd} 앱미터 상세 미지원` }
    return { bg: A.bg, border: A.border, title: `${d.mm}-${d.dd} 앱미터 ${18 + (i - METER_START) * 2}건` }
  })
  const matchCells = days.map((d, i) => {
    if (i < METER_START) return { bg: Gs.bg, border: Gs.border, title: `${d.mm}-${d.dd} 매칭 (호출 기반)` }
    return { bg: G.bg, border: G.border, title: `${d.mm}-${d.dd} 매칭 (호출+앱미터)` }
  })

  return [
    { name: '호출데이터',   sub: 'calls',    cells: callCells },
    { name: '앱미터데이터', sub: 'app_meter', cells: meterCells },
    { name: '매칭 결과',   sub: 'matches',  cells: matchCells },
  ]
}

const CAL_ROWS = buildCalendarRows()

const CATALOG = [
  { table: 'calls',          desc: '승객 호출 원천 로그',    range: '05-22 ~ 06-16',  rows: '348,030',   detail: '지원',   detailColor: '#7ee0a3', status: '있음', stColor: '#7ee0a3', stBg: 'rgba(74,222,128,.12)' },
  { table: 'app_meter',      desc: '기사 앱미터 운행 로그',  range: '06-08 ~ 06-16',  rows: '192',       detail: '미지원', detailColor: '#fbbf24', status: '부분', stColor: '#fbd77a', stBg: 'rgba(251,191,36,.12)' },
  { table: 'driver_vectors', desc: 'driver_mbti 22D 임베딩', range: '스냅샷 06-16',   rows: '10,267',    detail: '지원',   detailColor: '#7ee0a3', status: '있음', stColor: '#c3acff', stBg: 'rgba(167,139,250,.14)' },
  { table: 'matches',        desc: '콜카드별 Top 10 결과',   range: '05-22 ~ 06-16',  rows: '4,860,785', detail: '지원',   detailColor: '#7ee0a3', status: '있음', stColor: '#7ee0a3', stBg: 'rgba(74,222,128,.12)' },
]

const READINESS = [
  { icon: '✓', iconBg: 'rgba(74,222,128,.14)',   iconColor: '#7ee0a3', label: '호출 데이터',  note: '26일 연속 적재 확인',      tag: '준비됨', tagColor: '#7ee0a3' },
  { icon: '!', iconBg: 'rgba(251,191,36,.16)',   iconColor: '#fbd77a', label: '앱미터 데이터', note: '9일 · 날짜별 상세 미지원',  tag: '부분',   tagColor: '#fbd77a' },
  { icon: '✓', iconBg: 'rgba(167,139,250,.16)', iconColor: '#c3acff', label: '기사 벡터',    note: '10,267명 · 22D 생성',       tag: '준비됨', tagColor: '#c3acff' },
  { icon: '✓', iconBg: 'rgba(74,222,128,.14)',   iconColor: '#7ee0a3', label: '매칭 결과',   note: 'Top 10 저장 완료',           tag: '준비됨', tagColor: '#7ee0a3' },
]

// ---- Component ----
export function DataOpsView() {
  return (
    <div style={{ maxWidth: '1560px', margin: '0 auto', padding: '22px 22px 32px' }}>
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <h1 style={{ fontSize: '27px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>데이터 운영 콘솔</h1>
          <p style={{ fontSize: '14px', color: '#8b98ae', margin: 0 }}>AI 우선배차 검증에 필요한 데이터가 어디까지 적재됐는가</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#7ee0a3', background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.22)', borderRadius: '9px', padding: '8px 13px', flexShrink: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', display: 'inline-block', flexShrink: 0 }} />
          마지막 적재 확인 · 06-16 04:12 KST
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '16px' }}>
        <KpiCard
          dot={{ borderRadius: '2px', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }}
          label="호출데이터" value="348,030" unit=" 건"
          range="05-22 ~ 06-16" status="26일 · 연속" statusColor="#7ee0a3"
          cardBorder="rgba(148,163,184,.13)"
        />
        <KpiCard
          dot={{ borderRadius: '2px', background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }}
          label="앱미터데이터" value="192" unit=" 건"
          range="06-08 ~ 06-16" status="9일 · 부분" statusColor="#fbbf24"
          cardBorder="rgba(251,191,36,.22)"
        />
        <KpiCard
          dot={{ borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa' }}
          label="기사 벡터" value="10,267" unit=" 명"
          range="driver_mbti 22D" status="생성 완료" statusColor="#c3acff"
          cardBorder="rgba(167,139,250,.22)"
        />
        <KpiCard
          dot={{ borderRadius: '2px', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }}
          label="매칭 결과" value="4,860,785" unit=" 건"
          range="Top 10 / 콜카드" status="저장 완료" statusColor="#7ee0a3"
          cardBorder="rgba(148,163,184,.13)"
        />
      </div>

      {/* Main 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 372px', gap: '13px', alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
          {/* Calendar heatmap */}
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>날짜별 연결 상태</h2>
                <span style={{ fontSize: '12px', color: '#8b98ae' }}>호출 · 앱미터 · 매칭 데이터가 날짜별로 연결되는지</span>
              </div>
              <div style={{ display: 'flex', gap: '13px' }}>
                <LegendDot color="#3ba776" label="있음" />
                <LegendDot color="#b78a2e" label="부분" />
                <LegendDot color="rgba(148,163,184,.18)" label="상세 미지원" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {CAL_ROWS.map((row) => (
                <div key={row.sub} style={{ display: 'grid', gridTemplateColumns: '104px 1fr', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#dbe3f0' }}>{row.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: '#7c89a0' }}>{row.sub}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {row.cells.map((cell, i) => (
                      <div key={i} title={cell.title} style={{ flex: 1, height: '30px', borderRadius: '4px', background: cell.bg, border: cell.border }} />
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: '12px', marginTop: '2px' }}>
                <span />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: '#6b778d' }}>
                  <span>05-22</span><span>05-28</span><span>06-03</span><span>06-09</span><span>06-16</span>
                </div>
              </div>
            </div>
          </section>

          {/* Data catalog */}
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>데이터 소스 카탈로그</h2>
              <span style={{ fontSize: '11px', color: '#7c89a0' }}>Supabase · 4 테이블</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.9fr 0.8fr', gap: '8px', padding: '0 4px 10px', borderBottom: '1px solid rgba(148,163,184,.1)' }}>
              {(['테이블', '적재 범위', '행 수', '날짜별 상세', '상태'] as const).map((h, i) => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#7c89a0', textAlign: i >= 2 ? 'center' : 'left' }}>{h}</span>
              ))}
            </div>
            {CATALOG.map((t) => (
              <div key={t.table} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.9fr 0.8fr', gap: '8px', alignItems: 'center', padding: '11px 4px', borderBottom: '1px solid rgba(148,163,184,.06)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 600, color: '#dbe3f0' }}>{t.table}</span>
                  <span style={{ fontSize: '11px', color: '#7c89a0' }}>{t.desc}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#9aa7bd' }}>{t.range}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 600, color: '#e8edf6', textAlign: 'right' }}>{t.rows}</span>
                <span style={{ textAlign: 'center', fontSize: '12px', color: t.detailColor }}>{t.detail}</span>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: t.stColor, background: t.stBg, borderRadius: '6px', padding: '4px 9px' }}>{t.status}</span>
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* Right: readiness + amber warning */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '13px', position: 'sticky', top: '78px' }}>
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>매칭 준비 상태</h2>
            <p style={{ fontSize: '12px', color: '#8b98ae', marginBottom: '16px' }}>적재 확인과 정상 완료는 다르다</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {READINESS.map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '30px', height: '30px', flexShrink: 0, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.iconBg, color: r.iconColor, fontSize: '14px', fontWeight: 700 }}>{r.icon}</span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#dbe3f0' }}>{r.label}</span>
                    <span style={{ fontSize: '11px', color: '#7c89a0' }}>{r.note}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: r.tagColor }}>{r.tag}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ borderRadius: '18px', background: 'rgba(20,16,10,.6)', border: '1px solid rgba(251,191,36,.24)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(251,191,36,.16)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>!</span>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fbd77a', margin: 0 }}>확인 필요</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8edf6' }}>앱미터 날짜별 상세 미지원</span>
                <span style={{ fontSize: '12px', color: '#9aa7bd' }}>06-08 이전 9일 구간은 날짜별 건수를 분해할 수 없음. 정상 완료로 표시하지 않음.</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(251,191,36,.14)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8edf6' }}>앱미터 적재량 192건</span>
                <span style={{ fontSize: '12px', color: '#9aa7bd' }}>호출 348K 대비 표본이 작음. 검증 결과 해석 시 주의.</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

// ---- Subcomponents ----
function KpiCard({ dot, label, value, unit, range, status, statusColor, cardBorder }: {
  dot: CSSProperties; label: string; value: string; unit: string
  range: string; status: string; statusColor: string; cardBorder: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '17px 19px', borderRadius: '16px', background: 'rgba(10,15,25,.7)', border: `1px solid ${cardBorder}`, boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', display: 'inline-block', flexShrink: 0, ...dot }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9aa7bd' }}>{label}</span>
      </div>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '33px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}<span style={{ fontSize: '13px', color: '#8b98ae', fontWeight: 500 }}>{unit}</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#8b98ae' }}>{range}</span>
        <span style={{ fontSize: '11px', color: statusColor, fontWeight: 600 }}>{status}</span>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontSize: '11px', color: '#9aa7bd' }}>{label}</span>
    </div>
  )
}

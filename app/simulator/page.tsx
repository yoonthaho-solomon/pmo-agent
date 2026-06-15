'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { callToVector, cosineSimilarity, driverToVector, type DriverVectorRow } from '@/lib/matching-vector'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DriverRow = DriverVectorRow & {
  driver_id: string
  asp_id: number
  reliability: number | null
  data_days: number | null
}

const C = {
  bg: '#080C18',
  panel: '#0F1628',
  border: '#1E2D4A',
  text: '#F1F5F9',
  sub: '#A9B7CC',
  muted: '#6C7D99',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

export default function SimulatorPage() {
  const [aspId, setAspId] = useState(137000000000)
  const [hour, setHour] = useState(18)
  const [weekday, setWeekday] = useState(4)
  const [distance, setDistance] = useState(2500)
  const [fare, setFare] = useState(9000)
  const [paid, setPaid] = useState(false)
  const [surge, setSurge] = useState(false)
  const [eta, setEta] = useState(240)
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('driver_mbti').select('*').eq('asp_id', aspId).order('reliability', { ascending: false }).limit(3000)
      if (!cancelled) {
        setDrivers((data ?? []) as DriverRow[])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [aspId])

  const callVector = callToVector({
    hour_slot: hour,
    weekday,
    expected_distance: distance,
    expected_fare: fare,
    is_paid: paid,
    is_surge: surge,
    eta_distance: eta,
  })

  const ranked = useMemo(() => drivers
    .map((driver) => {
      const cosine = cosineSimilarity(callVector, driverToVector(driver))
      const reliability = driver.reliability ?? 0
      const previewScore = cosine * 0.85 + reliability * 0.15
      return { driver, cosine, reliability, previewScore }
    })
    .sort((a, b) => b.cosine - a.cosine)
    .slice(0, 10), [drivers, callVector])

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '30px 28px 46px' }}>
        <TopNav active="시뮬레이터" />
        <header style={{ margin: '22px 0 24px' }}>
          <h1 style={{ fontSize: 36, margin: 0, fontWeight: 950 }}>시뮬레이터</h1>
          <p style={{ color: C.sub, fontSize: 18, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 960 }}>
            콜카드 조건을 입력하면 현재 누적된 기사 22D 벡터 중 코사인 유사도가 높은 기사 Top 10을 보여줍니다.
            실시간 위치와 온라인 상태는 아직 배차 점수에 섞지 않습니다.
          </p>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: '390px 1fr', gap: 18 }}>
          <Panel title="콜카드 조건 입력" desc="현재 버전은 22D 코사인 유사도 검증에 집중합니다.">
            <div style={{ display: 'grid', gap: 12 }}>
              <Label title="지역">
                <select value={aspId} onChange={(e) => setAspId(Number(e.target.value))} style={input()}>
                  <option value={137000000000}>인천 137</option>
                  <option value={147000000000}>천안 147</option>
                  <option value={160000000000}>부산 160</option>
                </select>
              </Label>
              <Label title="요청 시간">
                <input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} style={input()} />
              </Label>
              <Label title="요일">
                <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} style={input()}>
                  {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </Label>
              <Label title="예상거리 m">
                <input type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value))} style={input()} />
              </Label>
              <Label title="예상요금 원">
                <input type="number" value={fare} onChange={(e) => setFare(Number(e.target.value))} style={input()} />
              </Label>
              <Label title="ETA 초">
                <input type="number" value={eta} onChange={(e) => setEta(Number(e.target.value))} style={input()} />
              </Label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: C.sub, fontSize: 16, fontWeight: 850 }}>
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> 유료콜
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: C.sub, fontSize: 16, fontWeight: 850 }}>
                <input type="checkbox" checked={surge} onChange={(e) => setSurge(e.target.checked)} /> 탄력/할증
              </label>
            </div>
          </Panel>

          <Panel title="추천 기사 Top 10" desc="정렬 기준은 cosine_similarity(call_vector, driver_vector)입니다. final score는 아직 확정 배차점수가 아니라 참고용입니다.">
            {loading && <div style={{ color: C.sub }}>기사 벡터를 불러오는 중입니다.</div>}
            <div style={{ display: 'grid', gap: 10 }}>
              {ranked.map((row, index) => (
                <div key={row.driver.driver_id} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 110px 110px 110px', gap: 12, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 8, padding: 13, background: '#0B1222' }}>
                  <strong style={{ color: index < 3 ? C.yellow : C.sub, fontSize: 19 }}>{index + 1}</strong>
                  <span style={{ fontFamily: 'monospace', fontWeight: 850 }}>{row.driver.driver_id}</span>
                  <span style={{ color: C.cyan, fontWeight: 950 }}>{pct(row.cosine)}</span>
                  <span style={{ color: C.green, fontWeight: 900 }}>{pct(row.reliability)}</span>
                  <span style={{ color: C.purple, fontWeight: 950 }}>{pct(row.previewScore)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <Panel title="아직 시뮬레이션 데이터로만 표시되는 항목" desc="이 항목들은 실제 배차로직에 섞지 않고, 개발자에게 필요한 데이터 구조로만 분리합니다.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {['기사 실시간 위치', '온라인 상태', '공차 상태', '콜 수신 가능 여부'].map((item) => (
              <div key={item} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: '#0B1222', color: C.sub, fontWeight: 900 }}>{item}</div>
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
        <Link key={href} href={href} style={{ color: label === active ? C.text : C.sub, border: `1px solid ${label === active ? C.purple : C.border}`, background: label === active ? 'rgba(139,92,246,.16)' : 'transparent', borderRadius: 8, padding: '9px 12px', textDecoration: 'none', fontWeight: 900 }}>
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

function Label({ title, children }: { title: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 7, color: C.sub, fontSize: 15, fontWeight: 850 }}>{title}{children}</label>
}

function input(): React.CSSProperties {
  return { width: '100%', height: 42, borderRadius: 8, border: `1px solid ${C.border}`, background: '#0B1222', color: C.text, padding: '0 10px', fontSize: 16 }
}

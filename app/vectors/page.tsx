'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { VECTOR_DIMENSIONS, callToVector, cosineSimilarity, driverToVector, type DriverVectorRow } from '@/lib/matching-vector'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type CallRow = {
  callcard_id: string
  asp_id: number
  call_date: string
  hour_slot: number
  weekday: number
  expected_distance: number
  expected_fare: number
  is_paid: boolean
  is_surge: boolean
  eta_distance: number | null
  product_type: string | null
}

type DriverRow = DriverVectorRow & {
  driver_id: string
  asp_id: number
  data_days: number | null
  reliability: number | null
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

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString()
}

export default function VectorsPage() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [selectedCallId, setSelectedCallId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [callRes, driverRes] = await Promise.all([
        supabase
          .from('callcard_mbti')
          .select('callcard_id,asp_id,call_date,hour_slot,weekday,expected_distance,expected_fare,is_paid,is_surge,eta_distance,product_type')
          .order('call_date', { ascending: false })
          .limit(30),
        supabase
          .from('driver_mbti')
          .select('*')
          .order('reliability', { ascending: false })
          .limit(500),
      ])
      if (cancelled) return
      const nextCalls = (callRes.data ?? []) as CallRow[]
      setCalls(nextCalls)
      setDrivers((driverRes.data ?? []) as DriverRow[])
      setSelectedCallId(nextCalls[0]?.callcard_id ?? '')
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedCall = calls.find((row) => row.callcard_id === selectedCallId) ?? calls[0]
  const callVector = selectedCall ? callToVector(selectedCall) : []
  const ranked = useMemo(() => {
    if (!selectedCall) return []
    return drivers
      .filter((driver) => driver.asp_id === selectedCall.asp_id)
      .map((driver) => ({
        driver,
        vector: driverToVector(driver),
        cosine: cosineSimilarity(callVector, driverToVector(driver)),
      }))
      .sort((a, b) => b.cosine - a.cosine)
      .slice(0, 10)
  }, [drivers, selectedCall, callVector])

  const topDriver = ranked[0]

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '30px 28px 46px' }}>
        <TopNav active="벡터리스트" />
        <header style={{ margin: '22px 0 24px' }}>
          <h1 style={{ fontSize: 36, margin: 0, fontWeight: 950 }}>벡터리스트</h1>
          <p style={{ color: C.sub, fontSize: 18, lineHeight: 1.6, margin: '10px 0 0' }}>
            콜카드 정보와 기사 누적 패턴을 같은 22차원 팩터로 변환하고, 코사인 유사도로 가장 잘 맞는 기사 후보를 확인합니다.
          </p>
        </header>

        {loading && <div style={{ color: C.sub, fontSize: 18 }}>벡터 데이터를 불러오는 중입니다.</div>}

        <section style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18 }}>
          <Panel title="콜카드 선택" desc="최근 콜카드 중 하나를 선택하면 22D 콜 벡터와 기사 유사도가 계산됩니다.">
            <select value={selectedCallId} onChange={(event) => setSelectedCallId(event.target.value)} style={{ width: '100%', height: 44, borderRadius: 8, border: `1px solid ${C.border}`, background: '#0B1222', color: C.text, padding: '0 10px', fontSize: 16 }}>
              {calls.map((call) => (
                <option key={call.callcard_id} value={call.callcard_id}>
                  {call.call_date} / {call.callcard_id}
                </option>
              ))}
            </select>

            {selectedCall && (
              <div style={{ display: 'grid', gap: 9, marginTop: 16, color: C.sub, fontSize: 16 }}>
                <Line label="ASP" value={String(selectedCall.asp_id)} />
                <Line label="시간/요일" value={`${selectedCall.hour_slot}시 / ${selectedCall.weekday}`} />
                <Line label="예상거리" value={`${fmt(selectedCall.expected_distance)}m`} />
                <Line label="예상요금" value={`${fmt(selectedCall.expected_fare)}원`} />
                <Line label="유료/탄력" value={`${selectedCall.is_paid ? '유료콜' : '무료콜'} / ${selectedCall.is_surge ? '탄력' : '일반'}`} />
              </div>
            )}
          </Panel>

          <Panel title="콜카드 22D 팩터" desc="현재 코드는 lib/matching-vector.ts의 VECTOR_DIMENSIONS 순서를 그대로 사용합니다.">
            <VectorGrid values={callVector} />
          </Panel>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
          <Panel title="코사인 유사도 Top 10" desc="선택한 콜카드와 같은 ASP의 기사 벡터를 비교한 결과입니다.">
            <div style={{ display: 'grid', gap: 10 }}>
              {ranked.map((row, index) => (
                <div key={row.driver.driver_id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 86px 86px', gap: 12, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, background: '#0B1222' }}>
                  <strong style={{ color: index < 3 ? C.yellow : C.sub, fontSize: 18 }}>{index + 1}</strong>
                  <span style={{ fontFamily: 'monospace', fontWeight: 850 }}>{row.driver.driver_id}</span>
                  <span style={{ color: C.cyan, fontWeight: 950 }}>{pct(row.cosine)}</span>
                  <span style={{ color: C.sub }}>{pct(row.driver.reliability ?? 0)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Top 1 기사 팩터" desc="가장 높은 유사도를 가진 기사의 22D 누적 성향입니다.">
            {topDriver ? <VectorGrid values={topDriver.vector} /> : <div style={{ color: C.muted }}>기사 후보가 없습니다.</div>}
          </Panel>
        </section>
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
        <Link key={href} href={href} style={{ color: label === active ? C.text : C.sub, border: `1px solid ${label === active ? C.cyan : C.border}`, background: label === active ? 'rgba(34,211,238,.16)' : 'transparent', borderRadius: 8, padding: '9px 12px', textDecoration: 'none', fontWeight: 900 }}>
          {label}
        </Link>
      ))}
    </nav>
  )
}

function Panel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
      <h2 style={{ fontSize: 23, margin: 0, fontWeight: 950 }}>{title}</h2>
      <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, margin: '8px 0 16px' }}>{desc}</p>
      {children}
    </section>
  )
}

function VectorGrid({ values }: { values: number[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      {VECTOR_DIMENSIONS.map((dim, index) => {
        const value = values[index] ?? 0
        return (
          <div key={dim.key} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 52px', gap: 10, alignItems: 'center' }}>
            <span style={{ color: C.sub, fontSize: 15, fontWeight: 850 }}>{dim.label}</span>
            <div style={{ height: 9, background: '#1A263D', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(1, value) * 100}%`, height: '100%', background: dim.group === '시간대' ? C.cyan : dim.group === '요일' ? C.purple : C.green }} />
            </div>
            <span style={{ color: C.muted, fontSize: 14, textAlign: 'right' }}>{pct(value)}</span>
          </div>
        )
      })}
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{label}</span>
      <strong style={{ color: C.text, textAlign: 'right' }}>{value}</strong>
    </div>
  )
}

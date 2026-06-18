'use client'

import { PrimaryNav } from '@/app/components/PrimaryNav'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  VECTOR_DIMENSIONS,
  callToVector,
  cosineSimilarity,
  driverToVector,
  type DriverVectorRow,
} from '@/lib/matching-vector'
import { DISPLAY_AXES, vectorToDisplayAxisBundle } from '@/lib/matching-display-axis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'preview-build-key',
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

type RankedDriver = {
  driver: DriverRow
  vector: number[]
  cosine: number
  grade: string
}

const C = {
  bg: '#050810',
  panel: 'rgba(10, 16, 29, 0.88)',
  panel2: 'rgba(15, 23, 42, 0.72)',
  ink: '#F8FAFC',
  sub: '#B8C7DE',
  muted: '#8290A8',
  line: 'rgba(148, 163, 184, 0.22)',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#FB923C',
  red: '#F43F5E',
  purple: '#8B5CF6',
} as const

const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']
const axisNames = ['픽업 접근성', '시간대 적합도', '요일 적합도', '운행거리 적합도', '수익·상품 적합도']
const axisColors = [C.cyan, C.purple, C.green, C.orange, C.yellow] as const

const factorDescriptions: Record<string, string> = {
  시간대: '콜이 발생한 시간대와 기사가 자주 수락한 시간대가 맞는지 봅니다.',
  요일: '콜의 요일과 기사 누적 운행 패턴의 요일 성향을 비교합니다.',
  거리: '예상 운행거리가 기사에게 익숙한 거리 구간인지 봅니다.',
  요금: '예상요금이 기사 수락 패턴과 맞는지 비교합니다.',
  콜유형: '유료콜과 무료콜 선호 차이를 반영합니다.',
  상품: '탄력 또는 일반 상품 성향을 구분합니다.',
  ETA: '승객 위치까지 접근성이 좋은 조건인지 보조로 봅니다.',
}

function pct(n: number | null | undefined) {
  return n == null || Number.isNaN(n) ? '-' : `${Math.round(n * 100)}%`
}

function scorePct(n: number | null | undefined) {
  return n == null || Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, Math.round(n * 100)))
}

function money(n: number | null | undefined) {
  if (n == null) return '-'
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

function meters(n: number | null | undefined) {
  if (n == null) return '-'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}km` : `${Math.round(n)}m`
}

function grade(score: number) {
  if (score >= 0.88) return 'S'
  if (score >= 0.78) return 'A'
  if (score >= 0.66) return 'B'
  if (score >= 0.54) return 'C'
  return 'D'
}

function callSummary(call?: CallRow) {
  if (!call) return '콜카드 없음'
  const weekday = weekdayLabels[call.weekday] ?? '-'
  const paid = call.is_paid ? '유료콜' : '무료콜'
  const product = call.is_surge ? '탄력' : '일반'
  return `${call.hour_slot}시 ${weekday} · ${meters(call.expected_distance)} · ${money(call.expected_fare)} · ${paid} · ${product}`
}

export default function VectorsPage() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [selectedCallId, setSelectedCallId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      const [callRes, driverRes] = await Promise.all([
        supabase
          .from('callcard_mbti')
          .select('callcard_id,asp_id,call_date,hour_slot,weekday,expected_distance,expected_fare,is_paid,is_surge,eta_distance,product_type')
          .order('call_date', { ascending: false })
          .limit(80),
        supabase
          .from('driver_mbti')
          .select('*')
          .order('reliability', { ascending: false })
          .limit(1500),
      ])

      if (cancelled) return
      const nextCalls = (callRes.data ?? []) as CallRow[]
      setCalls(nextCalls)
      setDrivers((driverRes.data ?? []) as DriverRow[])
      setSelectedCallId(nextCalls[0]?.callcard_id ?? '')
      setLoadError(callRes.error?.message ?? driverRes.error?.message ?? null)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const selectedCall = calls.find((row) => row.callcard_id === selectedCallId) ?? calls[0]
  const callVector = useMemo(() => (selectedCall ? callToVector(selectedCall) : []), [selectedCall])

  const ranked = useMemo<RankedDriver[]>(() => {
    if (!selectedCall || !callVector.length) return []
    return drivers
      .filter((driver) => driver.asp_id === selectedCall.asp_id)
      .map((driver) => {
        const vector = driverToVector(driver)
        const cosine = cosineSimilarity(callVector, vector)
        return { driver, vector, cosine, grade: grade(cosine) }
      })
      .sort((a, b) => b.cosine - a.cosine)
      .slice(0, 10)
  }, [drivers, selectedCall, callVector])

  useEffect(() => {
    const nextDriverId = !ranked.length
      ? ''
      : ranked.some((row) => row.driver.driver_id === selectedDriverId)
        ? null
        : ranked[0].driver.driver_id
    if (nextDriverId !== null) queueMicrotask(() => setSelectedDriverId(nextDriverId))
  }, [ranked, selectedDriverId])

  const selectedMatch = ranked.find((row) => row.driver.driver_id === selectedDriverId) ?? ranked[0]
  const selectedDriverVector = selectedMatch?.vector ?? []
  const callAxes = vectorToDisplayAxisBundle(callVector).axis
  const driverAxes = vectorToDisplayAxisBundle(selectedDriverVector).axis

  return (
    <main className="page">
      <PrimaryNav
        active="/vectors"
        title="Happycall PMO"
        subtitle="Vector Studio"
        rightSlot={<><Pill color={C.green}>실데이터</Pill><Pill color={C.cyan}>22D COSINE</Pill></>}
      />

      <section className="top-rail" aria-label="팩터리스트 핵심 지표">
        <RailMetric label="콜카드" value={selectedCall ? '1건 선택' : loading ? '로딩 중' : '없음'} meta={`${calls.toLocaleString('ko-KR')}개 후보`} color={C.cyan} />
        <RailMetric label="후보 기사" value={`${ranked.length}명`} meta={`${drivers.toLocaleString('ko-KR')}명 driver_mbti 조회`} color={C.green} />
        <RailMetric label="최고 유사도" value={pct(ranked[0]?.cosine)} meta="22D 코사인 기준" color={C.purple} />
        <RailMetric label="표시 방식" value="22D → 5축" meta="계산은 22D, 화면은 5축 요약" color={C.orange} />
      </section>

      <div className="workspace">
        <section className="hero-card">
          <div>
            <p className="eyebrow">VECTOR FACTOR LIST</p>
            <h1>콜카드 조건과 기사 운행패턴을 같은 22개 팩터로 비교합니다</h1>
            <p className="lead">
              콜카드는 현재 요청 조건을 22D로 만들고, 기사는 누적 운행패턴을 22D로 저장합니다.
              두 벡터의 방향이 얼마나 비슷한지 코사인 유사도로 계산하고, 화면에서는 5축으로 요약해 이해를 돕습니다.
            </p>
          </div>
          <div className="status-card" style={{ '--tone': loadError ? C.red : loading ? C.yellow : C.green } as CSSProperties}>
            <span>조회 상태</span>
            <strong>{loading ? '확인 중' : loadError ? '오류' : '정상'}</strong>
            <p>{loadError ?? `${calls.toLocaleString('ko-KR')}개 콜카드와 ${drivers.toLocaleString('ko-KR')}명 기사 벡터를 비교할 수 있습니다.`}</p>
          </div>
        </section>

        <section className="main-grid">
          <aside className="profile-panel">
            <SectionTitle label="CALLCARD" title="콜카드 팩터" />
            <select value={selectedCallId} onChange={(event) => setSelectedCallId(event.target.value)}>
              {calls.length === 0 ? (
                <option value="">{loading ? '콜카드 불러오는 중' : '조회된 콜카드 없음'}</option>
              ) : calls.map((call) => (
                <option key={call.callcard_id} value={call.callcard_id}>
                  {call.call_date} / {call.callcard_id}
                </option>
              ))}
            </select>
            <ProfileCard tone={C.cyan} label="REQUEST" score={callVector.length ? Math.round(callVector.reduce((sum, value) => sum + value, 0) * 12 + 36) : 0} badge="CALL">
              <strong>{selectedCall?.callcard_id ?? '-'}</strong>
              <p>{callSummary(selectedCall)}</p>
              <MiniGrid items={[
                ['거리', meters(selectedCall?.expected_distance)],
                ['요금', money(selectedCall?.expected_fare)],
                ['ETA', selectedCall?.eta_distance == null ? '-' : `${Math.round(selectedCall.eta_distance)}초`],
                ['상품', selectedCall?.is_surge ? '탄력' : '일반'],
              ]} />
            </ProfileCard>
          </aside>

          <section className="comparison-stage">
            <SectionTitle label="CORE" title="22D 팩터 비교판" />
            <div className="match-summary">
              <div>
                <span>현재 비교</span>
                <h2>{selectedCall?.callcard_id ?? '-'} ↔ {selectedMatch?.driver.driver_id ?? '-'}</h2>
              </div>
              <strong>{pct(selectedMatch?.cosine)}</strong>
            </div>
            <FactorGrid callVector={callVector} driverVector={selectedDriverVector} />
          </section>

          <aside className="profile-panel">
            <SectionTitle label="DRIVER" title="기사 능력치" />
            <DriverList ranked={ranked} selectedDriverId={selectedDriverId} onSelect={setSelectedDriverId} />
            <ProfileCard tone={C.green} label="CANDIDATE" score={selectedMatch ? Math.round(selectedMatch.cosine * 100) : 0} badge={selectedMatch?.grade ?? '-'}>
              <strong>{selectedMatch?.driver.driver_id ?? '선택 기사 없음'}</strong>
              <p>누적 데이터 {selectedMatch?.driver.data_days ?? '-'}일 · 신뢰도 {pct(selectedMatch?.driver.reliability)}</p>
              <MiniGrid items={[
                ['유사도', pct(selectedMatch?.cosine)],
                ['신뢰도', pct(selectedMatch?.driver.reliability)],
                ['ASP', selectedMatch?.driver.asp_id == null ? '-' : String(selectedMatch.driver.asp_id)],
                ['등급', selectedMatch?.grade ?? '-'],
              ]} />
            </ProfileCard>
          </aside>
        </section>

        <section className="bottom-grid">
          <AxisPanel callAxes={callAxes} driverAxes={driverAxes} />
          <FormulaPanel />
        </section>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          color: ${C.ink};
          background:
            linear-gradient(90deg, rgba(34, 211, 238, 0.045) 1px, transparent 1px),
            linear-gradient(180deg, rgba(34, 211, 238, 0.035) 1px, transparent 1px),
            radial-gradient(circle at 18% 12%, rgba(34, 211, 238, 0.14), transparent 30rem),
            radial-gradient(circle at 82% 16%, rgba(139, 92, 246, 0.14), transparent 28rem),
            ${C.bg};
          background-size: 72px 72px, 72px 72px, auto, auto, auto;
          font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .top-rail {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid ${C.line};
          background: rgba(5, 8, 16, 0.88);
        }

        .workspace {
          width: 100%;
          max-width: 1780px;
          margin: 0 auto;
          padding: 28px;
          display: grid;
          gap: 22px;
        }

        .hero-card,
        .profile-panel,
        .comparison-stage,
        .bottom-panel {
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(5, 8, 16, 0.86));
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .hero-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 24px;
          padding: 34px;
          align-items: stretch;
        }

        .eyebrow {
          margin: 0;
          color: ${C.cyan};
          font-size: 20px;
          font-weight: 900;
        }

        h1 {
          max-width: 1050px;
          margin: 12px 0 0;
          font-size: 56px;
          line-height: 1.06;
          letter-spacing: 0;
        }

        .lead {
          max-width: 1040px;
          margin: 16px 0 0;
          color: ${C.sub};
          font-size: 22px;
          line-height: 1.55;
          font-weight: 650;
        }

        .status-card {
          display: grid;
          align-content: center;
          gap: 10px;
          padding: 26px;
          border: 1px solid color-mix(in srgb, var(--tone) 48%, transparent);
          border-radius: 8px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 13%, transparent), rgba(15, 23, 42, 0.64));
        }

        .status-card span {
          color: ${C.sub};
          font-size: 20px;
          font-weight: 900;
        }

        .status-card strong {
          color: var(--tone);
          font-size: 54px;
          line-height: 1;
        }

        .status-card p {
          margin: 0;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.45;
          font-weight: 650;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 340px minmax(0, 1fr) 360px;
          gap: 22px;
          align-items: start;
        }

        .profile-panel,
        .comparison-stage,
        .bottom-panel {
          min-width: 0;
          padding: 24px;
        }

        select {
          width: 100%;
          height: 58px;
          margin-bottom: 18px;
          border: 1px solid ${C.line};
          border-radius: 8px;
          color: ${C.ink};
          background: #0B1222;
          padding: 0 14px;
          font-size: 20px;
          font-weight: 800;
        }

        .match-summary {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          padding: 20px;
          margin-bottom: 18px;
          border: 1px solid rgba(34, 211, 238, 0.35);
          border-radius: 8px;
          background: rgba(34, 211, 238, 0.08);
        }

        .match-summary span {
          color: ${C.cyan};
          font-size: 19px;
          font-weight: 900;
        }

        .match-summary h2 {
          margin: 8px 0 0;
          color: ${C.ink};
          font-size: 32px;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .match-summary strong {
          color: ${C.cyan};
          font-size: 64px;
          line-height: 1;
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 22px;
        }

        @media (max-width: 1320px) {
          .main-grid {
            grid-template-columns: 1fr;
          }

          .bottom-grid,
          .hero-card {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .top-rail {
            grid-template-columns: 1fr;
          }

          .workspace {
            padding: 18px;
          }

          h1 {
            font-size: 40px;
          }

          .lead {
            font-size: 20px;
          }
        }
      `}</style>
    </main>
  )
}

function RailMetric({ label, value, meta, color }: { label: string; value: string; meta: string; color: string }) {
  return (
    <article className="rail-metric">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
      <p>{meta}</p>
      <style jsx>{`
        .rail-metric {
          min-height: 106px;
          display: grid;
          align-content: center;
          gap: 5px;
          padding: 18px 24px;
          border-right: 1px solid ${C.line};
        }

        span {
          color: ${C.muted};
          font-size: 18px;
          font-weight: 900;
        }

        strong {
          min-width: 0;
          font-size: 30px;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        p {
          margin: 0;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </article>
  )
}

function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="section-title">
      <span>{label}</span>
      <h2>{title}</h2>
      <style jsx>{`
        .section-title {
          display: grid;
          gap: 7px;
          margin-bottom: 16px;
        }

        span {
          color: ${C.muted};
          font-size: 18px;
          font-weight: 900;
        }

        h2 {
          margin: 0;
          color: ${C.ink};
          font-size: 30px;
          line-height: 1.15;
        }
      `}</style>
    </div>
  )
}

function ProfileCard({ tone, label, score, badge, children }: { tone: string; label: string; score: number; badge: string; children: ReactNode }) {
  return (
    <article className="profile-card" style={{ '--tone': tone } as CSSProperties}>
      <div className="profile-head">
        <div>
          <span>{label}</span>
          <b>{score || '-'}</b>
        </div>
        <em>{badge}</em>
      </div>
      <div className="profile-body">{children}</div>
      <style jsx>{`
        .profile-card {
          padding: 20px;
          border: 1px solid color-mix(in srgb, var(--tone) 48%, transparent);
          border-radius: 8px;
          background: linear-gradient(145deg, color-mix(in srgb, var(--tone) 12%, transparent), rgba(15, 23, 42, 0.64));
        }

        .profile-head {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
        }

        span {
          display: block;
          color: var(--tone);
          font-size: 20px;
          font-weight: 900;
        }

        b {
          display: block;
          margin-top: 8px;
          color: ${C.ink};
          font-size: 64px;
          line-height: 1;
        }

        em {
          width: 86px;
          height: 86px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--tone) 58%, transparent);
          border-radius: 8px;
          color: var(--tone);
          background: rgba(5, 8, 16, 0.44);
          font-size: 36px;
          font-style: normal;
          font-weight: 950;
        }

        .profile-body :global(strong) {
          display: block;
          margin-top: 18px;
          color: ${C.ink};
          font-size: 26px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .profile-body :global(p) {
          margin: 10px 0 0;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.45;
          font-weight: 650;
        }
      `}</style>
    </article>
  )
}

function MiniGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="mini-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <style jsx>{`
        .mini-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }

        div {
          min-width: 0;
          padding: 14px;
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: rgba(5, 8, 16, 0.44);
        }

        span {
          display: block;
          color: ${C.muted};
          font-size: 18px;
          font-weight: 850;
        }

        strong {
          display: block;
          margin-top: 7px;
          color: ${C.ink};
          font-size: 21px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}

function DriverList({ ranked, selectedDriverId, onSelect }: { ranked: RankedDriver[]; selectedDriverId: string; onSelect: (driverId: string) => void }) {
  return (
    <div className="driver-list">
      {ranked.slice(0, 4).map((row, index) => {
        const active = row.driver.driver_id === selectedDriverId
        return (
          <button key={row.driver.driver_id} onClick={() => onSelect(row.driver.driver_id)} className={active ? 'active' : ''}>
            <span>#{index + 1}</span>
            <b>{row.driver.driver_id}</b>
            <strong>{pct(row.cosine)}</strong>
          </button>
        )
      })}
      <style jsx>{`
        .driver-list {
          display: grid;
          gap: 10px;
          margin-bottom: 18px;
        }

        button {
          display: grid;
          grid-template-columns: 54px minmax(0, 1fr) 72px;
          gap: 12px;
          align-items: center;
          min-height: 62px;
          border: 1px solid ${C.line};
          border-radius: 8px;
          color: ${C.ink};
          background: rgba(15, 23, 42, 0.62);
          cursor: pointer;
          text-align: left;
        }

        button.active {
          border-color: ${C.cyan};
          background: rgba(34, 211, 238, 0.12);
        }

        span {
          color: ${C.yellow};
          font-size: 20px;
          font-weight: 950;
          text-align: center;
        }

        b {
          min-width: 0;
          font-size: 19px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        strong {
          color: ${C.cyan};
          font-size: 22px;
          text-align: right;
          padding-right: 14px;
        }
      `}</style>
    </div>
  )
}

function FactorGrid({ callVector, driverVector }: { callVector: number[]; driverVector: number[] }) {
  return (
    <div className="factor-grid">
      {VECTOR_DIMENSIONS.map((dimension, index) => {
        const call = Number(callVector[index] ?? 0)
        const driver = Number(driverVector[index] ?? 0)
        const diff = Math.abs(call - driver)
        const fit = Math.max(0, 1 - diff)
        const tone = fit >= 0.8 ? C.green : fit >= 0.55 ? C.yellow : C.red
        return (
          <article key={dimension.key} style={{ '--tone': tone } as CSSProperties}>
            <div className="factor-head">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <b>{dimension.group}</b>
            </div>
            <h3>{dimension.label}</h3>
            <div className="bars">
              <VectorBar label="콜" value={call} color={C.cyan} />
              <VectorBar label="기사" value={driver} color={C.green} />
            </div>
            <strong>{Math.round(fit * 100)}%</strong>
          </article>
        )
      })}
      <style jsx>{`
        .factor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 12px;
        }

        article {
          min-height: 210px;
          display: grid;
          align-content: space-between;
          gap: 12px;
          padding: 16px;
          border: 1px solid color-mix(in srgb, var(--tone) 38%, transparent);
          border-radius: 8px;
          background: linear-gradient(145deg, color-mix(in srgb, var(--tone) 8%, transparent), rgba(15, 23, 42, 0.6));
        }

        .factor-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .factor-head span,
        .factor-head b {
          color: ${C.muted};
          font-size: 18px;
          font-weight: 900;
        }

        h3 {
          margin: 0;
          color: ${C.ink};
          font-size: 26px;
          line-height: 1.18;
        }

        .bars {
          display: grid;
          gap: 9px;
        }

        article > strong {
          color: var(--tone);
          font-size: 30px;
          line-height: 1;
        }
      `}</style>
    </div>
  )
}

function VectorBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="vector-bar">
      <div><span>{label}</span><b>{scorePct(value)}</b></div>
      <i><em style={{ width: `${scorePct(value)}%`, background: color }} /></i>
      <style jsx>{`
        .vector-bar {
          display: grid;
          gap: 5px;
        }

        div {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: ${C.sub};
          font-size: 18px;
          font-weight: 800;
        }

        b {
          color: ${C.ink};
        }

        i {
          display: block;
          height: 9px;
          border-radius: 999px;
          background: rgba(130, 144, 168, 0.2);
          overflow: hidden;
        }

        em {
          display: block;
          height: 100%;
          border-radius: inherit;
        }
      `}</style>
    </div>
  )
}

function AxisPanel({ callAxes, driverAxes }: { callAxes: number[]; driverAxes: number[] }) {
  return (
    <section className="bottom-panel">
      <SectionTitle label="5-AXIS SUMMARY" title="22D를 이해하기 위한 5축 요약" />
      <div className="axis-list">
        {DISPLAY_AXES.map((axis, index) => {
          const name = axisNames[index] ?? axis.name
          const color = axisColors[index] ?? C.cyan
          const call = (callAxes[index] ?? 0) / 100
          const driver = (driverAxes[index] ?? 0) / 100
          const fit = Math.max(0, 1 - Math.abs(call - driver))
          return (
            <article key={axis.key} style={{ '--tone': color } as CSSProperties}>
              <div>
                <b>{name}</b>
                <strong>{Math.round(fit * 100)}%</strong>
              </div>
              <VectorBar label="콜카드" value={call} color={C.cyan} />
              <VectorBar label="기사" value={driver} color={C.green} />
            </article>
          )
        })}
      </div>
      <style jsx>{`
        .axis-list {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        article {
          padding: 16px;
          border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
          border-radius: 8px;
          background: color-mix(in srgb, var(--tone) 8%, transparent);
        }

        article > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
          margin-bottom: 12px;
        }

        b {
          color: var(--tone);
          font-size: 20px;
          line-height: 1.2;
        }

        strong {
          color: ${C.ink};
          font-size: 28px;
        }

        @media (max-width: 1280px) {
          .axis-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .axis-list {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}

function FormulaPanel() {
  const groups = Array.from(new Set(VECTOR_DIMENSIONS.map((dimension) => dimension.group)))
  return (
    <section className="bottom-panel">
      <SectionTitle label="FORMULA" title="계산식과 팩터 그룹" />
      <div className="formula-grid">
        <FormulaCard color={C.cyan} title="콜카드 벡터" body="현재 콜 조건을 시간대, 요일, 거리, 요금, 콜유형, 상품, ETA 팩터로 변환합니다. 해당 조건은 1에 가깝고, 아닌 조건은 0에 가깝습니다." />
        <FormulaCard color={C.green} title="기사 벡터" body="driver_mbti에 저장된 기사별 누적 운행 패턴입니다. 값이 높을수록 해당 조건에서 수락하거나 운행한 성향이 강합니다." />
        <FormulaCard color={C.purple} title="코사인 유사도" body="dot(call22D, driver22D) / (|call22D| × |driver22D|). 두 벡터의 방향이 비슷할수록 높아집니다." />
      </div>
      <div className="group-grid">
        {groups.map((group) => (
          <article key={group}>
            <h3>{group}</h3>
            <p>{factorDescriptions[group] ?? '해당 팩터 그룹을 비교합니다.'}</p>
            <strong>{VECTOR_DIMENSIONS.filter((dimension) => dimension.group === group).map((dimension) => dimension.label).join(' · ')}</strong>
          </article>
        ))}
      </div>
      <style jsx>{`
        .formula-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .group-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
        }

        .group-grid article {
          padding: 16px;
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: ${C.panel2};
        }

        h3 {
          margin: 0;
          color: ${C.ink};
          font-size: 24px;
        }

        p {
          margin: 8px 0 0;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.45;
        }

        strong {
          display: block;
          margin-top: 10px;
          color: ${C.cyan};
          font-size: 19px;
          line-height: 1.45;
        }

        @media (max-width: 1080px) {
          .formula-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}

function FormulaCard({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <article className="formula" style={{ '--tone': color } as CSSProperties}>
      <h3>{title}</h3>
      <p>{body}</p>
      <style jsx>{`
        .formula {
          padding: 18px;
          border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
          border-radius: 8px;
          background: color-mix(in srgb, var(--tone) 8%, transparent);
        }

        h3 {
          margin: 0;
          color: var(--tone);
          font-size: 24px;
          line-height: 1.2;
        }

        p {
          margin: 10px 0 0;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.45;
          font-weight: 650;
        }
      `}</style>
    </article>
  )
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{ color, border: `1px solid ${color}66`, background: `${color}18`, borderRadius: 8, padding: '10px 14px', fontSize: 16, fontWeight: 900 }}>
      {children}
    </span>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAgentRun } from '@/lib/agent-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DailyLog {
  driver_id: string
  asp_id: number
  service_date: string
  weekday: number
  total_accepted: number
  accepted_hours: number[]
  accepted_s_hexagons: string[]
  accepted_d_hexagons: string[]
  short_cnt: number
  medium_cnt: number
  long_cnt: number
  low_fare_cnt: number
  mid_fare_cnt: number
  high_fare_cnt: number
  paid_accepted: number
  free_accepted: number
  product_surge_cnt: number
  product_normal_cnt: number
  avg_accept_eta: number | null
}

interface DriverMbti {
  driver_id: string
  asp_id: number
  score_dawn: number
  score_morning: number
  score_daytime: number
  score_night: number
  score_mon: number
  score_tue: number
  score_wed: number
  score_thu: number
  score_fri: number
  score_sat: number
  score_sun: number
  score_short: number
  score_medium: number
  score_long: number
  score_low_fare: number
  score_mid_fare: number
  score_high_fare: number
  score_paid: number
  score_free: number
  score_surge: number
  score_normal: number
  score_near: number
  pref_s_hexagons: string[]
  pref_d_hexagons: string[]
  data_days: number
  reliability: number
}

const COLUMNS = [
  'driver_id', 'asp_id', 'service_date', 'weekday', 'total_accepted',
  'accepted_hours', 'accepted_s_hexagons', 'accepted_d_hexagons',
  'short_cnt', 'medium_cnt', 'long_cnt',
  'low_fare_cnt', 'mid_fare_cnt', 'high_fare_cnt',
  'paid_accepted', 'free_accepted',
  'product_surge_cnt', 'product_normal_cnt',
  'avg_accept_eta',
].join(',')

async function fetchAllLogs(aspId?: number): Promise<DailyLog[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const all: DailyLog[] = []
  const PAGE = 1000
  let offset = 0

  while (true) {
    let query = supabase
      .from('driver_daily_logs')
      .select(COLUMNS)
      .gte('service_date', cutoffStr)
      .range(offset, offset + PAGE - 1)

    if (aspId) query = query.eq('asp_id', aspId)

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...(data as unknown as DailyLog[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  return all
}

// 오늘 기준 경과 일수로 가중치 반환. 30일 초과는 null(제외)
function getWeight(serviceDate: string, today: Date): number | null {
  const date = new Date(serviceDate + 'T00:00:00')
  const days = Math.floor((today.getTime() - date.getTime()) / 86_400_000)
  if (days <= 7)  return 1.0
  if (days <= 14) return 0.7
  if (days <= 21) return 0.4
  if (days <= 30) return 0.1
  return null
}

// 가중 빈도 Map에서 상위 n개 추출
function topNMap(freq: Map<string, number>, n: number): string[] {
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

function r4(v: number): number {
  return parseFloat(v.toFixed(4))
}

// 가중 평균 ETA로 배차 근접 점수 계산
function computeScoreNear(etaVals: { val: number; w: number }[]): number {
  if (etaVals.length === 0) return 0
  const totalW = etaVals.reduce((s, e) => s + e.w, 0)
  if (totalW === 0) return 0
  const avg = etaVals.reduce((s, e) => s + e.val * e.w, 0) / totalW
  if (avg <= 150) return 1.0
  if (avg >= 300) return 0.0
  return 1 - (avg - 150) / 150
}

function computeMbti(logs: DailyLog[]): DriverMbti[] {
  type Agg = {
    asp_id: number
    total_accepted: number  // 가중 합산
    dawn: number
    morning: number
    daytime: number
    night: number
    wd: number[]
    short: number
    medium: number
    long: number
    low_fare: number
    mid_fare: number
    high_fare: number
    paid: number
    free: number
    surge: number
    normal: number
    eta_vals: { val: number; w: number }[]
    s_hex: Map<string, number>  // 가중 빈도
    d_hex: Map<string, number>  // 가중 빈도
    data_days: number           // 실제 일수 (reliability 산출용, 비가중)
  }

  const today = new Date()
  const map = new Map<string, Agg>()

  for (const log of logs) {
    const w = getWeight(log.service_date, today)
    if (w === null) continue

    if (!map.has(log.driver_id)) {
      map.set(log.driver_id, {
        asp_id: log.asp_id,
        total_accepted: 0,
        dawn: 0, morning: 0, daytime: 0, night: 0,
        wd: [0, 0, 0, 0, 0, 0, 0],
        short: 0, medium: 0, long: 0,
        low_fare: 0, mid_fare: 0, high_fare: 0,
        paid: 0, free: 0,
        surge: 0, normal: 0,
        eta_vals: [],
        s_hex: new Map(),
        d_hex: new Map(),
        data_days: 0,
      })
    }

    const a = map.get(log.driver_id)!
    a.data_days++  // 실제 일수 카운트 (가중치 미적용)
    a.total_accepted += (log.total_accepted ?? 0) * w

    for (const h of (log.accepted_hours ?? [])) {
      if (h >= 0 && h <= 5) a.dawn += w
      else if (h >= 6 && h <= 11) a.morning += w
      else if (h >= 12 && h <= 17) a.daytime += w
      else if (h >= 18 && h <= 23) a.night += w
    }

    const kwd = ((log.weekday ?? 0) + 6) % 7  // JS getDay(sun=0) → 한국(mon=0)
    a.wd[kwd] += (log.total_accepted ?? 0) * w

    a.short    += (log.short_cnt    ?? 0) * w
    a.medium   += (log.medium_cnt   ?? 0) * w
    a.long     += (log.long_cnt     ?? 0) * w
    a.low_fare += (log.low_fare_cnt ?? 0) * w
    a.mid_fare += (log.mid_fare_cnt ?? 0) * w
    a.high_fare+= (log.high_fare_cnt?? 0) * w
    a.paid     += (log.paid_accepted ?? 0) * w
    a.free     += (log.free_accepted ?? 0) * w
    a.surge    += (log.product_surge_cnt  ?? 0) * w
    a.normal   += (log.product_normal_cnt ?? 0) * w

    if (log.avg_accept_eta != null && log.avg_accept_eta > 0) {
      a.eta_vals.push({ val: log.avg_accept_eta, w })
    }

    for (const hex of (log.accepted_s_hexagons ?? [])) {
      if (hex) a.s_hex.set(hex, (a.s_hex.get(hex) ?? 0) + w)
    }
    for (const hex of (log.accepted_d_hexagons ?? [])) {
      if (hex) a.d_hex.set(hex, (a.d_hex.get(hex) ?? 0) + w)
    }
  }

  const results: DriverMbti[] = []

  for (const [driver_id, a] of map.entries()) {
    const ta = a.total_accepted || 1
    const totalHours = (a.dawn + a.morning + a.daytime + a.night) || 1
    const totalWd = a.wd.reduce((s, v) => s + v, 0) || 1

    results.push({
      driver_id,
      asp_id: a.asp_id,
      score_dawn:      r4(a.dawn / totalHours),
      score_morning:   r4(a.morning / totalHours),
      score_daytime:   r4(a.daytime / totalHours),
      score_night:     r4(a.night / totalHours),
      score_mon: r4(a.wd[0] / totalWd),
      score_tue: r4(a.wd[1] / totalWd),
      score_wed: r4(a.wd[2] / totalWd),
      score_thu: r4(a.wd[3] / totalWd),
      score_fri: r4(a.wd[4] / totalWd),
      score_sat: r4(a.wd[5] / totalWd),
      score_sun: r4(a.wd[6] / totalWd),
      score_short:     r4(a.short / ta),
      score_medium:    r4(a.medium / ta),
      score_long:      r4(a.long / ta),
      score_low_fare:  r4(a.low_fare / ta),
      score_mid_fare:  r4(a.mid_fare / ta),
      score_high_fare: r4(a.high_fare / ta),
      score_paid:      r4(a.paid / ta),
      score_free:      r4(a.free / ta),
      score_surge:     r4(a.surge / ta),
      score_normal:    r4(a.normal / ta),
      score_near:      r4(computeScoreNear(a.eta_vals)),
      pref_s_hexagons: topNMap(a.s_hex, 3),
      pref_d_hexagons: topNMap(a.d_hex, 3),
      data_days:   a.data_days,
      reliability: r4(Math.min(a.data_days / 30, 1.0)),
    })
  }

  return results
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let inputRows = 0
  let aspId: number | undefined
  try {
    const body = await request.json().catch(() => ({}))
    if (body.asp_id) aspId = Number(body.asp_id)
  } catch {
    // body 없으면 전체 처리
  }

  let logs: DailyLog[]
  try {
    logs = await fetchAllLogs(aspId)
  } catch (err) {
    console.error('[driver-mbti] driver_daily_logs 조회 실패', err)
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'driver-mbti', input_rows: 0, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: String(err) })
    return NextResponse.json({ error: 'driver_daily_logs 조회 실패', detail: String(err) }, { status: 500 })
  }

  inputRows = logs.length

  if (logs.length === 0) {
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'driver-mbti', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: 'driver_daily_logs 데이터 없음' })
    return NextResponse.json({ error: 'driver_daily_logs에 데이터가 없습니다.' }, { status: 422 })
  }

  const mbtiList = computeMbti(logs)

  const BATCH = 500
  for (let i = 0; i < mbtiList.length; i += BATCH) {
    const chunk = mbtiList.slice(i, i + BATCH)
    const { error } = await supabase
      .from('driver_mbti')
      .upsert(chunk, { onConflict: 'driver_id' })

    if (error) {
      console.error('[driver-mbti] upsert 실패', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        batch_index: i,
      })
      await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'driver-mbti', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: error.message })
      return NextResponse.json(
        { error: 'driver_mbti upsert 실패', detail: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      )
    }
  }

  await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'driver-mbti', input_rows: inputRows, status: 'success', duration_ms: Date.now() - startedAt })
  return NextResponse.json({
    message: 'driver_mbti 계산 완료',
    driver_count: mbtiList.length,
    data_rows_read: logs.length,
    asp_id: aspId ?? 'all',
  })
}

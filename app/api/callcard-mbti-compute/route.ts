import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAgentRun } from '@/lib/agent-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CallcardRow {
  asp_id: number
  call_date: string
  hour_slot: number
  weekday: number
  expected_distance: number
  expected_fare: number
  is_paid: boolean
  eta_distance: number | null
  is_surge: boolean
  s_hexagon: string
  d_hexagon: string
}

interface CallcardProfile {
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
  total_calls: number
  data_days: number
  reliability: number
}

const COLUMNS = [
  'asp_id', 'call_date', 'hour_slot', 'weekday',
  'expected_distance', 'expected_fare',
  'is_paid', 'eta_distance', 'is_surge',
  's_hexagon', 'd_hexagon',
].join(',')

async function fetchAllRows(aspId?: number): Promise<CallcardRow[]> {
  const all: CallcardRow[] = []
  const PAGE = 1000
  let offset = 0

  while (true) {
    let query = supabase
      .from('callcard_mbti')
      .select(COLUMNS)
      .range(offset, offset + PAGE - 1)

    if (aspId) query = query.eq('asp_id', aspId)

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...(data as CallcardRow[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  return all
}

function topN(arr: string[], n: number): string[] {
  const freq = new Map<string, number>()
  for (const v of arr) {
    if (v) freq.set(v, (freq.get(v) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

function r4(v: number): number {
  return parseFloat(v.toFixed(4))
}

function scoreNear(etaValues: number[]): number {
  if (etaValues.length === 0) return 0
  const avg = etaValues.reduce((a, b) => a + b, 0) / etaValues.length
  if (avg <= 150) return 1.0
  if (avg >= 600) return 0.0
  return 1 - (avg - 150) / 450
}

function computeProfiles(rows: CallcardRow[]): CallcardProfile[] {
  type Agg = {
    dawn: number; morning: number; daytime: number; night: number
    wd: number[]   // [mon, tue, wed, thu, fri, sat, sun]
    short: number; medium: number; long: number
    low_fare: number; mid_fare: number; high_fare: number
    paid: number; free: number
    surge: number; normal: number
    eta_vals: number[]
    s_hex: string[]; d_hex: string[]
    total_calls: number
    dates: Set<string>
  }

  const map = new Map<number, Agg>()

  for (const row of rows) {
    if (!map.has(row.asp_id)) {
      map.set(row.asp_id, {
        dawn: 0, morning: 0, daytime: 0, night: 0,
        wd: [0, 0, 0, 0, 0, 0, 0],
        short: 0, medium: 0, long: 0,
        low_fare: 0, mid_fare: 0, high_fare: 0,
        paid: 0, free: 0,
        surge: 0, normal: 0,
        eta_vals: [],
        s_hex: [], d_hex: [],
        total_calls: 0,
        dates: new Set(),
      })
    }

    const a = map.get(row.asp_id)!
    a.total_calls++
    if (row.call_date) a.dates.add(row.call_date)

    const h = row.hour_slot
    if (h >= 0 && h <= 5) a.dawn++
    else if (h >= 6 && h <= 11) a.morning++
    else if (h >= 12 && h <= 17) a.daytime++
    else a.night++

    const wd = row.weekday  // 0=월~6=일
    if (wd >= 0 && wd <= 6) a.wd[wd]++

    const dist = row.expected_distance ?? 0
    if (dist > 0) {
      if (dist <= 3000) a.short++
      else if (dist <= 8000) a.medium++
      else a.long++
    }

    const fare = row.expected_fare ?? 0
    if (fare > 0) {
      if (fare <= 10000) a.low_fare++
      else if (fare <= 20000) a.mid_fare++
      else a.high_fare++
    }

    if (row.is_paid) a.paid++; else a.free++
    if (row.is_surge) a.surge++; else a.normal++

    if (row.eta_distance != null && row.eta_distance > 0) {
      a.eta_vals.push(row.eta_distance)
    }

    if (row.s_hexagon) a.s_hex.push(row.s_hexagon)
    if (row.d_hexagon) a.d_hex.push(row.d_hexagon)
  }

  const results: CallcardProfile[] = []

  for (const [asp_id, a] of map.entries()) {
    const tc = a.total_calls || 1
    const totalHour = (a.dawn + a.morning + a.daytime + a.night) || 1
    const totalWd = a.wd.reduce((s, v) => s + v, 0) || 1
    const data_days = a.dates.size

    results.push({
      asp_id,
      score_dawn:      r4(a.dawn / totalHour),
      score_morning:   r4(a.morning / totalHour),
      score_daytime:   r4(a.daytime / totalHour),
      score_night:     r4(a.night / totalHour),
      score_mon: r4(a.wd[0] / totalWd),
      score_tue: r4(a.wd[1] / totalWd),
      score_wed: r4(a.wd[2] / totalWd),
      score_thu: r4(a.wd[3] / totalWd),
      score_fri: r4(a.wd[4] / totalWd),
      score_sat: r4(a.wd[5] / totalWd),
      score_sun: r4(a.wd[6] / totalWd),
      score_short:     r4(a.short / tc),
      score_medium:    r4(a.medium / tc),
      score_long:      r4(a.long / tc),
      score_low_fare:  r4(a.low_fare / tc),
      score_mid_fare:  r4(a.mid_fare / tc),
      score_high_fare: r4(a.high_fare / tc),
      score_paid:      r4(a.paid / tc),
      score_free:      r4(a.free / tc),
      score_surge:     r4(a.surge / tc),
      score_normal:    r4(a.normal / tc),
      score_near:      r4(scoreNear(a.eta_vals)),
      pref_s_hexagons: topN(a.s_hex, 3),
      pref_d_hexagons: topN(a.d_hex, 3),
      total_calls:     a.total_calls,
      data_days,
      reliability:     r4(Math.min(data_days / 30, 1.0)),
    })
  }

  return results
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let aspId: number | undefined
  try {
    const body = await request.json().catch(() => ({}))
    if (body.asp_id) aspId = Number(body.asp_id)
  } catch {
    // body 없으면 전체 처리
  }

  let rows: CallcardRow[]
  try {
    rows = await fetchAllRows(aspId)
  } catch (err) {
    console.error('[callcard-mbti-compute] callcard_mbti 조회 실패', err)
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'callcard-mbti-compute', input_rows: 0, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: String(err) })
    return NextResponse.json(
      { error: 'callcard_mbti 조회 실패', detail: String(err) },
      { status: 500 }
    )
  }

  if (rows.length === 0) {
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'callcard-mbti-compute', input_rows: 0, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: 'callcard_mbti 데이터 없음' })
    return NextResponse.json(
      { error: 'callcard_mbti에 데이터가 없습니다.' },
      { status: 422 }
    )
  }

  const profiles = computeProfiles(rows)

  const BATCH = 500
  for (let i = 0; i < profiles.length; i += BATCH) {
    const chunk = profiles.slice(i, i + BATCH)
    const { error } = await supabase
      .from('callcard_profile')
      .upsert(chunk, { onConflict: 'asp_id' })

    if (error) {
      console.error('[callcard-mbti-compute] upsert 실패', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        batch_index: i,
      })
      await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'callcard-mbti-compute', input_rows: rows.length, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: error.message })
      return NextResponse.json(
        { error: 'callcard_profile upsert 실패', detail: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      )
    }
  }

  await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'callcard-mbti-compute', input_rows: rows.length, status: 'success', duration_ms: Date.now() - startedAt })
  return NextResponse.json({
    message: 'callcard_profile 계산 완료',
    asp_count: profiles.length,
    total_calls_read: rows.length,
    asp_id: aspId ?? 'all',
  })
}

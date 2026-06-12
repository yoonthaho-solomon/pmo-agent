import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAgentRun } from '@/lib/agent-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CallcardRow {
  callcard_id: string
  asp_id: number
  call_date: string
  hour_slot: number
  expected_distance: number
  expected_fare: number
  is_paid: boolean
  eta_distance: number | null
  is_surge: boolean
  s_hexagon: string
}

interface DriverRow {
  driver_id: string
  asp_id: number
  score_dawn: number
  score_morning: number
  score_daytime: number
  score_night: number
  score_short: number
  score_medium: number
  score_long: number
  score_low_fare: number
  score_mid_fare: number
  score_high_fare: number
  score_paid: number
  score_surge: number
  score_near: number
  pref_s_hexagons: string[]
}

interface MatchScore {
  call_id: string
  driver_id: string
  asp_id: number
  match_date: string
  cosine_score: number
  rank_in_call: number
  was_sent: boolean
  was_accepted: boolean
}

const CALLCARD_COLS = [
  'callcard_id', 'asp_id', 'call_date',
  'hour_slot', 'expected_distance', 'expected_fare',
  'is_paid', 'eta_distance', 'is_surge', 's_hexagon',
].join(',')

const DRIVER_COLS = [
  'driver_id', 'asp_id',
  'score_dawn', 'score_morning', 'score_daytime', 'score_night',
  'score_short', 'score_medium', 'score_long',
  'score_low_fare', 'score_mid_fare', 'score_high_fare',
  'score_paid', 'score_surge', 'score_near',
  'pref_s_hexagons',
].join(',')

async function fetchCallcards(callDate: string): Promise<CallcardRow[]> {
  const all: CallcardRow[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('callcard_mbti')
      .select(CALLCARD_COLS)
      .eq('call_date', callDate)
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as CallcardRow[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

async function fetchDrivers(): Promise<DriverRow[]> {
  const all: DriverRow[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('driver_mbti')
      .select(DRIVER_COLS)
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as DriverRow[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

function etaToNear(eta: number | null): number {
  if (eta == null || eta <= 0) return 0
  if (eta <= 150) return 1.0
  if (eta >= 600) return 0.0
  return 1 - (eta - 150) / 450
}

function callcardToVector(row: CallcardRow): number[] {
  const h = row.hour_slot
  const dist = row.expected_distance ?? 0
  const fare = row.expected_fare ?? 0
  return [
    h <= 5 ? 1 : 0,                          // dawn
    h >= 6 && h <= 11 ? 1 : 0,               // morning
    h >= 12 && h <= 17 ? 1 : 0,              // daytime
    h >= 18 ? 1 : 0,                          // night
    dist > 0 && dist <= 3000 ? 1 : 0,         // short
    dist > 3000 && dist <= 8000 ? 1 : 0,      // medium
    dist > 8000 ? 1 : 0,                      // long
    fare > 0 && fare <= 10000 ? 1 : 0,        // low_fare
    fare > 10000 && fare <= 20000 ? 1 : 0,    // mid_fare
    fare > 20000 ? 1 : 0,                     // high_fare
    row.is_paid ? 1 : 0,                      // paid
    row.is_surge ? 1 : 0,                     // surge
    etaToNear(row.eta_distance),              // near
  ]
}

function driverToVector(row: DriverRow): number[] {
  return [
    row.score_dawn,      row.score_morning, row.score_daytime, row.score_night,
    row.score_short,     row.score_medium,  row.score_long,
    row.score_low_fare,  row.score_mid_fare, row.score_high_fare,
    row.score_paid,
    row.score_surge,
    row.score_near,
  ]
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

function computeMatches(
  callcards: CallcardRow[],
  drivers: DriverRow[],
): MatchScore[] {
  // asp_id별 driver 풀 인덱싱
  const driversByAsp = new Map<number, DriverRow[]>()
  for (const d of drivers) {
    const list = driversByAsp.get(d.asp_id) ?? []
    list.push(d)
    driversByAsp.set(d.asp_id, list)
  }

  // driver_id별 벡터 사전 계산
  const driverVecs = new Map<string, number[]>()
  for (const d of drivers) {
    driverVecs.set(d.driver_id, driverToVector(d))
  }

  const results: MatchScore[] = []

  for (const call of callcards) {
    const pool = driversByAsp.get(call.asp_id)
    if (!pool || pool.length === 0) continue

    const callVec = callcardToVector(call)

    const candidates = pool.map((d) => {
      const cos = cosine(callVec, driverVecs.get(d.driver_id)!)
      const bonus = d.pref_s_hexagons?.includes(call.s_hexagon) ? 0.1 : 0
      return { driver_id: d.driver_id, score: Math.min(cos + bonus, 1.0) }
    })

    candidates.sort((a, b) => b.score - a.score)

    const top10 = candidates.slice(0, 10)
    for (let i = 0; i < top10.length; i++) {
      results.push({
        call_id:      call.callcard_id,
        driver_id:    top10[i].driver_id,
        asp_id:       call.asp_id,
        match_date:   call.call_date,
        cosine_score: parseFloat(top10[i].score.toFixed(4)),
        rank_in_call: i + 1,
        was_sent:     false,
        was_accepted: false,
      })
    }
  }

  return results
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let inputRows = 0
  let callDate: string
  try {
    const body = await request.json()
    callDate = body.call_date
  } catch {
    return NextResponse.json({ error: 'body JSON 파싱 실패' }, { status: 400 })
  }

  if (!callDate || !/^\d{4}-\d{2}-\d{2}$/.test(callDate)) {
    return NextResponse.json(
      { error: 'call_date(YYYY-MM-DD) 필드가 필요합니다.' },
      { status: 400 }
    )
  }

  let callcards: CallcardRow[]
  let drivers: DriverRow[]
  try {
    ;[callcards, drivers] = await Promise.all([
      fetchCallcards(callDate),
      fetchDrivers(),
    ])
  } catch (err) {
    console.error('[matching] 데이터 조회 실패', err)
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'matching', input_rows: 0, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: String(err) })
    return NextResponse.json({ error: '데이터 조회 실패', detail: String(err) }, { status: 500 })
  }

  inputRows = callcards.length

  if (callcards.length === 0) {
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'matching', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: `${callDate} callcard 없음` })
    return NextResponse.json(
      { error: `${callDate} 날짜의 callcard_mbti 데이터가 없습니다.` },
      { status: 422 }
    )
  }
  if (drivers.length === 0) {
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'matching', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: 'driver_mbti 데이터 없음' })
    return NextResponse.json(
      { error: 'driver_mbti 데이터가 없습니다.' },
      { status: 422 }
    )
  }

  const scores = computeMatches(callcards, drivers)

  if (scores.length === 0) {
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'matching', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: '매칭 결과 없음 (asp_id 불일치 가능)' })
    return NextResponse.json(
      { error: '매칭 결과가 없습니다. asp_id가 callcard_mbti와 driver_mbti 간에 일치하는지 확인하세요.' },
      { status: 422 }
    )
  }

  const BATCH = 500
  for (let i = 0; i < scores.length; i += BATCH) {
    const chunk = scores.slice(i, i + BATCH)
    const { error } = await supabase
      .from('matching_scores')
      .upsert(chunk, { onConflict: 'call_id,driver_id' })

    if (error) {
      console.error('[matching] upsert 실패', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        batch_index: i,
      })
      await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'matching', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: error.message })
      return NextResponse.json(
        { error: 'matching_scores upsert 실패', detail: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      )
    }
  }

  await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'matching', input_rows: inputRows, status: 'success', duration_ms: Date.now() - startedAt })
  return NextResponse.json({
    message: '매칭 완료',
    call_date: callDate,
    call_count: callcards.length,
    driver_count: drivers.length,
    match_count: scores.length,
  })
}

interface UpdateEntry {
  call_id: string
  driver_id: string
  was_sent?: boolean
  was_accepted?: boolean
}

export async function PATCH(request: NextRequest) {
  let updates: UpdateEntry[]
  try {
    const body = await request.json()
    updates = Array.isArray(body.updates) ? body.updates : [body]
  } catch {
    return NextResponse.json({ error: 'body JSON 파싱 실패' }, { status: 400 })
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'updates 배열이 비어있습니다.' }, { status: 400 })
  }

  // 각 항목 유효성 검사
  for (const u of updates) {
    if (!u.call_id || !u.driver_id) {
      return NextResponse.json(
        { error: 'call_id, driver_id는 필수입니다.', item: u },
        { status: 400 }
      )
    }
    if (u.was_sent === undefined && u.was_accepted === undefined) {
      return NextResponse.json(
        { error: 'was_sent 또는 was_accepted 중 하나 이상 필요합니다.', item: u },
        { status: 400 }
      )
    }
  }

  let failCount = 0

  // 10개씩 병렬 업데이트
  const CONCURRENT = 10
  for (let i = 0; i < updates.length; i += CONCURRENT) {
    const chunk = updates.slice(i, i + CONCURRENT)
    const results = await Promise.all(
      chunk.map((u) => {
        const fields: Partial<Pick<UpdateEntry, 'was_sent' | 'was_accepted'>> = {}
        if (u.was_sent !== undefined) fields.was_sent = u.was_sent
        if (u.was_accepted !== undefined) fields.was_accepted = u.was_accepted

        return supabase
          .from('matching_scores')
          .update(fields)
          .eq('call_id', u.call_id)
          .eq('driver_id', u.driver_id)
      })
    )

    for (const { error } of results) {
      if (error) {
        console.error('[matching PATCH] update 실패', error.message)
        failCount++
      }
    }
  }

  if (failCount > 0) {
    return NextResponse.json(
      { error: `${failCount}건 업데이트 실패`, updated_count: updates.length - failCount },
      { status: 500 }
    )
  }

  return NextResponse.json({
    message: '업데이트 완료',
    updated_count: updates.length,
  })
}

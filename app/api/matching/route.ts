import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAgentRun } from '@/lib/agent-logger'
import { scoreDriverForCall, type CallVectorInput, type DriverVectorRow } from '@/lib/matching-vector'

interface CallcardRow extends CallVectorInput {
  callcard_id: string
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
  d_hexagon: string | null
}

interface DriverRow extends DriverVectorRow {
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
  'hour_slot', 'weekday', 'expected_distance', 'expected_fare',
  'is_paid', 'eta_distance', 'is_surge', 's_hexagon', 'd_hexagon',
].join(',')

const DRIVER_COLS = [
  'driver_id', 'asp_id',
  'score_dawn', 'score_morning', 'score_daytime', 'score_night',
  'score_mon', 'score_tue', 'score_wed', 'score_thu', 'score_fri', 'score_sat', 'score_sun',
  'score_short', 'score_medium', 'score_long',
  'score_low_fare', 'score_mid_fare', 'score_high_fare',
  'score_paid', 'score_free',
  'score_surge', 'score_normal',
  'score_near',
  'pref_s_hexagons',
].join(',')

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      error: 'Supabase 환경변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인하세요.',
      supabase: null,
    }
  }

  return {
    error: null,
    supabase: createClient(supabaseUrl, supabaseKey),
  }
}

type SupabaseClientForMatching = NonNullable<ReturnType<typeof getSupabaseClient>['supabase']>

async function fetchCallcards(supabase: SupabaseClientForMatching, callDate: string): Promise<CallcardRow[]> {
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
    all.push(...(data as unknown as CallcardRow[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

async function fetchDrivers(supabase: SupabaseClientForMatching): Promise<DriverRow[]> {
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
    all.push(...(data as unknown as DriverRow[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
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

  const results: MatchScore[] = []

  for (const call of callcards) {
    const pool = driversByAsp.get(call.asp_id)
    if (!pool || pool.length === 0) continue

    const candidates = pool.map((d) => ({
      driver_id: d.driver_id,
      score: scoreDriverForCall(call, d),
    }))

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
  const { supabase, error: supabaseConfigError } = getSupabaseClient()
  if (!supabase) {
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'matching', input_rows: 0, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: supabaseConfigError })
    return NextResponse.json({ error: supabaseConfigError }, { status: 500 })
  }

  try {
    ;[callcards, drivers] = await Promise.all([
      fetchCallcards(supabase, callDate),
      fetchDrivers(supabase),
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
  const { supabase, error: supabaseConfigError } = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: supabaseConfigError }, { status: 500 })
  }

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



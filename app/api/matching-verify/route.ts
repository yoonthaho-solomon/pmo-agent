import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { callToVector, driverToVector, scoreDriverForCall, type CallVectorInput, type DriverVectorRow } from '@/lib/matching-vector'

type CallcardRow = CallVectorInput & {
  callcard_id: string
  asp_id: number
  call_date: string
  s_hexagon: string | null
  d_hexagon: string | null
}

type DriverRow = DriverVectorRow & {
  driver_id: string
  asp_id: number
  pref_s_hexagons: string[] | null
  pref_d_hexagons: string[] | null
  data_days?: number | null
  reliability?: number | null
}

type SavedScoreRow = {
  call_id: string
  driver_id: string
  asp_id: number
  match_date: string
  cosine_score: number
  rank_in_call: number
}

const CALLCARD_COLS = [
  'callcard_id', 'asp_id', 'call_date', 'hour_slot', 'weekday', 'expected_distance', 'expected_fare',
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
  'pref_s_hexagons', 'pref_d_hexagons', 'data_days', 'reliability',
].join(',')

function errorPayload(err: unknown) {
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    return {
      message: typeof record.message === 'string' ? record.message : JSON.stringify(record),
      code: typeof record.code === 'string' ? record.code : undefined,
      hint: typeof record.hint === 'string' ? record.hint : undefined,
      details: typeof record.details === 'string' ? record.details : undefined,
    }
  }
  return { message: String(err) }
}

function createSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'
  if (!supabaseUrl || !supabaseKey) return { source, error: 'Supabase 환경변수가 설정되지 않았습니다.' }
  return { source, supabase: createClient(supabaseUrl, supabaseKey) }
}

async function fetchDriversByAsp(supabase: SupabaseClient, aspId: number): Promise<DriverRow[]> {
  const all: DriverRow[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('driver_mbti')
      .select(DRIVER_COLS)
      .eq('asp_id', aspId)
      .order('driver_id', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as unknown as DriverRow[]))
    if (data.length < page) break
  }
  return all
}

export async function GET(request: NextRequest) {
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ error: client.error }, { status: 500 })
  const { source, supabase } = client

  try {
    const requestedCallId = request.nextUrl.searchParams.get('call_id')
    let call: CallcardRow | null = null

    if (requestedCallId) {
      const { data, error } = await supabase.from('callcard_mbti').select(CALLCARD_COLS).eq('callcard_id', requestedCallId).maybeSingle()
      if (error) throw error
      call = data as unknown as CallcardRow | null
    } else {
      const { data, error } = await supabase
        .from('callcard_mbti')
        .select(CALLCARD_COLS)
        .not('driver_id', 'is', null)
        .not('vehicle_id', 'is', null)
        .order('call_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      call = data as unknown as CallcardRow | null
    }

    if (!call) return NextResponse.json({ source, error: '검증할 callcard_mbti 행이 없습니다.' }, { status: 404 })

    const [drivers, savedRes] = await Promise.all([
      fetchDriversByAsp(supabase, call.asp_id),
      supabase
        .from('matching_scores')
        .select('call_id,driver_id,asp_id,match_date,cosine_score,rank_in_call')
        .eq('call_id', call.callcard_id)
        .order('rank_in_call', { ascending: true })
        .limit(10),
    ])
    if (savedRes.error) throw savedRes.error
    const savedTop10 = (savedRes.data ?? []) as SavedScoreRow[]

    const computedTop10 = drivers
      .map((driver) => ({
        driver_id: driver.driver_id,
        score: Number(scoreDriverForCall(call, driver).toFixed(4)),
        driver_vector: driverToVector(driver),
        data_days: driver.data_days ?? null,
        reliability: driver.reliability ?? null,
      }))
      .sort((a, b) => b.score - a.score || a.driver_id.localeCompare(b.driver_id))
      .slice(0, 10)
      .map((row, index) => ({ ...row, rank: index + 1 }))

    const savedIds = savedTop10.map((row) => row.driver_id)
    const computedIds = computedTop10.map((row) => row.driver_id)
    const overlap = savedIds.filter((id) => computedIds.includes(id)).length
    const rankDiff = computedTop10.map((row) => {
      const saved = savedTop10.find((item) => item.driver_id === row.driver_id)
      return {
        driver_id: row.driver_id,
        computed_rank: row.rank,
        saved_rank: saved?.rank_in_call ?? null,
        computed_score: row.score,
        saved_score: saved?.cosine_score ?? null,
      }
    })

    return NextResponse.json({
      source,
      callcard: call,
      call_vector: callToVector(call),
      driver_pool_size: drivers.length,
      saved_top10: savedTop10,
      computed_top10: computedTop10.map(({ driver_vector: _driverVector, ...row }) => row),
      top10_overlap: overlap,
      rank_diff: rankDiff,
      conclusion: savedTop10.length === 0
        ? 'matching_scores에 저장된 Top 10이 없어 즉시 계산 결과만 확인했습니다.'
        : overlap === 10
          ? '저장 Top 10과 즉시 계산 Top 10이 일치합니다.'
          : '저장 Top 10과 즉시 계산 Top 10에 차이가 있습니다. matching_scores 재계산 시점 또는 과거 계산식 차이를 확인해야 합니다.',
    })
  } catch (err) {
    return NextResponse.json({ source, error: errorPayload(err) }, { status: 500 })
  }
}


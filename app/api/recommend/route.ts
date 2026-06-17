import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callToVector, cosineSimilarity, driverToVector, scoreDriverForCall, type CallVectorInput, type DriverVectorRow } from '@/lib/matching-vector'

interface CallInput extends CallVectorInput {
  asp_id: number
}

interface DriverRow extends DriverVectorRow {
  driver_id: string
  asp_id: number
  pref_s_hexagons: string[]
  pref_d_hexagons: string[]
}

const DRIVER_COLS = [
  'driver_id', 'asp_id',
  'score_dawn', 'score_morning', 'score_daytime', 'score_night',
  'score_mon', 'score_tue', 'score_wed', 'score_thu', 'score_fri', 'score_sat', 'score_sun',
  'score_short', 'score_medium', 'score_long',
  'score_low_fare', 'score_mid_fare', 'score_high_fare',
  'score_paid', 'score_free',
  'score_surge', 'score_normal',
  'score_near',
  'pref_s_hexagons', 'pref_d_hexagons',
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

type SupabaseClientForRecommend = NonNullable<ReturnType<typeof getSupabaseClient>['supabase']>

async function fetchDriversByAsp(supabase: SupabaseClientForRecommend, aspId: number): Promise<DriverRow[]> {
  const all: DriverRow[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('driver_mbti')
      .select(DRIVER_COLS)
      .eq('asp_id', aspId)
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as unknown as DriverRow[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}


const WD_LABELS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']

function pct(score: number): string {
  return `${Math.round(score * 100)}%`
}

function buildMatchReason(call: CallInput, driver: DriverRow): string {
  const factors: { weight: number; label: string }[] = []

  // 시간대 — 비중에 따라 강도 구분
  const h = call.hour_slot
  const [timeScore, timeName] =
    h <= 5  ? [driver.score_dawn,    '새벽'] :
    h <= 11 ? [driver.score_morning, '오전'] :
    h <= 17 ? [driver.score_daytime, '낮 시간대'] :
              [driver.score_night,   '야간']
  if (timeScore > 0.4)
    factors.push({ weight: timeScore, label: `${timeName} 전문 기사 (활동 비중 ${pct(timeScore)})` })
  else if (timeScore > 0.2)
    factors.push({ weight: timeScore, label: `${timeName} 활동 기사` })

  // 요일 — 주말/평일 구분
  const wdScores = [
    driver.score_mon, driver.score_tue, driver.score_wed, driver.score_thu,
    driver.score_fri, driver.score_sat, driver.score_sun,
  ]
  const wdScore = wdScores[call.weekday] ?? 0
  const isWeekend = call.weekday >= 5
  if (wdScore > 0.25)
    factors.push({
      weight: wdScore,
      label: isWeekend
        ? `주말 활동 비중 높음 (${pct(wdScore)})`
        : `${WD_LABELS[call.weekday]} 활동 비중 ${pct(wdScore)}`,
    })

  // 거리 — 강도 구분
  const dist = call.expected_distance ?? 0
  if (dist > 0) {
    const [distScore, distName] =
      dist <= 3000 ? [driver.score_short,  '단거리'] :
      dist <= 8000 ? [driver.score_medium, '중거리'] :
                     [driver.score_long,   '장거리']
    if (distScore > 0.45)
      factors.push({ weight: distScore, label: `${distName} 콜 집중 수락 (${pct(distScore)})` })
    else if (distScore > 0.2)
      factors.push({ weight: distScore, label: `${distName} 콜 선호` })
  }

  // 요금 — 강도 구분
  const fare = call.expected_fare ?? 0
  if (fare > 0) {
    const [fareScore, fareName] =
      fare <= 10000 ? [driver.score_low_fare,  '저요금'] :
      fare <= 20000 ? [driver.score_mid_fare,  '중요금'] :
                      [driver.score_high_fare, '고요금']
    if (fareScore > 0.45)
      factors.push({ weight: fareScore, label: `${fareName} 콜 집중 수락 (${pct(fareScore)})` })
    else if (fareScore > 0.2)
      factors.push({ weight: fareScore, label: `${fareName} 콜 선호` })
  }

  // 유료콜
  if (call.is_paid && driver.score_paid > 0.3)
    factors.push({ weight: driver.score_paid, label: `유료콜 수락률 ${pct(driver.score_paid)}` })
  if (!call.is_paid && driver.score_free > 0.3)
    factors.push({ weight: driver.score_free, label: `무료콜 수락률 ${pct(driver.score_free)}` })

  // 탄력요금
  if (call.is_surge) {
    if (driver.score_surge > 0.3)
      factors.push({ weight: driver.score_surge, label: `탄력요금 콜 적극 수락 (${pct(driver.score_surge)})` })
    else if (driver.score_surge > 0.15)
      factors.push({ weight: driver.score_surge, label: '탄력요금 콜 수락 이력' })
  } else if (driver.score_normal > 0.3) {
    factors.push({ weight: driver.score_normal, label: `일반요금 콜 수락률 ${pct(driver.score_normal)}` })
  }

  // 배차 근접도
  if (driver.score_near > 0.75)
    factors.push({ weight: driver.score_near, label: '배차 거리 매우 가까운 기사' })
  else if (driver.score_near > 0.5)
    factors.push({ weight: driver.score_near, label: '빠른 배차 가능 기사' })

  // 구역 매칭 — 최우선
  if (call.s_hexagon && driver.pref_s_hexagons?.includes(call.s_hexagon))
    factors.push({ weight: 1.1, label: '해당 출발지 구역 수락 이력 다수' })
  if (call.d_hexagon && driver.pref_d_hexagons?.includes(call.d_hexagon))
    factors.push({ weight: 1.0, label: '해당 도착지 구역 수락 이력' })

  factors.sort((a, b) => b.weight - a.weight)
  const top3 = factors.slice(0, 3).map((f) => f.label)
  return top3.length > 0 ? top3.join(' · ') : '전반적 매칭 적합'
}

export async function POST(request: NextRequest) {
  let call: CallInput
  try {
    call = await request.json()
  } catch {
    return NextResponse.json({ error: 'body JSON 파싱 실패' }, { status: 400 })
  }

  const { asp_id, hour_slot, weekday } = call
  if (!asp_id) {
    return NextResponse.json({ error: 'asp_id는 필수입니다.' }, { status: 400 })
  }
  if (hour_slot == null || hour_slot < 0 || hour_slot > 23) {
    return NextResponse.json({ error: 'hour_slot은 0~23 범위여야 합니다.' }, { status: 400 })
  }
  if (weekday == null || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: 'weekday는 0~6 범위여야 합니다.' }, { status: 400 })
  }

  let drivers: DriverRow[]
  const { supabase, error: supabaseConfigError } = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: supabaseConfigError }, { status: 500 })
  }

  try {
    drivers = await fetchDriversByAsp(supabase, asp_id)
  } catch (err) {
    console.error('[recommend] driver_mbti 조회 실패', err)
    return NextResponse.json({ error: 'driver_mbti 조회 실패', detail: String(err) }, { status: 500 })
  }

  if (drivers.length === 0) {
    return NextResponse.json(
      { error: `asp_id ${asp_id}에 해당하는 driver_mbti 데이터가 없습니다.` },
      { status: 422 }
    )
  }

  const call_vector = callToVector(call)
  const scored = drivers.map((d) => {
    const driver_vector = driverToVector(d)
    const cosine = cosineSimilarity(call_vector, driver_vector)
    const start_area_bonus = call.s_hexagon && d.pref_s_hexagons?.includes(call.s_hexagon) ? 0.1 : 0
    const score = scoreDriverForCall(call, d)
    return { driver: d, score, cosine, start_area_bonus }
  })

  scored.sort((a, b) => b.score - a.score)

  const recommended_drivers = scored.slice(0, 10).map((item, i) => ({
    driver_id:    item.driver.driver_id,
    cosine_score: parseFloat(item.score.toFixed(4)),
    vector_cosine: parseFloat(item.cosine.toFixed(4)),
    start_area_bonus: parseFloat(item.start_area_bonus.toFixed(4)),
    final_score: parseFloat(item.score.toFixed(4)),
    rank:         i + 1,
    match_reason: buildMatchReason(call, item.driver),
  }))

  return NextResponse.json({
    asp_id,
    driver_pool_size: drivers.length,
    call_vector,
    score_formula: 'final_score = min(vector_cosine + start_area_bonus, 1)',
    recommended_drivers,
  })
}





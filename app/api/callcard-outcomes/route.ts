import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type OutcomeGroup = 'accepted' | 'expired' | 'canceled' | 'pickup' | 'other' | string

type GroupBy = 'date' | 'asp' | 'hour' | 'weekday' | 's_area' | 'd_area' | 'distance' | 'fare' | 'paid' | 'surge'

type CallOutcomeRow = {
  asp_id: number | null
  call_date: string | null
  hour_slot: number | null
  weekday: number | null
  status_group: OutcomeGroup | null
  s_area: string | null
  d_area: string | null
  passenger_lat: number | null
  passenger_lng: number | null
  dest_lat: number | null
  dest_lng: number | null
  expected_distance: number | null
  expected_fare: number | null
  is_paid: boolean | null
  is_surge: boolean | null
}

type OutcomeStats = {
  total: number
  accepted: number
  expired: number
  canceled: number
  pickup: number
  other: number
  accept_rate: number
  expired_rate: number
  canceled_rate: number
  problem_rate: number
}

type GroupStats = OutcomeStats & {
  key: string
  label: string
}

const SELECT_COLS = [
  'asp_id',
  'call_date',
  'hour_slot',
  'weekday',
  'status_group',
  's_area',
  'd_area',
  'passenger_lat',
  'passenger_lng',
  'dest_lat',
  'dest_lng',
  'expected_distance',
  'expected_fare',
  'is_paid',
  'is_surge',
].join(',')

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

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

function roundRate(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0
}

function emptyStats(): OutcomeStats {
  return {
    total: 0,
    accepted: 0,
    expired: 0,
    canceled: 0,
    pickup: 0,
    other: 0,
    accept_rate: 0,
    expired_rate: 0,
    canceled_rate: 0,
    problem_rate: 0,
  }
}

function addRow(stats: OutcomeStats, row: CallOutcomeRow) {
  stats.total += 1
  const group = row.status_group ?? 'other'
  if (group === 'accepted') stats.accepted += 1
  else if (group === 'expired') stats.expired += 1
  else if (group === 'canceled') stats.canceled += 1
  else if (group === 'pickup') stats.pickup += 1
  else stats.other += 1
}

function finalize(stats: OutcomeStats): OutcomeStats {
  const total = stats.total || 1
  return {
    ...stats,
    accept_rate: roundRate(stats.accepted / total),
    expired_rate: roundRate(stats.expired / total),
    canceled_rate: roundRate(stats.canceled / total),
    problem_rate: roundRate((stats.expired + stats.canceled) / total),
  }
}

function distanceBucket(distance: number | null): string {
  const value = distance ?? 0
  if (value <= 0) return 'unknown'
  if (value <= 3000) return 'short_0_3km'
  if (value <= 8000) return 'medium_3_8km'
  return 'long_8km_plus'
}

function fareBucket(fare: number | null): string {
  const value = fare ?? 0
  if (value <= 0) return 'unknown'
  if (value <= 10000) return 'low_0_10k'
  if (value <= 20000) return 'mid_10_20k'
  return 'high_20k_plus'
}

function coordinateAreaKey(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return 'unknown'
  return `grid_${lat.toFixed(2)}_${lng.toFixed(2)}`
}

function groupKey(row: CallOutcomeRow, groupBy: GroupBy): string {
  if (groupBy === 'date') return row.call_date ?? 'unknown'
  if (groupBy === 'asp') return row.asp_id == null ? 'unknown' : String(row.asp_id)
  if (groupBy === 'hour') return row.hour_slot == null ? 'unknown' : String(row.hour_slot).padStart(2, '0')
  if (groupBy === 'weekday') return row.weekday == null ? 'unknown' : String(row.weekday)
  if (groupBy === 's_area') return row.s_area || coordinateAreaKey(row.passenger_lat, row.passenger_lng)
  if (groupBy === 'd_area') return row.d_area || coordinateAreaKey(row.dest_lat, row.dest_lng)
  if (groupBy === 'distance') return distanceBucket(row.expected_distance)
  if (groupBy === 'fare') return fareBucket(row.expected_fare)
  if (groupBy === 'paid') return row.is_paid ? 'paid' : 'free'
  if (groupBy === 'surge') return row.is_surge ? 'surge' : 'normal'
  return 'unknown'
}

function groupLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === 'hour') return key === 'unknown' ? '시간 미상' : `${Number(key)}시`
  if (groupBy === 'weekday') return key === 'unknown' ? '요일 미상' : WEEKDAYS[Number(key)] ?? key
  if (groupBy === 'distance') {
    if (key === 'short_0_3km') return '단거리 0-3km'
    if (key === 'medium_3_8km') return '중거리 3-8km'
    if (key === 'long_8km_plus') return '장거리 8km+'
  }
  if (groupBy === 'fare') {
    if (key === 'low_0_10k') return '저요금 1만원 이하'
    if (key === 'mid_10_20k') return '중요금 1-2만원'
    if (key === 'high_20k_plus') return '고요금 2만원 초과'
  }
  if (groupBy === 'paid') return key === 'paid' ? '유료콜' : '무료콜'
  if (groupBy === 'surge') return key === 'surge' ? '탄력/할증' : '일반'
  if ((groupBy === 's_area' || groupBy === 'd_area') && key.startsWith('grid_')) return key.replace('grid_', '').replace('_', ', ') + ' 격자'
  return key
}

type OutcomeFilters = { dateFrom?: string | null; dateTo?: string | null; aspId?: number | null }

function applyFilters<T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T; eq: (column: string, value: number) => T }>(
  query: T,
  filters: OutcomeFilters
): T {
  let next = query
  if (filters.dateFrom) next = next.gte('call_date', filters.dateFrom)
  if (filters.dateTo) next = next.lte('call_date', filters.dateTo)
  if (filters.aspId != null) next = next.eq('asp_id', filters.aspId)
  return next
}

async function fetchSequentialOutcomeRows(supabase: SupabaseClient, filters: OutcomeFilters): Promise<CallOutcomeRow[]> {
  const page = 1000
  const rows: CallOutcomeRow[] = []

  for (let from = 0; ; from += page) {
    const baseDataQuery: any = supabase
      .from('callcard_mbti')
      .select(SELECT_COLS)
      .not('status_group', 'is', null)
      .order('callcard_id', { ascending: true })
      .range(from, from + page - 1)
    const query = applyFilters(baseDataQuery, filters)
    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as CallOutcomeRow[]))
    if (data.length < page) break
  }

  return rows
}
async function fetchOutcomeRows(supabase: SupabaseClient, filters: OutcomeFilters): Promise<CallOutcomeRow[]> {
  if (filters.aspId != null) return fetchSequentialOutcomeRows(supabase, filters)

  const page = 1000
  const concurrency = 8
  const baseCountQuery: any = supabase.from('callcard_mbti').select('*', { count: 'exact', head: true }).not('status_group', 'is', null)
  const countQuery = applyFilters(baseCountQuery, filters)
  const { count, error: countError } = await countQuery
  if (countError) throw countError
  const total = count ?? 0
  if (total === 0) return []

  const ranges: { from: number; to: number }[] = []
  for (let from = 0; from < total; from += page) {
    ranges.push({ from, to: Math.min(from + page - 1, total - 1) })
  }

  const rows: CallOutcomeRow[] = []
  let cursor = 0

  async function worker() {
    while (cursor < ranges.length) {
      const range = ranges[cursor]
      cursor += 1
      const baseDataQuery: any = supabase
        .from('callcard_mbti')
        .select(SELECT_COLS)
        .not('status_group', 'is', null)
        .order('callcard_id', { ascending: true })
        .range(range.from, range.to)
      const query = applyFilters(baseDataQuery, filters)
      const { data, error } = await query
      if (error) throw error
      if (data) rows.push(...(data as unknown as CallOutcomeRow[]))
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, ranges.length) }, () => worker()))
  return rows
}

export async function GET(request: NextRequest) {
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ source: client.source, error: client.error }, { status: 500 })
  const { source, supabase } = client

  try {
    const params = request.nextUrl.searchParams
    const groupBy = (params.get('group_by') || 'date') as GroupBy
    const limit = Math.min(Math.max(Number(params.get('limit') ?? 20), 1), 100)
    const dateFrom = params.get('date_from')
    const dateTo = params.get('date_to')
    const aspRaw = params.get('asp_id')
    const aspId = aspRaw ? Number(aspRaw) : null

    if (!['date', 'asp', 'hour', 'weekday', 's_area', 'd_area', 'distance', 'fare', 'paid', 'surge'].includes(groupBy)) {
      return NextResponse.json({ source, error: '지원하지 않는 group_by입니다.' }, { status: 400 })
    }

    if (aspRaw && !Number.isFinite(aspId)) {
      return NextResponse.json({ source, error: 'asp_id는 숫자여야 합니다.' }, { status: 400 })
    }

    const rows = await fetchOutcomeRows(supabase, { dateFrom, dateTo, aspId })
    const summary = emptyStats()
    const groupMap = new Map<string, OutcomeStats>()

    for (const row of rows) {
      addRow(summary, row)
      const key = groupKey(row, groupBy)
      if (!groupMap.has(key)) groupMap.set(key, emptyStats())
      addRow(groupMap.get(key)!, row)
    }

    const groups: GroupStats[] = Array.from(groupMap.entries()).map(([key, stats]) => ({
      key,
      label: groupLabel(key, groupBy),
      ...finalize(stats),
    }))

    groups.sort((a, b) => {
      if (groupBy === 'date' || groupBy === 'hour' || groupBy === 'weekday') return a.key.localeCompare(b.key)
      return b.problem_rate - a.problem_rate || b.total - a.total || a.key.localeCompare(b.key)
    })

    const riskGroups = groups
      .filter((item) => item.total >= 30)
      .slice()
      .sort((a, b) => b.problem_rate - a.problem_rate || b.total - a.total)
      .slice(0, limit)

    return NextResponse.json({
      source,
      filters: { date_from: dateFrom, date_to: dateTo, asp_id: aspId, group_by: groupBy, limit },
      summary: finalize(summary),
      groups: groups.slice(0, limit),
      risk_groups: riskGroups,
      notes: [
        'outcome은 콜의 최종 결과입니다: accepted, expired, canceled, pickup, other.',
        'problem_rate는 (expired + canceled) / total 입니다.',
        '이 API는 읽기 전용이며 Supabase 데이터를 수정하지 않습니다.',
      ],
    })
  } catch (err) {
    return NextResponse.json({ source, error: errorPayload(err) }, { status: 500 })
  }
}

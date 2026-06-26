import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  VECTOR_DIMENSIONS,
  callToVector,
  driverToVector,
  cosineSimilarity,
  cosineSimilarityForMatching,
  type CallVectorInput,
  type DriverVectorRow,
} from '@/lib/matching-vector'
import { DISPLAY_AXES, vectorToDisplayAxisBundle } from '@/lib/matching-display-axis'

export const dynamic = 'force-dynamic'

export type VectorSampleDim = {
  key: string
  label: string
  group: string
  call: number
  drv: number
}

export type VectorSampleAxis = {
  key: string
  label: string
  call: number
  drv: number
}

export type VectorSampleDriver = {
  id: string
  rank: number
  cosineScore: number
  dims: VectorSampleDim[]
  axes: VectorSampleAxis[]
  cosineSimilarity: number
  cosineForMatching: number
}

export type VectorSampleData = {
  callcard: {
    id: string
    callDate: string
    hourSlot: number
    weekday: number
    expectedDistance: number
    expectedFare: number
    isPaid: boolean
    isSurge: boolean
    passengerAddr: string | null
    destAddr: string | null
  }
  // Top-N candidate drivers for this callcard, ranked by match order. drivers[0] is best.
  drivers: VectorSampleDriver[]
}

const SAMPLE_TOP_N = 8

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ ok: false, message: 'Missing Supabase env' }, { status: 500 })
  }

  const supabase = createClient(url, key)

  // 1. Latest callcard
  const { data: callcards, error: callError } = await supabase
    .from('callcard_mbti')
    .select('callcard_id,call_date,hour_slot,weekday,expected_distance,expected_fare,is_paid,is_surge,eta_distance,s_hexagon,d_hexagon,passenger_addr,dest_addr')
    .order('call_date', { ascending: false })
    .limit(1)

  if (callError || !callcards?.length) {
    return NextResponse.json({ ok: false, message: callError?.message ?? 'No callcard found' }, { status: 502 })
  }

  const cc = callcards[0]

  // 2. Top-N ranked matches for this callcard
  const { data: matches, error: matchError } = await supabase
    .from('matching_scores')
    .select('driver_id,rank_in_call,cosine_score')
    .eq('call_id', cc.callcard_id)
    .order('rank_in_call', { ascending: true })
    .limit(SAMPLE_TOP_N)

  if (matchError || !matches?.length) {
    return NextResponse.json({ ok: false, message: matchError?.message ?? 'No match found for callcard' }, { status: 502 })
  }

  // 3. Driver MBTI vectors for all ranked candidates
  const driverSelect = ['driver_id', ...VECTOR_DIMENSIONS.map((d) => d.key)].join(',')
  const driverIds = matches.map((m) => m.driver_id)
  const { data: driverRows, error: drvError } = await supabase
    .from('driver_mbti')
    .select(driverSelect)
    .in('driver_id', driverIds)

  if (drvError || !driverRows?.length) {
    return NextResponse.json({ ok: false, message: drvError?.message ?? 'Drivers not found' }, { status: 502 })
  }

  const driverById = new Map(driverRows.map((row) => [(row as unknown as { driver_id: string }).driver_id, row]))

  // 4. Callcard vector (computed once, shared across candidates)
  const callInput: CallVectorInput = {
    hour_slot: Number(cc.hour_slot ?? 0),
    weekday: Number(cc.weekday ?? 0),
    expected_distance: Number(cc.expected_distance ?? 0),
    expected_fare: Number(cc.expected_fare ?? 0),
    is_paid: Boolean(cc.is_paid),
    is_surge: Boolean(cc.is_surge),
    eta_distance: cc.eta_distance != null ? Number(cc.eta_distance) : null,
    s_hexagon: cc.s_hexagon ?? null,
    d_hexagon: cc.d_hexagon ?? null,
  }
  const callVec = callToVector(callInput)
  const callBundle = vectorToDisplayAxisBundle(callVec)

  // 5. Build a per-driver bundle (22D dims + 5-axis radar + cosine) in rank order
  const driversOut: VectorSampleData['drivers'] = []
  for (const match of matches) {
    const drv = driverById.get(match.driver_id)
    if (!drv) continue
    const drvVec = driverToVector(drv as unknown as DriverVectorRow)
    const dims: VectorSampleDim[] = VECTOR_DIMENSIONS.map((dim, i) => ({
      key: dim.key,
      label: dim.label,
      group: dim.group,
      call: callVec[i],
      drv: drvVec[i],
    }))
    const drvBundle = vectorToDisplayAxisBundle(drvVec)
    const axes: VectorSampleAxis[] = DISPLAY_AXES.map((axis, i) => ({
      key: axis.key,
      label: axis.name,
      call: callBundle.axis[i] / 100,
      drv: drvBundle.axis[i] / 100,
    }))
    driversOut.push({
      id: match.driver_id,
      rank: match.rank_in_call,
      cosineScore: match.cosine_score,
      dims,
      axes,
      cosineSimilarity: cosineSimilarity(callVec, drvVec),
      cosineForMatching: cosineSimilarityForMatching(callVec, drvVec),
    })
  }

  if (!driversOut.length) {
    return NextResponse.json({ ok: false, message: 'No driver vectors available for matches' }, { status: 502 })
  }

  const data: VectorSampleData = {
    callcard: {
      id: cc.callcard_id,
      callDate: cc.call_date,
      hourSlot: Number(cc.hour_slot),
      weekday: Number(cc.weekday),
      expectedDistance: Number(cc.expected_distance),
      expectedFare: Number(cc.expected_fare),
      isPaid: Boolean(cc.is_paid),
      isSurge: Boolean(cc.is_surge),
      passengerAddr: cc.passenger_addr ?? null,
      destAddr: cc.dest_addr ?? null,
    },
    drivers: driversOut,
  }

  return NextResponse.json({ ok: true, data })
}

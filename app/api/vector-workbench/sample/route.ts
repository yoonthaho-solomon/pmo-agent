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
  driver: {
    id: string
    rank: number
    cosineScore: number
  }
  dims: VectorSampleDim[]
  axes: VectorSampleAxis[]
  cosineSimilarity: number
  cosineForMatching: number
}

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

  // 2. Top-ranked match for this callcard
  const { data: matches, error: matchError } = await supabase
    .from('matching_scores')
    .select('driver_id,rank_in_call,cosine_score')
    .eq('call_id', cc.callcard_id)
    .order('rank_in_call', { ascending: true })
    .limit(1)

  if (matchError || !matches?.length) {
    return NextResponse.json({ ok: false, message: matchError?.message ?? 'No match found for callcard' }, { status: 502 })
  }

  const match = matches[0]

  // 3. Driver MBTI vector
  const driverSelect = ['driver_id', ...VECTOR_DIMENSIONS.map((d) => d.key)].join(',')
  const { data: drivers, error: drvError } = await supabase
    .from('driver_mbti')
    .select(driverSelect)
    .eq('driver_id', match.driver_id)
    .limit(1)

  if (drvError || !drivers?.length) {
    return NextResponse.json({ ok: false, message: drvError?.message ?? 'Driver not found' }, { status: 502 })
  }

  const drv = drivers[0]

  // 4. Compute vectors
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
  const drvVec = driverToVector(drv as unknown as DriverVectorRow)

  // 5. 22D factor array
  const dims: VectorSampleDim[] = VECTOR_DIMENSIONS.map((dim, i) => ({
    key: dim.key,
    label: dim.label,
    group: dim.group,
    call: callVec[i],
    drv: drvVec[i],
  }))

  // 6. 5-axis radar array (vectorToDisplayAxisBundle returns 0-100, normalize to 0-1)
  const callBundle = vectorToDisplayAxisBundle(callVec)
  const drvBundle = vectorToDisplayAxisBundle(drvVec)
  const axes: VectorSampleAxis[] = DISPLAY_AXES.map((axis, i) => ({
    key: axis.key,
    label: axis.name,
    call: callBundle.axis[i] / 100,
    drv: drvBundle.axis[i] / 100,
  }))

  // 7. Similarity scores
  const cosineAll = cosineSimilarity(callVec, drvVec)
  const cosineMatching = cosineSimilarityForMatching(callVec, drvVec)

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
    driver: {
      id: match.driver_id,
      rank: match.rank_in_call,
      cosineScore: match.cosine_score,
    },
    dims,
    axes,
    cosineSimilarity: cosineAll,
    cosineForMatching: cosineMatching,
  }

  return NextResponse.json({ ok: true, data })
}

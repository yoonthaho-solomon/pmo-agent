import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  VECTOR_DIMENSIONS,
  callToVector,
  driverToVector,
  type CallVectorInput,
  type DriverVectorRow,
} from '@/lib/matching-vector'

export const dynamic = 'force-dynamic'

// Lazy-loaded population for the PCA embedding scatter: the latest callcard's vector plus a
// capped sample of driver vectors (with the callcard's top candidates guaranteed included).
export type EmbeddingPoint = {
  id: string
  isCandidate: boolean
  vector: number[]
}

export type EmbeddingData = {
  callcardVector: number[]
  points: EmbeddingPoint[]
}

const BACKGROUND_SAMPLE = 220

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ ok: false, message: 'Missing Supabase env' }, { status: 500 })
  }

  const supabase = createClient(url, key)
  const driverSelect = ['driver_id', ...VECTOR_DIMENSIONS.map((d) => d.key)].join(',')

  // 1. Latest callcard (same selection as the sample route)
  const { data: callcards, error: callError } = await supabase
    .from('callcard_mbti')
    .select('callcard_id,hour_slot,weekday,expected_distance,expected_fare,is_paid,is_surge,eta_distance,s_hexagon,d_hexagon')
    .order('call_date', { ascending: false })
    .limit(1)

  if (callError || !callcards?.length) {
    return NextResponse.json({ ok: false, message: callError?.message ?? 'No callcard found' }, { status: 502 })
  }
  const cc = callcards[0]

  // 2. Candidate driver ids for this callcard (to guarantee they appear + highlight them)
  const { data: matches } = await supabase
    .from('matching_scores')
    .select('driver_id')
    .eq('call_id', cc.callcard_id)
    .order('rank_in_call', { ascending: true })
    .limit(8)
  const candidateIds = new Set((matches ?? []).map((m) => m.driver_id))

  // 3. Background sample of drivers + the candidate drivers
  const { data: sampleRows, error: sampleError } = await supabase
    .from('driver_mbti')
    .select(driverSelect)
    .limit(BACKGROUND_SAMPLE)
  if (sampleError) {
    return NextResponse.json({ ok: false, message: sampleError.message }, { status: 502 })
  }

  const byId = new Map<string, Record<string, unknown>>()
  for (const row of sampleRows ?? []) {
    const r = row as unknown as { driver_id: string } & Record<string, unknown>
    byId.set(r.driver_id, r)
  }

  if (candidateIds.size) {
    const missing = [...candidateIds].filter((id) => !byId.has(id))
    if (missing.length) {
      const { data: candRows } = await supabase.from('driver_mbti').select(driverSelect).in('driver_id', missing)
      for (const row of candRows ?? []) {
        const r = row as unknown as { driver_id: string } & Record<string, unknown>
        byId.set(r.driver_id, r)
      }
    }
  }

  // 4. Vectors
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

  const points: EmbeddingPoint[] = []
  for (const [id, row] of byId) {
    points.push({
      id,
      isCandidate: candidateIds.has(id),
      vector: driverToVector(row as unknown as DriverVectorRow),
    })
  }

  const data: EmbeddingData = {
    callcardVector: callToVector(callInput),
    points,
  }

  return NextResponse.json({ ok: true, data })
}

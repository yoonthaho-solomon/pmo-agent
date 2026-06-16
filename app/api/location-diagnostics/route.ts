import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  adaptCallcardLocation,
  buildLocationFromCallcardFields,
  type CallcardLocationRow,
} from '@/lib/callcard-location-adapter'

type AllowedAspId = 137 | 147 | 160

type CallcardLocationDiagnosticsRow = CallcardLocationRow & {
  callcard_id: string
  asp_id: number | null
  call_date: string | null
}

type LocationSideSummary = {
  coordinateValidCount: number
  coordinateValidRate: number | null
  storedH3PresentCount: number
  storedH3ValidRes7Count: number
  storedH3ValidRes7Rate: number | null
  coordinateH3GeneratedCount: number
  coordinateH3GeneratedRate: number | null
  comparableCount: number
  matchedCount: number
  mismatchedCount: number
  matchRate: number | null
  mismatchRate: number | null
}

type LocationDiagnosticsSummary = {
  totalRows: number
  pickup: LocationSideSummary
  destination: LocationSideSummary
  od: {
    odKeyAvailableCount: number
    odKeyAvailableRate: number | null
  }
}

type MismatchSample = {
  callcardId: string
  storedH3: string
  coordinateH3: string
  lat: number
  lng: number
}

const SELECT_COLUMNS = [
  'callcard_id',
  'asp_id',
  'call_date',
  'passenger_lat',
  'passenger_lng',
  'dest_lat',
  'dest_lng',
  's_hexagon',
  'd_hexagon',
].join(',')

const ALLOWED_ASP_IDS = new Set<number>([137, 147, 160])
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2000
const ADAPTER_VERSION = 'callcard-location-adapter-v1'

function createSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return { error: 'Supabase environment variables are not configured.' }
  return { supabase: createClient(supabaseUrl, supabaseKey) }
}

function toRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function emptySideSummary(): LocationSideSummary {
  return {
    coordinateValidCount: 0,
    coordinateValidRate: null,
    storedH3PresentCount: 0,
    storedH3ValidRes7Count: 0,
    storedH3ValidRes7Rate: null,
    coordinateH3GeneratedCount: 0,
    coordinateH3GeneratedRate: null,
    comparableCount: 0,
    matchedCount: 0,
    mismatchedCount: 0,
    matchRate: null,
    mismatchRate: null,
  }
}

function parseAspId(value: string | null): AllowedAspId | null {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || !ALLOWED_ASP_IDS.has(parsed)) return null
  return parsed as AllowedAspId
}

function toStoredAspId(aspId: AllowedAspId): number {
  return aspId * 1_000_000_000
}

function parseLimit(value: string | null): number | null {
  if (value == null || value.trim() === '') return DEFAULT_LIMIT
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) return null
  return parsed
}

function parseBoolean(value: string | null): boolean {
  return value === 'true'
}

function isValidCallDate(value: string | null): boolean {
  return value == null || /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function hasStoredH3(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function finalizeSide(summary: LocationSideSummary, totalRows: number): LocationSideSummary {
  return {
    ...summary,
    coordinateValidRate: toRate(summary.coordinateValidCount, totalRows),
    storedH3ValidRes7Rate: toRate(summary.storedH3ValidRes7Count, summary.storedH3PresentCount),
    coordinateH3GeneratedRate: toRate(summary.coordinateH3GeneratedCount, totalRows),
    matchRate: toRate(summary.matchedCount, summary.comparableCount),
    mismatchRate: toRate(summary.mismatchedCount, summary.comparableCount),
  }
}

function addSample(samples: MismatchSample[], sample: MismatchSample) {
  if (samples.length < 10) samples.push(sample)
}

async function fetchRows(
  supabase: SupabaseClient,
  aspId: AllowedAspId,
  callDate: string | null,
  limit: number,
): Promise<CallcardLocationDiagnosticsRow[]> {
  let query = supabase
    .from('callcard_mbti')
    .select(SELECT_COLUMNS)
    .eq('asp_id', toStoredAspId(aspId))
    .order('call_date', { ascending: false })
    .limit(limit)

  if (callDate) query = query.eq('call_date', callDate)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as CallcardLocationDiagnosticsRow[]
}

export async function GET(request: NextRequest) {
  const aspId = parseAspId(request.nextUrl.searchParams.get('asp_id'))
  if (!aspId) return NextResponse.json({ error: 'asp_id must be one of 137, 147, 160.' }, { status: 400 })

  const limit = parseLimit(request.nextUrl.searchParams.get('limit'))
  if (limit == null) return NextResponse.json({ error: `limit must be an integer from 1 to ${MAX_LIMIT}.` }, { status: 400 })

  const callDate = request.nextUrl.searchParams.get('call_date')
  if (!isValidCallDate(callDate)) return NextResponse.json({ error: 'call_date must be YYYY-MM-DD.' }, { status: 400 })

  const includeSamples = parseBoolean(request.nextUrl.searchParams.get('include_samples'))
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ error: client.error }, { status: 500 })

  try {
    const rows = await fetchRows(client.supabase, aspId, callDate, limit)
    const pickup = emptySideSummary()
    const destination = emptySideSummary()
    const pickupMismatches: MismatchSample[] = []
    const destinationMismatches: MismatchSample[] = []
    let odKeyAvailableCount = 0

    for (const row of rows) {
      const adapted = adaptCallcardLocation(row)
      const pickupDetail = buildLocationFromCallcardFields({
        lat: row.passenger_lat,
        lng: row.passenger_lng,
        storedH3: row.s_hexagon,
      })
      const destinationDetail = buildLocationFromCallcardFields({
        lat: row.dest_lat,
        lng: row.dest_lng,
        storedH3: row.d_hexagon,
      })

      if (adapted.diagnostics.pickupCoordinateValid) pickup.coordinateValidCount += 1
      if (adapted.diagnostics.destinationCoordinateValid) destination.coordinateValidCount += 1
      if (hasStoredH3(row.s_hexagon)) pickup.storedH3PresentCount += 1
      if (hasStoredH3(row.d_hexagon)) destination.storedH3PresentCount += 1
      if (pickupDetail.storedH3Res7) pickup.storedH3ValidRes7Count += 1
      if (destinationDetail.storedH3Res7) destination.storedH3ValidRes7Count += 1
      if (pickupDetail.coordinateH3Res7) pickup.coordinateH3GeneratedCount += 1
      if (destinationDetail.coordinateH3Res7) destination.coordinateH3GeneratedCount += 1

      if (pickupDetail.storedH3Res7 && pickupDetail.coordinateH3Res7 && pickupDetail.coordinateValid) {
        pickup.comparableCount += 1
        if (pickupDetail.storedH3Res7 === pickupDetail.coordinateH3Res7) pickup.matchedCount += 1
        else {
          pickup.mismatchedCount += 1
          addSample(pickupMismatches, {
            callcardId: row.callcard_id,
            storedH3: pickupDetail.storedH3Res7,
            coordinateH3: pickupDetail.coordinateH3Res7,
            lat: pickupDetail.location.lat ?? 0,
            lng: pickupDetail.location.lng ?? 0,
          })
        }
      }

      if (destinationDetail.storedH3Res7 && destinationDetail.coordinateH3Res7 && destinationDetail.coordinateValid) {
        destination.comparableCount += 1
        if (destinationDetail.storedH3Res7 === destinationDetail.coordinateH3Res7) destination.matchedCount += 1
        else {
          destination.mismatchedCount += 1
          addSample(destinationMismatches, {
            callcardId: row.callcard_id,
            storedH3: destinationDetail.storedH3Res7,
            coordinateH3: destinationDetail.coordinateH3Res7,
            lat: destinationDetail.location.lat ?? 0,
            lng: destinationDetail.location.lng ?? 0,
          })
        }
      }

      if (adapted.route.originDestinationKey) odKeyAvailableCount += 1
    }

    const totalRows = rows.length
    const response = {
      filters: {
        aspId,
        callDate,
        limit,
      },
      summary: {
        totalRows,
        pickup: finalizeSide(pickup, totalRows),
        destination: finalizeSide(destination, totalRows),
        od: {
          odKeyAvailableCount,
          odKeyAvailableRate: toRate(odKeyAvailableCount, totalRows),
        },
      } satisfies LocationDiagnosticsSummary,
      ...(includeSamples
        ? {
          samples: {
            pickupMismatches,
            destinationMismatches,
          },
        }
        : {}),
      metadata: {
        readOnly: true,
        generatedAt: new Date().toISOString(),
        adapterVersion: ADAPTER_VERSION,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('location diagnostics query failed', error)
    return NextResponse.json({ error: 'location diagnostics query failed.' }, { status: 500 })
  }
}

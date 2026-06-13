import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type CheckStatus = 'ok' | 'missing' | 'error'

type ReadinessCheck = {
  key: string
  label: string
  table: string
  column?: string
  status: CheckStatus
  message: string
  code?: string
}

async function checkColumn(supabase: SupabaseClient, key: string, label: string, table: string, column: string): Promise<ReadinessCheck> {
  const { error } = await supabase.from(table).select(column).limit(1)
  if (!error) {
    return { key, label, table, column, status: 'ok', message: '사용 가능' }
  }
  const missing = error.code === 'PGRST204' || error.code === 'PGRST205' || error.code === '42703' || error.message.includes('Could not find') || error.message.includes('does not exist')
  return {
    key,
    label,
    table,
    column,
    status: missing ? 'missing' : 'error',
    message: error.message,
    code: error.code,
  }
}

async function checkTable(supabase: SupabaseClient, key: string, label: string, table: string): Promise<ReadinessCheck> {
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (!error) {
    return { key, label, table, status: 'ok', message: '사용 가능' }
  }
  const missing = error.code === 'PGRST205' || error.message.includes('Could not find') || error.message.includes('does not exist')
  return {
    key,
    label,
    table,
    status: missing ? 'missing' : 'error',
    message: error.message,
    code: error.code,
  }
}

async function countRows(supabase: SupabaseClient, table: string): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return null
  return count
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const [checks, driverVehicleMapRows] = await Promise.all([
    Promise.all([
      checkColumn(supabase, 'callcard_driver_id', '호출 원천 driver_id 보존', 'callcard_mbti', 'driver_id'),
      checkColumn(supabase, 'callcard_vehicle_id', '호출 원천 vehicle_id 보존', 'callcard_mbti', 'vehicle_id'),
      checkColumn(supabase, 'meter_driver_id', '앱미터 일별 driver_id 연결', 'meter_daily_logs', 'driver_id'),
      checkColumn(supabase, 'meter_driver_key', '앱미터 기사별 driver_key', 'meter_driver_logs', 'driver_key'),
      checkTable(supabase, 'driver_vehicle_map', 'driver_id-차량번호 매핑 테이블', 'driver_vehicle_map'),
      checkColumn(supabase, 'map_driver_id', '매핑 driver_id 컬럼', 'driver_vehicle_map', 'driver_id'),
      checkColumn(supabase, 'map_vehicle_id', '매핑 vehicle_id 컬럼', 'driver_vehicle_map', 'vehicle_id'),
      checkColumn(supabase, 'map_vehicle_no', '매핑 차량번호 컬럼', 'driver_vehicle_map', 'vehicle_no'),
      checkColumn(supabase, 'map_driver_key', '매핑 driver_key 컬럼', 'driver_vehicle_map', 'driver_key'),
    ]),
    countRows(supabase, 'driver_vehicle_map'),
  ])

  const readyCount = checks.filter((item) => item.status === 'ok').length
  const missingCount = checks.filter((item) => item.status === 'missing').length
  const errorCount = checks.filter((item) => item.status === 'error').length
  const hasUsableMapTable = (driverVehicleMapRows ?? 0) > 0
    && checks.some((item) => item.key === 'map_driver_id' && item.status === 'ok')
    && checks.some((item) => ['map_vehicle_id', 'map_vehicle_no', 'map_driver_key'].includes(item.key) && item.status === 'ok')
  const canLinkWithoutSchemaChange = hasUsableMapTable
    || (checks.some((item) => item.key === 'callcard_vehicle_id' && item.status === 'ok') && checks.some((item) => item.key === 'meter_driver_id' && item.status === 'ok'))

  return NextResponse.json({
    source,
    readyCount,
    missingCount,
    errorCount,
    driverVehicleMapRows,
    hasUsableMapTable,
    canLinkWithoutSchemaChange,
    checks,
    conclusion: canLinkWithoutSchemaChange
      ? '현재 스키마 안에서 기사-앱미터 연결을 시도할 수 있는 키와 데이터가 있습니다.'
      : '현재 스키마에는 앱미터 driver_key를 기존 driver_id로 연결할 보존 키 또는 매핑 데이터가 부족합니다.',
    minimumPlan: [
      'callcard_mbti 또는 별도 원천 테이블에 driver_id, vehicle_id를 보존합니다.',
      '앱미터 driver_key에서 차량번호 후보를 분리합니다.',
      'driver_id, vehicle_id, 차량번호 후보를 연결하는 driver_vehicle_map을 만듭니다.',
      '매칭 점수에는 mock 없이 연결된 기사만 앱미터 신뢰도/운행패턴을 합류합니다.',
    ],
  })
}

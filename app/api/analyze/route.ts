import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// remapped 파일: KPI 계산의 기준 (ASP_ID, EXPIRED_OUTCOME, STATUS, SURGE_PRICE)
interface RemappedRow {
  ASP_ID?: number | string
  asp_id?: number | string
  EXPIRED_OUTCOME?: string
  STATUS?: string
  SURGE_PRICE?: number | string
  surge_price_A?: number | string
  [key: string]: unknown
}

// callcard_eta 파일: avg_accept_eta 계산용 (asp_id, accept_eta)
interface CallcardRow {
  asp_id?: number | string
  ASP_ID?: number | string
  accept_eta?: number | string
  ACCEPTED_TAXI_ETA?: number | string
  [key: string]: unknown
}

interface KpiResult {
  asp_id: number
  total_calls: number
  success_count: number
  expired_count: number
  canceled_count: number
  success_rate: number
  surge_call_cnt: number
  avg_accept_eta: number | null
}

function parseSheet<T>(buffer: ArrayBuffer): T[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<T>(sheet)
}

function getAspId(row: RemappedRow | CallcardRow): number {
  const raw = (row as RemappedRow).ASP_ID ?? (row as RemappedRow).asp_id
  return Number(raw)
}

function computeKpis(remappedRows: RemappedRow[], callcardRows: CallcardRow[]): KpiResult[] {
  const map = new Map<number, {
    total_calls: number
    success_count: number
    expired_count: number
    canceled_count: number
    surge_call_cnt: number
  }>()

  for (const row of remappedRows) {
    const aspId = getAspId(row)
    if (!aspId || isNaN(aspId)) continue

    if (!map.has(aspId)) {
      map.set(aspId, {
        total_calls: 0,
        success_count: 0,
        expired_count: 0,
        canceled_count: 0,
        surge_call_cnt: 0,
      })
    }

    const kpi = map.get(aspId)!
    kpi.total_calls++

    const outcome = String(row.EXPIRED_OUTCOME ?? '').trim().toUpperCase()
    if (outcome === 'ACCEPTED') kpi.success_count++
    if (outcome === 'EXPIRED') kpi.expired_count++

    const status = String(row.STATUS ?? '').trim().toUpperCase()
    if (status === 'CANCELED' || status === 'D_CANCELED') kpi.canceled_count++

    const surge = Number(row.SURGE_PRICE ?? row.surge_price_A ?? 0)
    if (surge > 0) kpi.surge_call_cnt++
  }

  // avg_accept_eta: callcard 파일의 accept_eta (수락된 콜만)
  const etaSum = new Map<number, number>()
  const etaCnt = new Map<number, number>()
  for (const row of callcardRows) {
    const aspId = getAspId(row)
    if (!aspId || isNaN(aspId)) continue
    const eta = Number(row.accept_eta ?? row.ACCEPTED_TAXI_ETA ?? 0)
    if (eta > 0) {
      etaSum.set(aspId, (etaSum.get(aspId) ?? 0) + eta)
      etaCnt.set(aspId, (etaCnt.get(aspId) ?? 0) + 1)
    }
  }

  const results: KpiResult[] = []
  for (const [aspId, kpi] of map.entries()) {
    const denominator = kpi.total_calls - kpi.canceled_count
    const success_rate = denominator > 0
      ? parseFloat((kpi.success_count / denominator).toFixed(4))
      : 0

    const cnt = etaCnt.get(aspId) ?? 0
    const avg_accept_eta = cnt > 0
      ? parseFloat(((etaSum.get(aspId) ?? 0) / cnt).toFixed(1))
      : null

    results.push({ asp_id: aspId, ...kpi, success_rate, avg_accept_eta })
  }

  return results
}

async function generateAiSummaries(kpis: KpiResult[], serviceDate: string): Promise<Map<number, string>> {
  const kpiJson = JSON.stringify(kpis, null, 2)

  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: `당신은 PMO(프로젝트 관리 오피스) 분석가입니다. 아래는 ${serviceDate} 날짜의 ASP별 콜 KPI 데이터입니다.

각 ASP에 대해 2~3문장의 한국어 성과 요약을 작성하세요.
- 수락률(success_rate), 만료 건수, 취소 건수, 서지 콜 수, 평균 수락 ETA를 중심으로 분석
- 우수한 지표는 긍정적으로, 개선이 필요한 지표는 구체적으로 언급
- 실무 담당자가 바로 활용할 수 있는 간결하고 명확한 문장

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{
  "summaries": {
    "<asp_id>": "<요약 텍스트>",
    ...
  }
}

KPI 데이터:
${kpiJson}`,
      },
    ],
  })

  const message = await stream.finalMessage()

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude 응답에 텍스트 블록이 없습니다.')
  }

  const raw = textBlock.text.trim()
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(jsonStr) as { summaries: Record<string, string> }

  const result = new Map<number, string>()
  for (const [aspIdStr, summary] of Object.entries(parsed.summaries)) {
    result.set(Number(aspIdStr), summary)
  }
  return result
}

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data 파싱 실패' }, { status: 400 })
  }

  const callcardFile = formData.get('callcard_eta') as File | null
  const remappedFile = formData.get('remapped') as File | null
  const serviceDate = formData.get('service_date') as string | null

  if (!callcardFile || !remappedFile) {
    return NextResponse.json(
      { error: 'callcard_eta, remapped 파일 모두 필요합니다.' },
      { status: 400 }
    )
  }

  if (!serviceDate) {
    return NextResponse.json(
      { error: 'service_date(YYYY-MM-DD) 필드가 필요합니다.' },
      { status: 400 }
    )
  }

  const [callcardBuffer, remappedBuffer] = await Promise.all([
    callcardFile.arrayBuffer(),
    remappedFile.arrayBuffer(),
  ])

  let callcardRows: CallcardRow[]
  let remappedRows: RemappedRow[]

  try {
    callcardRows = parseSheet<CallcardRow>(callcardBuffer)
    remappedRows = parseSheet<RemappedRow>(remappedBuffer)
  } catch (err) {
    return NextResponse.json(
      { error: '엑셀 파싱 실패', detail: String(err) },
      { status: 422 }
    )
  }

  const kpis = computeKpis(remappedRows, callcardRows)

  if (kpis.length === 0) {
    return NextResponse.json(
      {
        error: 'KPI 계산 결과가 없습니다.',
        debug: {
          remapped_total_rows: remappedRows.length,
          remapped_columns: remappedRows.length > 0 ? Object.keys(remappedRows[0]) : [],
          remapped_sample: remappedRows[0] ?? null,
          callcard_total_rows: callcardRows.length,
          callcard_columns: callcardRows.length > 0 ? Object.keys(callcardRows[0]) : [],
        },
      },
      { status: 422 }
    )
  }

  // Claude로 AI 요약 생성
  let summaries = new Map<number, string>()
  try {
    summaries = await generateAiSummaries(kpis, serviceDate)
  } catch (err) {
    console.error('AI 요약 생성 실패:', err)
  }

  const records = kpis.map((k) => ({
    service_date: serviceDate,
    ...k,
    ai_summary: summaries.get(k.asp_id) ?? null,
  }))

  const { error } = await supabase
    .from('daily_snapshots')
    .upsert(records, { onConflict: 'asp_id,service_date' })

  if (error) {
    return NextResponse.json({ error: 'Supabase 저장 실패', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: '분석 완료',
    service_date: serviceDate,
    asp_count: kpis.length,
    total_rows_processed: remappedRows.length,
    results: kpis.map((k) => ({ ...k, ai_summary: summaries.get(k.asp_id) ?? null })),
  })
}

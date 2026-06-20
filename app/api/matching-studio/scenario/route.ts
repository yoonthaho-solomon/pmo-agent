import { NextResponse } from 'next/server'
import { calculateScenarioMatching, type ScenarioMatchingRequest } from '@/lib/adapters/matching'

export const dynamic = 'force-dynamic'

function acceptsJson(request: Request): boolean {
  return request.headers.get('content-type')?.toLowerCase().includes('application/json') ?? false
}

function requestTooLarge(request: Request): boolean {
  const length = Number(request.headers.get('content-length') ?? 0)
  return Number.isFinite(length) && length > 16384
}

export async function POST(request: Request) {
  if (!acceptsJson(request)) {
    return NextResponse.json(
      { ok: false, state: 'invalid_input', message: 'JSON 요청만 사용할 수 있습니다.' },
      { status: 415 },
    )
  }
  if (requestTooLarge(request)) {
    return NextResponse.json(
      { ok: false, state: 'invalid_input', message: '요청 크기가 너무 큽니다.' },
      { status: 413 },
    )
  }

  let body: ScenarioMatchingRequest
  try {
    body = await request.json() as ScenarioMatchingRequest
  } catch {
    return NextResponse.json(
      { ok: false, state: 'invalid_input', message: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    )
  }

  const result = await calculateScenarioMatching(body)
  const status = result.ok ? 200 : result.state === 'invalid_input' ? 400 : result.state === 'not_found' ? 404 : 502
  return NextResponse.json(result, { status })
}

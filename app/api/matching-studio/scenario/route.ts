import { NextResponse } from 'next/server'
import { calculateScenarioMatching, type ScenarioMatchingRequest } from '@/lib/adapters/matching'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
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


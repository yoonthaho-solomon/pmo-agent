import { NextResponse } from 'next/server'
import type { RoutePoint } from '@/lib/google-maps/route-types'
import { fetchTmapRouteSummary } from '@/lib/server/tmap-routes'

export const dynamic = 'force-dynamic'

type RoutesRequestBody = {
  origin?: RoutePoint
  destination?: RoutePoint
}

function acceptsJson(request: Request): boolean {
  return request.headers.get('content-type')?.toLowerCase().includes('application/json') ?? false
}

function requestTooLarge(request: Request): boolean {
  const length = Number(request.headers.get('content-length') ?? 0)
  return Number.isFinite(length) && length > 8192
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

  let body: RoutesRequestBody
  try {
    body = await request.json() as RoutesRequestBody
  } catch {
    return NextResponse.json(
      { ok: false, state: 'invalid_input', message: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    )
  }

  if (!body.origin || !body.destination) {
    return NextResponse.json(
      { ok: false, state: 'invalid_input', message: '출발지와 도착지가 필요합니다.' },
      { status: 400 },
    )
  }

  const result = await fetchTmapRouteSummary(body.origin, body.destination)
  const status = result.ok ? 200 : result.state === 'invalid_input' ? 400 : 502
  return NextResponse.json(result, { status })
}

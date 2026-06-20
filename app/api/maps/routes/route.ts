import { NextResponse } from 'next/server'
import type { RoutePoint } from '@/lib/google-maps/route-types'
import { fetchGoogleRouteSummary } from '@/lib/server/google-routes'

export const dynamic = 'force-dynamic'

type RoutesRequestBody = {
  origin?: RoutePoint
  destination?: RoutePoint
}

export async function POST(request: Request) {
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

  const result = await fetchGoogleRouteSummary(body.origin, body.destination)
  const status = result.ok ? 200 : result.state === 'invalid_input' ? 400 : 502
  return NextResponse.json(result, { status })
}


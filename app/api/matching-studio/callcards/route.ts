import { NextResponse } from 'next/server'
import { getCallcardSlice } from '@/lib/adapters/matching'

export const dynamic = 'force-dynamic'

function parseAsp(value: string | null): number | null {
  if (!value || value === 'all') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(value: string | null): string | null {
  if (!value || value === 'all') return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function parseHour(value: string | null): number | null {
  if (!value || value === 'all') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null
}

function parseStatus(value: string | null): string | null {
  if (!value || value === 'all') return null
  const allowed = new Set(['accepted', 'expired', 'canceled'])
  return allowed.has(value) ? value : null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const aspId = parseAsp(url.searchParams.get('asp'))
  const date = parseDate(url.searchParams.get('date'))
  const hour = parseHour(url.searchParams.get('hour'))
  const status = parseStatus(url.searchParams.get('status'))

  const result = await getCallcardSlice(aspId, date, hour, status)
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export type DataOpsSummary = {
  calls: {
    total: number
    minDate: string
    maxDate: string
    byDate: { date: string; cnt: number }[]
  }
  meter: {
    total: number
    minDate: string
    maxDate: string
  }
  drivers: {
    total: number
    updatedAt: string
  }
  matches: {
    total: number
    minDate: string
    maxDate: string
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json({ ok: false, message: 'Missing Supabase env' }, { status: 500 })
  }

  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc('get_data_ops_summary')

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 502 })
  }

  return NextResponse.json({ ok: true, data: data as DataOpsSummary })
}

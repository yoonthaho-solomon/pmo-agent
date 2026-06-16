const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const index = line.indexOf('=')
  if (index < 0) continue
  env[line.slice(0, index)] = line.slice(index + 1).replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

async function range(table, dateColumn) {
  const [{ count, error: countError }, minRes, maxRes] = await Promise.all([
    supabase.from(table).select('*', { count: 'exact', head: true }),
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
  ])
  return {
    table,
    count: countError ? null : count ?? 0,
    min: minRes.data?.[0]?.[dateColumn] ?? null,
    max: maxRes.data?.[0]?.[dateColumn] ?? null,
    error: countError?.message || minRes.error?.message || maxRes.error?.message || null,
  }
}

function datesBetween(from, to) {
  const out = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

async function countOnDate(table, dateColumn, date) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(dateColumn, date)
  if (error) return { date, count: null, error: error.message }
  return { date, count: count ?? 0 }
}

async function dateCounts(table, dateColumn, dates) {
  const out = []
  for (const date of dates) {
    out.push(await countOnDate(table, dateColumn, date))
  }
  return out
}

async function main() {
  const ranges = await Promise.all([
    range('callcard_mbti', 'call_date'),
    range('driver_daily_logs', 'service_date'),
    range('matching_scores', 'match_date'),
  ])

  const dates = datesBetween('2026-05-23', '2026-06-14')
  const [callcardByDate, driverByDate, matchingByDate] = await Promise.all([
    dateCounts('callcard_mbti', 'call_date', dates),
    dateCounts('driver_daily_logs', 'service_date', dates),
    dateCounts('matching_scores', 'match_date', dates),
  ])

  console.log(JSON.stringify({
    ranges,
    callcard_by_date: callcardByDate,
    driver_logs_by_date: driverByDate,
    matching_by_date: matchingByDate,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

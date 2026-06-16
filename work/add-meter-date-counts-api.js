const fs = require('fs');
const p = 'app/api/meter-status/route.ts';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(`type MeterTableStatus = {
  table: string
  label: string
  count: number | null
  minDate: string | null
  maxDate: string | null
  error?: string
}`, `type MeterTableStatus = {
  table: string
  label: string
  count: number | null
  minDate: string | null
  maxDate: string | null
  error?: string
}

type MeterDateCount = {
  date: string
  hourly: number | null
  driver: number | null
}`);
s = s.replace(`async function tableStatus(
  supabase: SupabaseClient,
  table: string,
  label: string,
  dateColumn: string,
): Promise<MeterTableStatus> {`, `async function tableStatus(
  supabase: SupabaseClient,
  table: string,
  label: string,
  dateColumn: string,
): Promise<MeterTableStatus> {`);
const insertAfter = `  return { table, label, count: count ?? 0, minDate, maxDate, error: rangeError }
}
`;
const helper = `  return { table, label, count: count ?? 0, minDate, maxDate, error: rangeError }
}

async function countByDate(supabase: SupabaseClient, table: string, column: string, date: string): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, date)
  return error ? null : count ?? 0
}

async function meterDateCounts(supabase: SupabaseClient, tables: MeterTableStatus[]): Promise<MeterDateCount[]> {
  const hourly = tables.find((item) => item.table === 'meter_hourly_logs')
  const driver = tables.find((item) => item.table === 'meter_driver_logs')
  const dates = Array.from(new Set(['2026-06-08', hourly?.maxDate, driver?.maxDate].filter(Boolean) as string[]))
  return Promise.all(dates.map(async (date) => ({
    date,
    hourly: await countByDate(supabase, 'meter_hourly_logs', 'log_date', date),
    driver: await countByDate(supabase, 'meter_driver_logs', 'log_date', date),
  })))
}
`;
if (!s.includes(insertAfter)) throw new Error('helper insertion point not found');
s = s.replace(insertAfter, helper);
s = s.replace(`  return NextResponse.json({ source, tables })`, `  const dateCounts = await meterDateCounts(supabase, tables)

  return NextResponse.json({ source, tables, dateCounts })`);
fs.writeFileSync(p, s, 'utf8');

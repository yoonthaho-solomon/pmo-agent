const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function range(table, col) {
  const [{ count, error: ce }, { data: min, error: mine }, { data: max, error: maxe }] = await Promise.all([
    supabase.from(table).select('*', { count: 'exact', head: true }),
    supabase.from(table).select(col).order(col, { ascending: true }).limit(1),
    supabase.from(table).select(col).order(col, { ascending: false }).limit(1),
  ]);
  return { table, col, count, min: min?.[0]?.[col] ?? null, max: max?.[0]?.[col] ?? null, error: ce?.message || mine?.message || maxe?.message || null };
}
(async () => {
  const rows = await Promise.all([
    range('callcard_mbti', 'call_date'),
    range('meter_daily_logs', 'service_date'),
    range('driver_daily_logs', 'service_date'),
    range('matching_scores', 'match_date'),
  ]);
  console.log(JSON.stringify(rows, null, 2));
})().catch(err => { console.error(err.message); process.exit(1); });

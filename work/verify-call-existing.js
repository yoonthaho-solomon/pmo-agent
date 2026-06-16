const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function countEq(table, col, value) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, value);
  return { table, col, value, count, error: error?.message ?? null };
}
async function range(table, col) {
  const [{ count, error: ce }, { data: min, error: mine }, { data: max, error: maxe }] = await Promise.all([
    supabase.from(table).select('*', { count: 'exact', head: true }),
    supabase.from(table).select(col).order(col, { ascending: true }).limit(1),
    supabase.from(table).select(col).order(col, { ascending: false }).limit(1),
  ]);
  return { table, col, count, min: min?.[0]?.[col] ?? null, max: max?.[0]?.[col] ?? null, error: ce?.message || mine?.message || maxe?.message || null };
}
async function sample(table, col, value) {
  const { data, error } = await supabase.from(table).select('*').eq(col, value).limit(3);
  return { table, col, value, rows: (data ?? []).map(r => ({ id: r.callcard_id ?? r.call_id ?? r.driver_id ?? null, asp_id: r.asp_id, date: r[col] })), error: error?.message ?? null };
}
(async () => {
  const dates = ['2026-05-22', '2026-05-23'];
  const out = { ranges: [], dateCounts: [], samples: [] };
  out.ranges.push(await range('callcard_mbti', 'call_date'));
  out.ranges.push(await range('driver_daily_logs', 'service_date'));
  out.ranges.push(await range('matching_scores', 'match_date'));
  for (const d of dates) {
    out.dateCounts.push(await countEq('callcard_mbti', 'call_date', d));
    out.dateCounts.push(await countEq('driver_daily_logs', 'service_date', d));
    out.dateCounts.push(await countEq('matching_scores', 'match_date', d));
  }
  out.samples.push(await sample('callcard_mbti', 'call_date', '2026-05-22'));
  out.samples.push(await sample('callcard_mbti', 'call_date', '2026-05-23'));
  console.log(JSON.stringify(out, null, 2));
})().catch(err => { console.error(err.message); process.exit(1); });

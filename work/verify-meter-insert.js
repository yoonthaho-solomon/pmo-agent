const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function count(table, col, date) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, date);
  const { data, error: sampleError } = await supabase.from(table).select('*').eq(col, date).limit(1);
  return { table, date, count, error: error?.message || sampleError?.message || null, sampleKeys: data?.[0] ? Object.keys(data[0]).slice(0, 8) : [] };
}
(async () => {
  const rows = await Promise.all([
    count('meter_hourly_logs', 'log_date', '2026-06-08'),
    count('meter_driver_logs', 'log_date', '2026-06-08'),
  ]);
  console.log(JSON.stringify(rows, null, 2));
})().catch(err => { console.error(err.message); process.exit(1); });

const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const { createClient } = require('@supabase/supabase-js');
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
const targets = [
  ['meter_daily_logs', 'service_date'],
  ['meter_hourly_logs', 'log_date'],
  ['meter_driver_logs', 'log_date'],
  ['agent_logs', 'run_date'],
];
async function probe(client, clientName, table, dateColumn) {
  const countRes = await client.from(table).select('*', { count: 'exact', head: true });
  let min = null, max = null, rangeError = null;
  if (!countRes.error) {
    const [minRes, maxRes] = await Promise.all([
      client.from(table).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
      client.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
    ]);
    min = minRes.data?.[0]?.[dateColumn] ?? null;
    max = maxRes.data?.[0]?.[dateColumn] ?? null;
    rangeError = minRes.error?.message || maxRes.error?.message || null;
  }
  return { client: clientName, table, count: countRes.count, min, max, error: countRes.error?.message || rangeError || null };
}
(async () => {
  const rows = [];
  for (const [table, col] of targets) rows.push(await probe(anon, 'anon', table, col));
  if (service) for (const [table, col] of targets) rows.push(await probe(service, 'service', table, col));
  console.log(JSON.stringify(rows, null, 2));
})().catch(err => { console.error(err.message); process.exit(1); });

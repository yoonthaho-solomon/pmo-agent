const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data, error } = await supabase
    .from('callcard_mbti')
    .select('callcard_id,asp_id,call_date,hour_slot,weekday,s_hexagon,d_hexagon,expected_distance,expected_fare,is_paid,is_surge,eta_distance')
    .order('call_date', { ascending: false })
    .limit(1);
  if (error) throw error;
  const call = data[0];
  const body = { ...call };
  delete body.callcard_id;
  delete body.call_date;
  const res = await fetch('http://localhost:3103/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  console.log(JSON.stringify({ status: res.status, callcard_id: call.callcard_id, asp_id: call.asp_id, count: json.recommended_drivers?.length ?? 0, top1: json.recommended_drivers?.[0]?.driver_id ?? null, score: json.recommended_drivers?.[0]?.cosine_score ?? null, error: json.error ?? null }, null, 2));
})().catch((err) => { console.error(err.message); process.exit(1); });

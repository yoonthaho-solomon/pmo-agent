const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const meterPath = 'C:/Users/pgman/OneDrive/바탕 화면/앱미터데이터/tacho_statistics_20260608_20260608/통계_천안_20260608_20260608.xlsx';
(async () => {
  const bytes = fs.readFileSync(meterPath);
  const form = new FormData();
  form.append('meter_file', new Blob([bytes]), path.basename(meterPath));
  form.append('asp_id', '147000000000');
  const res = await fetch('http://localhost:3108/api/meter-excel', { method: 'POST', body: form });
  const json = await res.json();
  console.log(JSON.stringify({ status: res.status, body: json }, null, 2));
  if (!res.ok) process.exit(2);
})().catch((err) => { console.error(err.stack || err.message); process.exit(1); });

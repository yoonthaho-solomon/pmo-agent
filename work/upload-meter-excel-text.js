const fs = require('fs');
const path = require('path');
const meterPath = 'C:/Users/pgman/OneDrive/바탕 화면/앱미터데이터/tacho_statistics_20260608_20260608/통계_천안_20260608_20260608.xlsx';
(async () => {
  const bytes = fs.readFileSync(meterPath);
  const form = new FormData();
  form.append('meter_file', new Blob([bytes]), path.basename(meterPath));
  form.append('asp_id', '147000000000');
  const res = await fetch('http://localhost:3109/api/meter-excel', { method: 'POST', body: form });
  const text = await res.text();
  console.log(JSON.stringify({ status: res.status, ok: res.ok, text: text.slice(0, 2000) }, null, 2));
  if (!res.ok) process.exit(2);
})().catch((err) => { console.error(err.stack || err.message); process.exit(1); });

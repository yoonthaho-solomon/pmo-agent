const fs = require('fs');
const p = 'app/MatchingLab.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace("      tableStatus('meter_daily_logs', '앱미터데이터', 'service_date'),", "      tableStatus('meter_daily_logs', '앱미터 일별', 'service_date'),\n      tableStatus('meter_hourly_logs', '앱미터 시간대', 'log_date'),\n      tableStatus('meter_driver_logs', '앱미터 기사별', 'log_date'),");
s = s.replace("  const meter = stats.find((item) => item.table === 'meter_daily_logs')", "  const meterDaily = stats.find((item) => item.table === 'meter_daily_logs')\n  const meterHourly = stats.find((item) => item.table === 'meter_hourly_logs')\n  const meterDriver = stats.find((item) => item.table === 'meter_driver_logs')");
s = s.replace("        <Stat label=\"앱미터 저장\" value={loading ? '...' : meter?.error ? '테이블 미확인' : fmt(meter?.count)} tone={meter?.error ? 'warn' : meter?.count ? 'good' : 'neutral'} />", "        <Stat label=\"앱미터 저장\" value={loading ? '...' : meterDaily?.error ? `2시트 ${fmt(meterHourly?.count)}/${fmt(meterDriver?.count)}` : fmt(meterDaily?.count)} tone={meterDaily?.error ? 'warn' : meterDaily?.count ? 'good' : 'neutral'} />");
s = s.replace("              앱미터 테이블은 현재 코드 기준 <strong>meter_daily_logs</strong>를 조회하지만 Supabase 스키마에서 확인되지 않습니다. 테이블명 또는 적재 경로 확인이 필요합니다.", "              앱미터는 현재 <strong>meter_daily_logs</strong> 일별 테이블이 schema cache에서 확인되지 않고, <strong>meter_hourly_logs</strong>/<strong>meter_driver_logs</strong>는 존재하지만 0건입니다. 일별 적재 테이블 생성/노출 여부와 2시트 적재 사용 여부를 확정해야 합니다.");
fs.writeFileSync(p, s, 'utf8');

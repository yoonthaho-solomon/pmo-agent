const fs = require('fs');
const p = 'app/MatchingLab.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(`interface DateCountRow {
  date: string
  callcards: number | null
  driverLogs: number | null
  matches: number | null
}`, `interface DateCountRow {
  date: string
  callcards: number | null
  driverLogs: number | null
  matches: number | null
}

interface MeterStatusResponse {
  source?: string
  tables?: TableStat[]
  error?: string
}`);
s = s.replace(`  async function refresh() {
    setLoading(true)
    const next = await Promise.all([
      tableStatus('callcard_mbti', '호출데이터', 'call_date'),
      tableStatus('meter_daily_logs', '앱미터 일별', 'service_date'),
      tableStatus('meter_hourly_logs', '앱미터 시간대', 'log_date'),
      tableStatus('meter_driver_logs', '앱미터 기사별', 'log_date'),
      tableStatus('driver_daily_logs', '기사 일일 로그', 'service_date'),
      tableStatus('driver_mbti', '기사 22D 벡터'),
      tableStatus('callcard_profile', '콜카드 프로필'),
      tableStatus('matching_scores', '매칭 결과', 'match_date'),
      tableStatus('agent_logs', '실행 로그', 'run_date'),
    ])
    setStats(next)
    await loadDateCounts(next)
    setLoading(false)
  }`, `  async function loadMeterStatus(): Promise<TableStat[]> {
    try {
      const res = await fetch('/api/meter-status', { cache: 'no-store' })
      const json = await res.json() as MeterStatusResponse
      return json.tables ?? []
    } catch {
      return []
    }
  }

  async function refresh() {
    setLoading(true)
    const [baseStats, meterStats] = await Promise.all([
      Promise.all([
        tableStatus('callcard_mbti', '호출데이터', 'call_date'),
        tableStatus('driver_daily_logs', '기사 일일 로그', 'service_date'),
        tableStatus('driver_mbti', '기사 22D 벡터'),
        tableStatus('callcard_profile', '콜카드 프로필'),
        tableStatus('matching_scores', '매칭 결과', 'match_date'),
        tableStatus('agent_logs', '실행 로그', 'run_date'),
      ]),
      loadMeterStatus(),
    ])
    const next = [baseStats[0], ...meterStats, ...baseStats.slice(1)]
    setStats(next)
    await loadDateCounts(next)
    setLoading(false)
  }`);
s = s.replace(`              앱미터는 현재 <strong>meter_daily_logs</strong> 일별 테이블이 schema cache에서 확인되지 않고, <strong>meter_hourly_logs</strong>/<strong>meter_driver_logs</strong>는 존재하지만 0건입니다. 일별 적재 테이블 생성/노출 여부와 2시트 적재 사용 여부를 확정해야 합니다.`, `              앱미터 상태는 서버 API <strong>/api/meter-status</strong>를 통해 읽기 전용으로 확인합니다. 운영 환경에서는 service role이 있으면 RLS에 막히지 않는 실제 적재 건수를 표시합니다.`);
fs.writeFileSync(p, s, 'utf8');

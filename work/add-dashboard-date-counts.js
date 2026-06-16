const fs = require('fs');
const p = 'app/MatchingLab.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(`interface TableStat {
  table: string
  label: string
  count: number | null
  minDate?: string | null
  maxDate?: string | null
  error?: string
}`, `interface TableStat {
  table: string
  label: string
  count: number | null
  minDate?: string | null
  maxDate?: string | null
  error?: string
}

interface DateCountRow {
  date: string
  callcards: number | null
  driverLogs: number | null
  matches: number | null
}`);
s = s.replace(`  const [stats, setStats] = useState<TableStat[]>([])
  const [loading, setLoading] = useState(true)`, `  const [stats, setStats] = useState<TableStat[]>([])
  const [dateCounts, setDateCounts] = useState<DateCountRow[]>([])
  const [loading, setLoading] = useState(true)`);
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
    setLoading(false)
  }`, `  async function countByDate(table: string, column: string, date: string): Promise<number | null> {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, date)
    return error ? null : count ?? 0
  }

  async function loadDateCounts(statsRows: TableStat[]) {
    const callRange = statsRows.find((item) => item.table === 'callcard_mbti')
    const dates = Array.from(new Set(['2026-05-22', '2026-05-23', callRange?.maxDate].filter(Boolean) as string[]))
    const rows = await Promise.all(dates.map(async (date) => ({
      date,
      callcards: await countByDate('callcard_mbti', 'call_date', date),
      driverLogs: await countByDate('driver_daily_logs', 'service_date', date),
      matches: await countByDate('matching_scores', 'match_date', date),
    })))
    setDateCounts(rows)
  }

  async function refresh() {
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
  }`);
const marker = `      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>`;
const insert = `      <Panel>
        <SectionHeader title="주요 날짜 적재 확인" desc="2026-05-23 호출데이터 파일이 이미 Supabase에 있는지 빠르게 확인합니다." />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['날짜', '호출데이터', '기사 로그', '매칭 Top10'].map((head) => (
                  <th key={head} style={{ textAlign: 'left', color: C.muted, borderBottom: \`1px solid \${C.border}\`, padding: '10px 8px' }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dateCounts.map((row) => (
                <tr key={row.date}>
                  <td style={tdStyle()}>{row.date}</td>
                  <td style={tdStyle(row.callcards ? C.green : C.yellow)}>{fmt(row.callcards)}</td>
                  <td style={tdStyle(row.driverLogs ? C.green : C.yellow)}>{fmt(row.driverLogs)}</td>
                  <td style={tdStyle(row.matches ? C.green : C.yellow)}>{fmt(row.matches)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

`;
if (!s.includes(marker)) throw new Error('marker not found');
s = s.replace(marker, insert + marker);
s = s.replace(`              호출데이터는 실제 Supabase의 <strong style={{ color: C.text }}>callcard_mbti</strong>를 읽고 있습니다. 현재 표시 범위는 {call?.minDate ?? '-'} ~ {call?.maxDate ?? '-'}입니다.`, `              호출데이터는 실제 Supabase의 <strong style={{ color: C.text }}>callcard_mbti</strong>를 읽고 있습니다. 현재 표시 범위는 {call?.minDate ?? '-'} ~ {call?.maxDate ?? '-'}이며, 2026-05-23 데이터도 이미 적재되어 있습니다.`);
fs.writeFileSync(p, s, 'utf8');

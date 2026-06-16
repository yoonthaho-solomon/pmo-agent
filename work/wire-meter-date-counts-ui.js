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
  meterHourly?: number | null
  meterDrivers?: number | null
}`);
s = s.replace(`interface MeterStatusResponse {
  source?: string
  tables?: TableStat[]
  error?: string
}`, `interface MeterStatusResponse {
  source?: string
  tables?: TableStat[]
  dateCounts?: { date: string; hourly: number | null; driver: number | null }[]
  error?: string
}`);
s = s.replace(`  const [dateCounts, setDateCounts] = useState<DateCountRow[]>([])
  const [loading, setLoading] = useState(true)`, `  const [dateCounts, setDateCounts] = useState<DateCountRow[]>([])
  const [meterDateCounts, setMeterDateCounts] = useState<MeterStatusResponse['dateCounts']>([])
  const [loading, setLoading] = useState(true)`);
s = s.replace(`  async function loadMeterStatus(): Promise<TableStat[]> {
    try {
      const res = await fetch('/api/meter-status', { cache: 'no-store' })
      const json = await res.json() as MeterStatusResponse
      return json.tables ?? []
    } catch {
      return []
    }
  }`, `  async function loadMeterStatus(): Promise<TableStat[]> {
    try {
      const res = await fetch('/api/meter-status', { cache: 'no-store' })
      const json = await res.json() as MeterStatusResponse
      setMeterDateCounts(json.dateCounts ?? [])
      return json.tables ?? []
    } catch {
      setMeterDateCounts([])
      return []
    }
  }`);
s = s.replace(`  const vectorRate = driverDaily?.count ? Math.min(1, (driverVectors?.count ?? 0) / driverDaily.count) : 0`, `  const vectorRate = driverDaily?.count ? Math.min(1, (driverVectors?.count ?? 0) / driverDaily.count) : 0
  const coverageRows = useMemo(() => {
    const map = new Map<string, DateCountRow>()
    for (const row of dateCounts) map.set(row.date, { ...row })
    for (const row of meterDateCounts ?? []) {
      const current = map.get(row.date) ?? { date: row.date, callcards: null, driverLogs: null, matches: null }
      current.meterHourly = row.hourly
      current.meterDrivers = row.driver
      map.set(row.date, current)
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [dateCounts, meterDateCounts])`);
s = s.replace(`        <SectionHeader title="주요 날짜 적재 확인" desc="2026-05-23 호출데이터 파일이 이미 Supabase에 있는지 빠르게 확인합니다." />`, `        <SectionHeader title="주요 날짜 적재 확인" desc="호출데이터와 앱미터데이터가 이미 Supabase에 있는지 날짜별로 확인합니다." />`);
s = s.replace(`                {['날짜', '호출데이터', '기사 로그', '매칭 Top10'].map((head) => (`, `                {['날짜', '호출데이터', '기사 로그', '매칭 Top10', '앱미터 시간대', '앱미터 기사별'].map((head) => (`);
s = s.replace(`              {dateCounts.map((row) => (`, `              {coverageRows.map((row) => (`);
s = s.replace(`                  <td style={tdStyle(row.matches ? C.green : C.yellow)}>{fmt(row.matches)}</td>
                </tr>`, `                  <td style={tdStyle(row.matches ? C.green : C.yellow)}>{fmt(row.matches)}</td>
                  <td style={tdStyle(row.meterHourly ? C.green : C.yellow)}>{fmt(row.meterHourly)}</td>
                  <td style={tdStyle(row.meterDrivers ? C.green : C.yellow)}>{fmt(row.meterDrivers)}</td>
                </tr>`);
fs.writeFileSync(p, s, 'utf8');

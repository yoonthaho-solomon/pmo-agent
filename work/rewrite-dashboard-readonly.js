const fs = require('fs');
const p = 'app/MatchingLab.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/interface TableStat \{\r?\n  table: string\r?\n  label: string\r?\n  count: number \| null\r?\n  error\?: string\r?\n\}/, `interface TableStat {
  table: string
  label: string
  count: number | null
  minDate?: string | null
  maxDate?: string | null
  error?: string
}`);
const start = s.indexOf('function DataLoadTab() {');
const end = s.indexOf('\nfunction EntitiesTab', start);
if (start < 0 || end < 0) throw new Error('DataLoadTab boundaries not found');
const replacement = `function DataLoadTab() {
  const [stats, setStats] = useState<TableStat[]>([])
  const [loading, setLoading] = useState(true)

  async function tableStatus(table: string, label: string, dateColumn?: string): Promise<TableStat> {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    let minDate: string | null = null
    let maxDate: string | null = null
    let rangeError: string | undefined

    if (dateColumn && !error) {
      const [minRes, maxRes] = await Promise.all([
        supabase.from(table).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
        supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
      ])
      minDate = (minRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null
      maxDate = (maxRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null
      rangeError = minRes.error?.message ?? maxRes.error?.message
    }

    return { table, label, count: count ?? null, minDate, maxDate, error: error?.message ?? rangeError }
  }

  async function refresh() {
    setLoading(true)
    const next = await Promise.all([
      tableStatus('callcard_mbti', '호출데이터', 'call_date'),
      tableStatus('meter_daily_logs', '앱미터데이터', 'service_date'),
      tableStatus('driver_daily_logs', '기사 일일 로그', 'service_date'),
      tableStatus('driver_mbti', '기사 22D 벡터'),
      tableStatus('callcard_profile', '콜카드 프로필'),
      tableStatus('matching_scores', '매칭 결과', 'match_date'),
      tableStatus('agent_logs', '실행 로그', 'run_date'),
    ])
    setStats(next)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const call = stats.find((item) => item.table === 'callcard_mbti')
  const meter = stats.find((item) => item.table === 'meter_daily_logs')
  const driverDaily = stats.find((item) => item.table === 'driver_daily_logs')
  const driverVectors = stats.find((item) => item.table === 'driver_mbti')
  const matching = stats.find((item) => item.table === 'matching_scores')
  const vectorRate = driverDaily?.count ? Math.min(1, (driverVectors?.count ?? 0) / driverDaily.count) : 0

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <Stat label="호출데이터 저장" value={loading ? '...' : fmt(call?.count)} tone={call?.count ? 'good' : 'warn'} />
        <Stat label="앱미터 저장" value={loading ? '...' : meter?.error ? '테이블 미확인' : fmt(meter?.count)} tone={meter?.error ? 'warn' : meter?.count ? 'good' : 'neutral'} />
        <Stat label="기사 로그" value={loading ? '...' : fmt(driverDaily?.count)} tone={driverDaily?.count ? 'good' : 'warn'} />
        <Stat label="기사 벡터 생성률" value={driverDaily?.count ? pct(vectorRate) : '-'} tone={driverVectors?.count ? 'good' : 'warn'} />
        <Stat label="매칭 결과" value={loading ? '...' : fmt(matching?.count)} tone={matching?.count ? 'good' : 'warn'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>
        <Panel>
          <SectionHeader
            title="데이터 적재 현황"
            desc="이 화면은 읽기 전용입니다. 파일 업로드와 재처리는 별도 적재 관리 화면에서만 실행합니다."
          />
          <div style={{ display: 'grid', gap: 8 }}>
            {stats.map((item) => (
              <div key={item.table} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 0', borderBottom: \`1px solid \${C.border}\` }}>
                <div>
                  <div style={{ fontWeight: 850 }}>{item.label}</div>
                  <div style={{ color: C.muted, fontSize: 14 }}>{item.table}</div>
                  {(item.minDate || item.maxDate) && <div style={{ color: C.sub, marginTop: 4 }}>{item.minDate ?? '-'} ~ {item.maxDate ?? '-'}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: item.error ? C.yellow : C.text, fontWeight: 900 }}>{item.error ? '확인 필요' : fmt(item.count)}</div>
                  {item.error && <div style={{ maxWidth: 260, color: C.yellow, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.error}</div>}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="운영 메모" desc="현재 연결된 Supabase/Vercel 기준 상태입니다." />
          <div style={{ display: 'grid', gap: 12, lineHeight: 1.55, color: C.sub }}>
            <div style={{ padding: 12, borderRadius: 8, background: '#0B1222', border: \`1px solid \${C.border}\` }}>
              호출데이터는 실제 Supabase의 <strong style={{ color: C.text }}>callcard_mbti</strong>를 읽고 있습니다. 현재 표시 범위는 {call?.minDate ?? '-'} ~ {call?.maxDate ?? '-'}입니다.
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: '#0B1222', border: \`1px solid \${C.border}\` }}>
              기사 프로필/벡터는 <strong style={{ color: C.text }}>driver_daily_logs</strong>와 <strong style={{ color: C.text }}>driver_mbti</strong> 기준으로 확인합니다.
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,.08)', border: \`1px solid rgba(245,158,11,.25)\`, color: C.yellow }}>
              앱미터 테이블은 현재 코드 기준 <strong>meter_daily_logs</strong>를 조회하지만 Supabase 스키마에서 확인되지 않습니다. 테이블명 또는 적재 경로 확인이 필요합니다.
            </div>
            <Link href="/ingest" style={{ color: C.cyan, textDecoration: 'none', border: \`1px solid \${C.cyan}\`, borderRadius: 8, padding: '10px 12px', fontWeight: 850, textAlign: 'center' }}>
              적재 관리 화면으로 이동
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}
`;
s = s.slice(0, start) + replacement + s.slice(end + 1);
s = s.replace(`<Link href="/simulator" style={{ color: C.sub, textDecoration: 'none', border: \`1px solid \${C.border}\`, borderRadius: 8, padding: '7px 10px', fontSize: 14 }}>시뮬레이터</Link>`, `<Link href="/simulator" style={{ color: C.sub, textDecoration: 'none', border: \`1px solid \${C.border}\`, borderRadius: 8, padding: '7px 10px', fontSize: 14 }}>시뮬레이터</Link>\n          <Link href="/ingest" style={{ color: C.sub, textDecoration: 'none', border: \`1px solid \${C.border}\`, borderRadius: 8, padding: '7px 10px', fontSize: 14 }}>적재 관리</Link>`);
fs.writeFileSync(p, s, 'utf8');

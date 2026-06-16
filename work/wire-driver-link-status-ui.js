const fs = require('fs');
const p = 'app/MatchingLab.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(`interface MeterStatusResponse {
  source?: string
  tables?: TableStat[]
  dateCounts?: { date: string; hourly: number | null; driver: number | null }[]
  error?: string
}`, `interface MeterStatusResponse {
  source?: string
  tables?: TableStat[]
  dateCounts?: { date: string; hourly: number | null; driver: number | null }[]
  error?: string
}

interface DriverLinkStatus {
  source?: string
  meterDriverRows?: number
  meterDistinctDriverKeys?: number
  driverDailyRows?: number
  driverDistinctIds?: number
  directMatchCount?: number
  directMatchRate?: number
  meterDateRange?: { min: string | null; max: string | null }
  overlappingDates?: string[]
  samples?: { meterDriverKeys?: string[]; driverIds?: string[]; directMatches?: string[] }
  conclusion?: string
  error?: string
}`);
s = s.replace(`  const [meterDateCounts, setMeterDateCounts] = useState<MeterStatusResponse['dateCounts']>([])
  const [loading, setLoading] = useState(true)`, `  const [meterDateCounts, setMeterDateCounts] = useState<MeterStatusResponse['dateCounts']>([])
  const [driverLink, setDriverLink] = useState<DriverLinkStatus | null>(null)
  const [loading, setLoading] = useState(true)`);
s = s.replace(`  async function loadMeterStatus(): Promise<TableStat[]> {`, `  async function loadDriverLinkStatus() {
    try {
      const res = await fetch('/api/driver-link-status', { cache: 'no-store' })
      const json = await res.json() as DriverLinkStatus
      setDriverLink(json)
    } catch {
      setDriverLink({ error: '기사 연결 진단 조회 실패' })
    }
  }

  async function loadMeterStatus(): Promise<TableStat[]> {`);
s = s.replace(`    await loadDateCounts(next)
    setLoading(false)`, `    await Promise.all([loadDateCounts(next), loadDriverLinkStatus()])
    setLoading(false)`);
const marker = `      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>`;
const panel = `      <Panel>
        <SectionHeader title="앱미터 기사 연결 진단" desc="앱미터 driver_key가 호출/매칭의 driver_id와 직접 연결되는지 읽기 전용으로 확인합니다." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
          <MiniMetric label="앱미터 기사키" value={driverLink?.meterDistinctDriverKeys ?? 0} />
          <MiniMetric label="기사 ID" value={driverLink?.driverDistinctIds ?? 0} />
          <MiniMetric label="직접 매칭" value={driverLink?.directMatchCount ?? 0} />
          <MiniMetric label="겹친 날짜" value={driverLink?.overlappingDates?.length ?? 0} />
        </div>
        <div style={{ padding: 12, borderRadius: 8, background: driverLink?.directMatchCount ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)', border: \`1px solid \${driverLink?.directMatchCount ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.25)'}\`, color: driverLink?.directMatchCount ? C.green : C.yellow, lineHeight: 1.55 }}>
          {driverLink?.conclusion ?? '진단 중'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div style={{ color: C.sub }}>
            <strong style={{ color: C.text }}>앱미터 driver_key 예시</strong>
            <div style={{ marginTop: 6, fontFamily: 'monospace', color: C.muted }}>{driverLink?.samples?.meterDriverKeys?.join(', ') || '-'}</div>
          </div>
          <div style={{ color: C.sub }}>
            <strong style={{ color: C.text }}>호출/기사 driver_id 예시</strong>
            <div style={{ marginTop: 6, fontFamily: 'monospace', color: C.muted }}>{driverLink?.samples?.driverIds?.join(', ') || '-'}</div>
          </div>
        </div>
      </Panel>

`;
if (!s.includes(marker)) throw new Error('marker not found');
s = s.replace(marker, panel + marker);
fs.writeFileSync(p, s, 'utf8');

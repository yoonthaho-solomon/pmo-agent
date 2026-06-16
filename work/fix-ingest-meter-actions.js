const fs = require('fs');
const p = 'app/ingest/page.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace("  call_count?: number\n  total_rows_read?: number\n  error?: string", "  call_count?: number\n  total_rows_read?: number\n  hourly_inserted?: number\n  driver_inserted?: number\n  elapsed_ms?: number\n  error?: string");
const start = s.indexOf('          <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>\n            <h2 style={{ fontSize: 20, margin: \'0 0 14px\' }}>앱미터데이터</h2>');
const end = s.indexOf('\n          </section>', start);
if (start < 0 || end < 0) throw new Error('meter section not found');
const section = `          <section style={{ background: C.panel, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: 20 }}>
            <h2 style={{ fontSize: 20, margin: '0 0 14px' }}>앱미터데이터</h2>
            <FilePicker label="앱미터 엑셀" file={meterFile} onChange={setMeterFile} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Button
                tone="green"
                disabled={!meterFile || running != null}
                onClick={() => {
                  if (!meterFile) return
                  const form = new FormData()
                  form.append('file', meterFile)
                  postForm('/api/meter-logs', form, 'meter-daily')
                }}
              >
                일별 앱미터 적재
              </Button>
              <Button
                tone="orange"
                disabled={!meterFile || running != null}
                onClick={() => {
                  if (!meterFile) return
                  const form = new FormData()
                  form.append('meter_file', meterFile)
                  postForm('/api/meter-excel', form, 'meter-excel')
                }}
              >
                2시트 앱미터 적재
              </Button>
            </div>
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'rgba(245,158,11,.08)', border: \`1px solid rgba(245,158,11,.25)\`, color: C.yellow, lineHeight: 1.55 }}>
              일별 적재는 <strong>meter_daily_logs</strong>에 저장하는 기존 경로입니다. 2시트 적재는 <strong>meter_hourly_logs</strong>, <strong>meter_driver_logs</strong>를 사용하므로 Supabase 테이블 존재 여부를 먼저 확인해야 합니다.
            </div>
          </section>`;
s = s.slice(0, start) + section + s.slice(end + '\n          </section>'.length);
fs.writeFileSync(p, s, 'utf8');

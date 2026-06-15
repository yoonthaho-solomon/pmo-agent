'use client'

import { useState } from 'react'
import Link from 'next/link'

type UploadResult = {
  message?: string
  service_date?: string
  driver_count?: number
  callcard_count?: number
  data_rows_read?: number
  match_count?: number
  call_count?: number
  total_rows_read?: number
  hourly_inserted?: number
  driver_inserted?: number
  elapsed_ms?: number
  pipeline_results?: { step: string; result: unknown }[]
  error?: string
  detail?: unknown
}

const C = {
  bg: '#080C18',
  panel: '#0F1628',
  border: '#1E2D4A',
  border2: '#2D4470',
  text: '#F1F5F9',
  sub: '#94A3B8',
  muted: '#4E6080',
  cyan: '#22D3EE',
  purple: '#8B5CF6',
  green: '#10B981',
  red: '#F43F5E',
  yellow: '#F59E0B',
  orange: '#FB923C',
}

function Button({ children, onClick, disabled, tone = 'cyan' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: 'cyan' | 'purple' | 'green' | 'orange' }) {
  const color = tone === 'purple' ? C.purple : tone === 'green' ? C.green : tone === 'orange' ? C.orange : C.cyan
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 40,
        borderRadius: 8,
        border: `1px solid ${disabled ? C.border : color}`,
        background: disabled ? 'transparent' : `${color}22`,
        color: disabled ? C.muted : color,
        padding: '0 14px',
        fontWeight: 850,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function FilePicker({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label style={{ display: 'grid', gap: 8, color: C.sub, fontWeight: 850 }}>
      {label}
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        style={{
          width: '100%',
          border: `1px dashed ${file ? C.green : C.border2}`,
          background: '#0B1222',
          color: file ? C.text : C.sub,
          borderRadius: 8,
          minHeight: 44,
          padding: 10,
          fontSize: 14,
        }}
      />
    </label>
  )
}

export default function IngestPage() {
  const [callcardFile, setCallcardFile] = useState<File | null>(null)
  const [remappedFile, setRemappedFile] = useState<File | null>(null)
  const [meterFile, setMeterFile] = useState<File | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)

  const callDate = callcardFile?.name.match(/^(\d{4})(\d{2})(\d{2})/)
  const serviceDate = callDate ? `${callDate[1]}-${callDate[2]}-${callDate[3]}` : ''

  async function requestForm(endpoint: string, form: FormData) {
    const res = await fetch(endpoint, { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok) throw json
    return json
  }

  async function requestJson(endpoint: string, body: object) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw json
    return json
  }

  async function postForm(endpoint: string, form: FormData, name: string) {
    setRunning(name)
    setResult(null)
    try {
      const json = await requestForm(endpoint, form)
      setResult(json)
    } catch (err) {
      setResult({ error: `${name} 실행 실패`, detail: err })
    } finally {
      setRunning(null)
    }
  }

  async function runJson(endpoint: string, body: object, name: string) {
    setRunning(name)
    setResult(null)
    try {
      const json = await requestJson(endpoint, body)
      setResult(json)
    } catch (err) {
      setResult({ error: `${name} 실행 실패`, detail: err })
    } finally {
      setRunning(null)
    }
  }

  function callcardForm() {
    if (!callcardFile || !remappedFile) return null
    const form = new FormData()
    form.append('callcard_eta', callcardFile)
    form.append('remapped', remappedFile)
    return form
  }

  async function runCallcardPipeline() {
    const form = callcardForm()
    if (!form || !serviceDate) return
    setRunning('pipeline')
    setResult(null)
    const pipelineResults: { step: string; result: unknown }[] = []
    try {
      setResult({ message: '1/4 호출데이터 적재 중', pipeline_results: pipelineResults })
      pipelineResults.push({ step: 'callcard-mbti', result: await requestForm('/api/callcard-mbti', form) })

      setResult({ message: '2/4 기사 로그 생성 중', pipeline_results: pipelineResults })
      const driverForm = callcardForm()
      if (!driverForm) throw new Error('호출데이터 파일이 필요합니다.')
      pipelineResults.push({ step: 'driver-logs', result: await requestForm('/api/driver-logs', driverForm) })

      setResult({ message: '3/4 기사 벡터 생성 중', pipeline_results: pipelineResults })
      pipelineResults.push({ step: 'driver-mbti', result: await requestJson('/api/driver-mbti', {}) })

      setResult({ message: '4/4 매칭 계산 중', pipeline_results: pipelineResults })
      pipelineResults.push({ step: 'matching', result: await requestJson('/api/matching', { call_date: serviceDate }) })

      setResult({ message: '전체 파이프라인 완료', service_date: serviceDate, pipeline_results: pipelineResults })
    } catch (err) {
      setResult({ error: '전체 파이프라인 실행 실패', service_date: serviceDate, pipeline_results: pipelineResults, detail: err })
    } finally {
      setRunning(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <header style={{ height: 56, borderBottom: `1px solid ${C.border}`, background: 'rgba(8,12,24,.95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>PMO Ingest Control</div>
          <div style={{ color: C.muted, fontSize: 14 }}>파일 적재와 재처리 전용 화면</div>
        </div>
        <nav style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard" style={{ color: C.sub, textDecoration: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 14 }}>대시보드</Link>
          <Link href="/simulator" style={{ color: C.sub, textDecoration: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 14 }}>시뮬레이터</Link>
        </nav>
      </header>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: 24, display: 'grid', gap: 18 }}>
        <section>
          <h1 style={{ fontSize: 28, margin: 0 }}>적재 관리</h1>
          <p style={{ color: C.sub, lineHeight: 1.55 }}>이 화면은 Supabase 데이터를 변경할 수 있는 관리용 화면입니다. 운영 대시보드와 시뮬레이터는 읽기 전용으로 분리했습니다.</p>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 18 }}>
          <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
            <h2 style={{ fontSize: 20, margin: '0 0 14px' }}>호출데이터 / 기사 로그</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FilePicker label="callcard_eta" file={callcardFile} onChange={setCallcardFile} />
              <FilePicker label="remapped" file={remappedFile} onChange={setRemappedFile} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Button
                disabled={!callcardFile || !remappedFile || running != null}
                onClick={() => {
                  const form = callcardForm()
                  if (!form) return
                  postForm('/api/callcard-mbti', form, 'callcard')
                }}
              >
                호출데이터 적재
              </Button>
              <Button
                tone="green"
                disabled={!callcardFile || !remappedFile || running != null}
                onClick={() => {
                  const form = callcardForm()
                  if (!form) return
                  postForm('/api/driver-logs', form, 'driver-logs')
                }}
              >
                기사 로그 생성
              </Button>
              <Button tone="purple" disabled={running != null} onClick={() => runJson('/api/driver-mbti', {}, 'driver-mbti')}>
                기사 벡터 생성
              </Button>
              <Button tone="orange" disabled={!serviceDate || running != null} onClick={() => runJson('/api/matching', { call_date: serviceDate }, 'matching')}>
                매칭 계산
              </Button>
              <Button tone="green" disabled={!callcardFile || !remappedFile || !serviceDate || running != null} onClick={runCallcardPipeline}>
                전체 파이프라인 실행
              </Button>
            </div>
            <div style={{ marginTop: 12, color: C.sub, lineHeight: 1.55, fontSize: 14 }}>
              개별 버튼은 해당 단계만 실행합니다. 전체 파이프라인 실행은 호출데이터 적재 → 기사 로그 생성 → 기사 벡터 생성 → 매칭 계산을 순서대로 실행합니다.
            </div>
          </section>

          <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
            <h2 style={{ fontSize: 20, margin: '0 0 14px' }}>앱미터데이터 · 시장 기준</h2>
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
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'rgba(245,158,11,.08)', border: `1px solid rgba(245,158,11,.25)`, color: C.yellow, lineHeight: 1.55 }}>
              앱미터는 기사 MBTI의 주 원천이 아니라 천안 택시 흐름, 수입, 운행량을 보는 보조 시장 기준 데이터입니다. 일별 적재는 <strong>meter_daily_logs</strong>, 2시트 적재는 <strong>meter_hourly_logs</strong>, <strong>meter_driver_logs</strong>를 사용합니다.
            </div>
          </section>
        </div>

        {(running || result) && (
          <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
            {running && <p style={{ margin: 0, color: C.cyan, fontWeight: 850 }}>실행 중: {running}</p>}
            {result && (
              <pre style={{ marginTop: 14, maxHeight: 260, overflow: 'auto', color: result.error ? C.red : C.green, background: '#08101E', border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, fontSize: 14 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

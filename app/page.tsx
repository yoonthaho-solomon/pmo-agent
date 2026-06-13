'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface KpiRow {
  asp_id: number
  total_calls: number
  success_count: number
  expired_count: number
  canceled_count: number
  success_rate: number
  surge_call_cnt: number
  ai_summary: string | null
}

interface AnalyzeResponse {
  message: string
  service_date: string
  asp_count: number
  total_rows_processed: number
  results: KpiRow[]
}

interface DriverLogsResponse {
  message: string
  service_date: string
  driver_count: number
  total_rows_processed: number
}

interface CallcardMbtiResponse {
  message: string
  callcard_count: number
  total_rows_read: number
}

interface CallcardProfileResponse {
  message: string
  asp_count: number
  total_calls_read: number
}

interface DriverMbtiResponse {
  message: string
  driver_count: number
  data_rows_read: number
}

interface MatchingResponse {
  message: string
  call_date: string
  call_count: number
  driver_count: number
  match_count: number
}

interface MeterLogsResponse {
  message: string
  service_date: string
  driver_count: number
  total_rows_read: number
}

type StepKey = 'driverLogs' | 'callcardMbti' | 'driverMbti' | 'matching'
type StepStatus = 'idle' | 'running' | 'done' | 'error'

interface StepState {
  status: StepStatus
  message?: string
  error?: string
}

const STEP_META: { key: StepKey; label: string }[] = [
  { key: 'driverLogs',   label: '① 기사 로그 적재' },
  { key: 'callcardMbti', label: '② 콜카드 MBTI 적재' },
  { key: 'driverMbti',   label: '③ 기사 MBTI 계산' },
  { key: 'matching',     label: '④ 매칭 계산' },
]

const IDLE_STEPS: Record<StepKey, StepState> = {
  driverLogs:   { status: 'idle' },
  callcardMbti: { status: 'idle' },
  driverMbti:   { status: 'idle' },
  matching:     { status: 'idle' },
}

const C = {
  bg: '#080C18',
  bgCard: '#0F1628',
  bgCardHover: '#131D35',
  border: '#1E2D4A',
  borderHover: '#2D4470',
  cyan: '#22D3EE',
  red: '#F43F5E',
  yellow: '#F59E0B',
  green: '#10B981',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  orange: '#FB923C',
  text: '#F1F5F9',
  sub: '#94A3B8',
  muted: '#4E6080',
}

const CARD: React.CSSProperties = {
  background: C.bgCard,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  position: 'relative',
  overflow: 'hidden',
  transition: 'all 200ms cubic-bezier(.22,1,.36,1)',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
      <h2 style={{
        fontSize: 14, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: C.sub, whiteSpace: 'nowrap',
      }}>
        {children}
      </h2>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

function FileInput({
  label, icon, file, inputRef, onChange, onClear,
}: {
  label: string
  icon: string
  file: File | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (f: File | null) => void
  onClear: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>
        {label} <span style={{ color: C.red }}>*</span>
      </p>
      <div
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: hover ? C.bgCardHover : 'rgba(255,255,255,.02)',
          border: `1px dashed ${file ? 'rgba(16,185,129,.4)' : hover ? C.borderHover : C.border}`,
          borderRadius: 12, padding: '16px 20px',
          cursor: 'pointer', transition: 'all 200ms cubic-bezier(.22,1,.36,1)',
        }}
      >
        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontSize: 16, color: file ? C.text : C.muted, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: file ? 600 : 400,
        }}>
          {file ? file.name : '클릭해서 파일 선택 (.xlsx)'}
        </span>
        {file && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear() }}
            style={{
              fontSize: 14, color: C.muted, background: 'transparent',
              border: 'none', cursor: 'pointer', padding: '2px 8px',
              borderRadius: 4, transition: 'color 150ms',
            }}
            onMouseOver={e => (e.currentTarget.style.color = C.red)}
            onMouseOut={e => (e.currentTarget.style.color = C.muted)}
          >
            ✕
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

function StepRow({ index, label, state }: { index: number; label: string; state: StepState }) {
  const { status, message, error } = state

  const circleColor =
    status === 'idle'    ? C.muted :
    status === 'running' ? C.cyan :
    status === 'done'    ? C.green : C.red

  const circleBg =
    status === 'idle'    ? 'rgba(78,96,128,.15)' :
    status === 'running' ? 'rgba(34,211,238,.15)' :
    status === 'done'    ? 'rgba(16,185,129,.15)' :
                           'rgba(244,63,94,.15)'

  const detail =
    status === 'idle'    ? '대기 중' :
    status === 'running' ? '실행 중…' :
    status === 'done'    ? (message ?? '완료') : (error ?? '오류')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 0', borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, flexShrink: 0,
        background: circleBg, color: circleColor, border: `1px solid ${circleColor}40`,
      }}>
        {status === 'running'
          ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
          : index}
      </div>
      <span style={{ fontSize: 17, fontWeight: 600, color: C.text, width: 180, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 15, color: circleColor, flex: 1 }}>{detail}</span>
    </div>
  )
}

function ActionCard({
  title, desc, accentColor, loading, disabled, onRun, btnLabel, result, error, children,
}: {
  title: string
  desc: string
  accentColor: string
  loading: boolean
  disabled: boolean
  onRun: () => void
  btnLabel: string
  result?: React.ReactNode
  error?: string | null
  children?: React.ReactNode
}) {
  return (
    <div className="h-card" style={{ ...CARD, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor, opacity: 0.8 }} />
      <div>
        <p style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>{title}</p>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>{desc}</p>
      </div>
      {children}
      {error && (
        <div style={{ fontSize: 14, color: C.red, background: 'rgba(244,63,94,.08)', border: `1px solid rgba(244,63,94,.2)`, borderRadius: 8, padding: '12px 14px' }}>
          {error}
        </div>
      )}
      {result && (
        <div style={{ fontSize: 14, color: C.green, background: 'rgba(16,185,129,.08)', border: `1px solid rgba(16,185,129,.2)`, borderRadius: 8, padding: '12px 14px' }}>
          {result}
        </div>
      )}
      <button
        onClick={onRun}
        disabled={disabled}
        style={{
          marginTop: 'auto', width: '100%', padding: '12px',
          background: disabled ? 'transparent' : accentColor,
          color: disabled ? C.muted : '#fff',
          fontSize: 15, fontWeight: 700, borderRadius: 10,
          border: `1px solid ${disabled ? C.border : 'transparent'}`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 200ms cubic-bezier(.22,1,.36,1)',
          boxShadow: !disabled ? `0 4px 16px ${accentColor}40` : 'none',
        }}
      >
        {loading ? '실행 중…' : btnLabel}
      </button>
    </div>
  )
}

function extractDateFromFilename(filename: string): string | null {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

export default function Home() {
  const [callcardFile, setCallcardFile] = useState<File | null>(null)
  const [remappedFile, setRemappedFile] = useState<File | null>(null)
  const [extractedDate, setExtractedDate] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  const callcardRef = useRef<HTMLInputElement>(null)
  const remappedRef = useRef<HTMLInputElement>(null)
  const meterRef = useRef<HTMLInputElement>(null)

  const [autoRunning, setAutoRunning] = useState(false)
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(IDLE_STEPS)

  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analyzeDebug, setAnalyzeDebug] = useState<object | null>(null)

  const [driverLoading, setDriverLoading] = useState(false)
  const [driverResult, setDriverResult] = useState<DriverLogsResponse | null>(null)
  const [driverError, setDriverError] = useState<string | null>(null)
  const [driverDebug, setDriverDebug] = useState<object | null>(null)

  const [callcardMbtiLoading, setCallcardMbtiLoading] = useState(false)
  const [callcardMbtiResult, setCallcardMbtiResult] = useState<CallcardMbtiResponse | null>(null)
  const [callcardMbtiError, setCallcardMbtiError] = useState<string | null>(null)

  const [callcardProfileLoading, setCallcardProfileLoading] = useState(false)
  const [callcardProfileResult, setCallcardProfileResult] = useState<CallcardProfileResponse | null>(null)
  const [callcardProfileError, setCallcardProfileError] = useState<string | null>(null)

  const [driverMbtiLoading, setDriverMbtiLoading] = useState(false)
  const [driverMbtiResult, setDriverMbtiResult] = useState<DriverMbtiResponse | null>(null)
  const [driverMbtiError, setDriverMbtiError] = useState<string | null>(null)

  const [matchingLoading, setMatchingLoading] = useState(false)
  const [matchingResult, setMatchingResult] = useState<MatchingResponse | null>(null)
  const [matchingError, setMatchingError] = useState<string | null>(null)

  const [meterFile, setMeterFile] = useState<File | null>(null)
  const [meterLoading, setMeterLoading] = useState(false)
  const [meterResult, setMeterResult] = useState<MeterLogsResponse | null>(null)
  const [meterError, setMeterError] = useState<string | null>(null)

  function handleCallcardChange(file: File | null) {
    setCallcardFile(file)
    setDateError(null)
    if (!file) { setExtractedDate(null); return }
    const date = extractDateFromFilename(file.name)
    setExtractedDate(date)
    if (!date) setDateError('파일명에서 날짜를 찾을 수 없습니다. 패턴: YYYYMMDD_*.xlsx')
  }

  function setStep(key: StepKey, state: StepState) {
    setSteps((prev) => ({ ...prev, [key]: state }))
  }

  async function handleAutoRun() {
    if (!callcardFile || !remappedFile) return
    setAutoRunning(true)
    setSteps(IDLE_STEPS)

    let date = extractedDate ?? extractDateFromFilename(callcardFile.name)
    if (!date) {
      setStep('driverLogs', { status: 'error', error: '파일명에서 날짜를 추출할 수 없습니다.' })
      setAutoRunning(false)
      return
    }
    if (!extractedDate) setExtractedDate(date)

    setStep('driverLogs', { status: 'running' })
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      form.append('service_date', date)
      const res = await fetch('/api/driver-logs', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setStep('driverLogs', { status: 'error', error: json.error }); setAutoRunning(false); return }
      setStep('driverLogs', { status: 'done', message: `기사 ${json.driver_count}명 적재` })
    } catch (err) { setStep('driverLogs', { status: 'error', error: String(err) }); setAutoRunning(false); return }

    setStep('callcardMbti', { status: 'running' })
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      const res = await fetch('/api/callcard-mbti', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setStep('callcardMbti', { status: 'error', error: json.error }); setAutoRunning(false); return }
      setStep('callcardMbti', { status: 'done', message: `콜 ${json.callcard_count.toLocaleString()}건 적재` })
    } catch (err) { setStep('callcardMbti', { status: 'error', error: String(err) }); setAutoRunning(false); return }

    setStep('driverMbti', { status: 'running' })
    try {
      const res = await fetch('/api/driver-mbti', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setStep('driverMbti', { status: 'error', error: json.error }); setAutoRunning(false); return }
      setStep('driverMbti', { status: 'done', message: `기사 ${json.driver_count.toLocaleString()}명 계산` })
    } catch (err) { setStep('driverMbti', { status: 'error', error: String(err) }); setAutoRunning(false); return }

    setStep('matching', { status: 'running' })
    try {
      const res = await fetch('/api/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_date: date }),
      })
      const json = await res.json()
      if (!res.ok) { setStep('matching', { status: 'error', error: json.error }); setAutoRunning(false); return }
      setStep('matching', { status: 'done', message: `매칭 ${json.match_count.toLocaleString()}건 저장` })
    } catch (err) { setStep('matching', { status: 'error', error: String(err) }); setAutoRunning(false); return }

    setAutoRunning(false)
  }

  async function handleAnalyze() {
    if (!callcardFile || !remappedFile || !extractedDate) return
    setAnalyzeLoading(true); setAnalyzeError(null); setAnalyzeResult(null); setAnalyzeDebug(null)
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      form.append('service_date', extractedDate)
      const res = await fetch('/api/analyze', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setAnalyzeError(json.error ?? '알 수 없는 오류'); if (json.debug) setAnalyzeDebug(json.debug) }
      else setAnalyzeResult(json as AnalyzeResponse)
    } catch { setAnalyzeError('서버 연결에 실패했습니다.') }
    finally { setAnalyzeLoading(false) }
  }

  async function handleDriverLogs() {
    if (!callcardFile || !remappedFile || !extractedDate) return
    setDriverLoading(true); setDriverError(null); setDriverResult(null); setDriverDebug(null)
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      form.append('service_date', extractedDate)
      const res = await fetch('/api/driver-logs', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setDriverError(json.error ?? '알 수 없는 오류'); if (json.debug) setDriverDebug(json.debug) }
      else setDriverResult(json as DriverLogsResponse)
    } catch { setDriverError('서버 연결에 실패했습니다.') }
    finally { setDriverLoading(false) }
  }

  async function handleCallcardMbti() {
    if (!callcardFile || !remappedFile) return
    setCallcardMbtiLoading(true); setCallcardMbtiError(null); setCallcardMbtiResult(null)
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      const res = await fetch('/api/callcard-mbti', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) setCallcardMbtiError(json.error ?? '알 수 없는 오류')
      else setCallcardMbtiResult(json as CallcardMbtiResponse)
    } catch { setCallcardMbtiError('서버 연결에 실패했습니다.') }
    finally { setCallcardMbtiLoading(false) }
  }

  async function handleCallcardProfile() {
    setCallcardProfileLoading(true); setCallcardProfileError(null); setCallcardProfileResult(null)
    try {
      const res = await fetch('/api/callcard-mbti-compute', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) setCallcardProfileError(json.error ?? '알 수 없는 오류')
      else setCallcardProfileResult(json as CallcardProfileResponse)
    } catch { setCallcardProfileError('서버 연결에 실패했습니다.') }
    finally { setCallcardProfileLoading(false) }
  }

  async function handleDriverMbti() {
    setDriverMbtiLoading(true); setDriverMbtiError(null); setDriverMbtiResult(null)
    try {
      const res = await fetch('/api/driver-mbti', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) setDriverMbtiError(json.error ?? '알 수 없는 오류')
      else setDriverMbtiResult(json as DriverMbtiResponse)
    } catch { setDriverMbtiError('서버 연결에 실패했습니다.') }
    finally { setDriverMbtiLoading(false) }
  }

  async function handleMatching() {
    if (!extractedDate) return
    setMatchingLoading(true); setMatchingError(null); setMatchingResult(null)
    try {
      const res = await fetch('/api/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_date: extractedDate }),
      })
      const json = await res.json()
      if (!res.ok) setMatchingError(json.error ?? '알 수 없는 오류')
      else setMatchingResult(json as MatchingResponse)
    } catch { setMatchingError('서버 연결에 실패했습니다.') }
    finally { setMatchingLoading(false) }
  }

  async function handleMeterLogs() {
    if (!meterFile) return
    setMeterLoading(true); setMeterError(null); setMeterResult(null)
    try {
      const form = new FormData()
      form.append('file', meterFile)
      const res = await fetch('/api/meter-excel', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) setMeterError(json.error ?? '알 수 없는 오류')
      else setMeterResult(json as MeterLogsResponse)
    } catch { setMeterError('서버 연결에 실패했습니다.') }
    finally { setMeterLoading(false) }
  }

  const filesReady = !!(callcardFile && remappedFile)
  const dateReady = !!extractedDate
  const anyRunning = autoRunning || analyzeLoading || driverLoading ||
    callcardMbtiLoading || callcardProfileLoading || driverMbtiLoading || matchingLoading || meterLoading

  const navBtn: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: C.sub, textDecoration: 'none',
    background: 'transparent', border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '4px 11px',
    transition: 'all 200ms cubic-bezier(.22,1,.36,1)', whiteSpace: 'nowrap',
    cursor: 'pointer',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #080C18;
          font-family: 'Pretendard', -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          font-size: 18px;
        }
        body::before {
          content: ''; position: fixed; top: -20%; left: -10%;
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(34,211,238,.07), transparent 70%);
          pointer-events: none; z-index: 0;
        }
        body::after {
          content: ''; position: fixed; bottom: -20%; right: -10%;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(139,92,246,.06), transparent 70%);
          pointer-events: none; z-index: 0;
        }
        input, select, button, textarea { font-family: inherit; }
        input::placeholder { color: #4E6080; }
        select option { background: #0F1628; color: #F1F5F9; }
        @keyframes cardReveal {
          0% { opacity: 0; transform: translateY(20px) scale(.97); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .h-card {
          animation: cardReveal .65s cubic-bezier(.22,1,.36,1) forwards;
          opacity: 0;
        }
        .h-card:hover {
          transform: translateY(-2px);
          border-color: #2D4470 !important;
          box-shadow: 0 12px 32px rgba(0,0,0,.4);
        }
        .h-card:nth-child(1) { animation-delay: .05s; }
        .h-card:nth-child(2) { animation-delay: .10s; }
        .h-card:nth-child(3) { animation-delay: .15s; }
        .h-card:nth-child(4) { animation-delay: .20s; }
        .h-card:nth-child(5) { animation-delay: .25s; }
        .h-card:nth-child(6) { animation-delay: .30s; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, position: 'relative', zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(8,12,24,.95)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${C.border}`,
          padding: '0 16px', height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>
            코나모빌리티{' '}
            <em style={{
              fontStyle: 'normal',
              background: 'linear-gradient(135deg, #22D3EE, #8B5CF6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>PMO</em>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <a href="https://yoonthaho-solomon.github.io/happycall-pmo/" target="_blank" style={{ ...navBtn, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.borderColor = C.borderHover }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = C.sub; (e.currentTarget as HTMLElement).style.borderColor = C.border }}
            >
              ← 관제 지도
            </a>
            <Link href="/dashboard" style={{
              ...navBtn,
              display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none',
              background: 'linear-gradient(135deg, rgba(34,211,238,.12), rgba(139,92,246,.1))',
              border: `1px solid rgba(34,211,238,.3)`, color: C.cyan,
            }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8' }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              누적 분석 →
            </Link>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px', display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* ── Section 1: 호출 데이터 적재 (cyan) ── */}
          <section>
            <SectionTitle>호출 데이터 적재</SectionTitle>
            <div className="h-card" style={{ ...CARD, padding: '32px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.cyan }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FileInput
                  label="callcard_eta 파일"
                  icon="📋"
                  file={callcardFile}
                  inputRef={callcardRef}
                  onChange={handleCallcardChange}
                  onClear={() => { setCallcardFile(null); setExtractedDate(null); setDateError(null) }}
                />
                <FileInput
                  label="remapped 파일"
                  icon="🗂️"
                  file={remappedFile}
                  inputRef={remappedRef}
                  onChange={setRemappedFile}
                  onClear={() => setRemappedFile(null)}
                />
                {extractedDate && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    fontSize: 16, color: C.green,
                    background: 'rgba(16,185,129,.08)', border: `1px solid rgba(16,185,129,.25)`,
                    borderRadius: 10, padding: '12px 16px',
                  }}>
                    <span style={{ fontWeight: 700 }}>서비스 날짜</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{extractedDate}</span>
                  </div>
                )}
                {dateError && (
                  <div style={{
                    fontSize: 15, color: C.yellow,
                    background: 'rgba(245,158,11,.08)', border: `1px solid rgba(245,158,11,.2)`,
                    borderRadius: 10, padding: '12px 16px',
                  }}>
                    {dateError}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Section 2: 앱미터 데이터 적재 (orange) ── */}
          <section>
            <SectionTitle>앱미터 데이터 적재</SectionTitle>
            <div className="h-card" style={{ ...CARD, padding: '32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.orange }} />
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>미터기 데이터 적재</p>
                <p style={{ fontSize: 15, color: C.muted }}>통계_천안_날짜.xlsx → meter_daily_logs</p>
              </div>
              <FileInput
                label="미터기 통계 파일 (통계_천안)"
                icon="🚖"
                file={meterFile}
                inputRef={meterRef}
                onChange={setMeterFile}
                onClear={() => { setMeterFile(null); setMeterResult(null); setMeterError(null) }}
              />
              {meterError && (
                <div style={{ fontSize: 15, color: C.red, background: 'rgba(244,63,94,.08)', border: `1px solid rgba(244,63,94,.2)`, borderRadius: 8, padding: '12px 14px' }}>
                  {meterError}
                </div>
              )}
              {meterResult && (
                <div style={{ fontSize: 15, color: C.green, background: 'rgba(16,185,129,.08)', border: `1px solid rgba(16,185,129,.2)`, borderRadius: 8, padding: '12px 14px' }}>
                  처리 완료: {meterResult.driver_count}명 적재 ({meterResult.service_date})
                </div>
              )}
              <button
                onClick={handleMeterLogs}
                disabled={meterLoading || !meterFile || anyRunning}
                style={{
                  width: '100%', padding: '14px',
                  background: meterLoading || !meterFile || anyRunning ? 'transparent' : C.orange,
                  color: meterLoading || !meterFile || anyRunning ? C.muted : '#0b0b0f',
                  fontSize: 16, fontWeight: 700, borderRadius: 10,
                  border: `1px solid ${meterLoading || !meterFile || anyRunning ? C.border : 'transparent'}`,
                  cursor: meterLoading || !meterFile || anyRunning ? 'not-allowed' : 'pointer',
                  opacity: meterLoading || !meterFile || anyRunning ? 0.5 : 1,
                  transition: 'all 200ms cubic-bezier(.22,1,.36,1)',
                }}
              >
                {meterLoading ? '적재 중…' : '미터기 데이터 적재'}
              </button>
            </div>
          </section>

          {/* ── Section 3: 파이프라인 자동실행 (purple) ── */}
          <section>
            <SectionTitle>파이프라인 자동실행</SectionTitle>
            <div className="h-card" style={{ ...CARD, padding: '32px', border: `1px solid rgba(139,92,246,.3)` }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.purple }} />
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>4단계 순차 자동 실행</p>
                <p style={{ fontSize: 15, color: C.muted }}>기사 로그 → 콜카드 MBTI → 기사 MBTI → 매칭 계산</p>
              </div>
              <div style={{ marginBottom: 24 }}>
                {STEP_META.map(({ key, label }, i) => (
                  <StepRow key={key} index={i + 1} label={label} state={steps[key]} />
                ))}
              </div>
              <button
                onClick={handleAutoRun}
                disabled={autoRunning || !filesReady}
                style={{
                  width: '100%', padding: '16px',
                  background: autoRunning || !filesReady ? 'transparent' : `linear-gradient(135deg, ${C.purple}, #5b21b6)`,
                  color: autoRunning || !filesReady ? C.muted : '#fff',
                  fontSize: 17, fontWeight: 700, borderRadius: 12,
                  border: `1px solid ${autoRunning || !filesReady ? C.border : 'transparent'}`,
                  cursor: autoRunning || !filesReady ? 'not-allowed' : 'pointer',
                  opacity: autoRunning || !filesReady ? 0.6 : 1,
                  transition: 'all 200ms cubic-bezier(.22,1,.36,1)',
                  boxShadow: !autoRunning && filesReady ? `0 4px 20px rgba(139,92,246,.35)` : 'none',
                }}
              >
                {autoRunning ? '실행 중…' : `자동 실행${extractedDate ? ` (${extractedDate})` : ''}`}
              </button>
            </div>
          </section>

          {/* ── Section 4: 개별 실행 (green) ── */}
          <section>
            <SectionTitle>개별 실행</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <ActionCard
                title="ASP 콜 분석"
                desc="KPI + AI 요약 → daily_snapshots"
                accentColor={C.blue}
                loading={analyzeLoading}
                disabled={analyzeLoading || !filesReady || !dateReady || anyRunning}
                onRun={handleAnalyze}
                btnLabel="분석 실행"
                error={analyzeError}
                result={analyzeResult ? `ASP ${analyzeResult.asp_count}개 · ${analyzeResult.total_rows_processed}건` : undefined}
              >
                {analyzeDebug && (
                  <pre style={{ fontSize: 12, color: C.muted, background: 'rgba(244,63,94,.05)', borderRadius: 6, padding: '8px', overflow: 'auto', maxHeight: 80 }}>
                    {JSON.stringify(analyzeDebug, null, 2)}
                  </pre>
                )}
              </ActionCard>

              <ActionCard
                title="기사 로그 적재"
                desc="하루치 행동 데이터 → driver_daily_logs"
                accentColor={C.green}
                loading={driverLoading}
                disabled={driverLoading || !filesReady || !dateReady || anyRunning}
                onRun={handleDriverLogs}
                btnLabel="기사 로그 적재"
                error={driverError}
                result={driverResult ? `기사 ${driverResult.driver_count}명 적재됨` : undefined}
              >
                {driverDebug && (
                  <pre style={{ fontSize: 12, color: C.muted, background: 'rgba(244,63,94,.05)', borderRadius: 6, padding: '8px', overflow: 'auto', maxHeight: 80 }}>
                    {JSON.stringify(driverDebug, null, 2)}
                  </pre>
                )}
              </ActionCard>

              <ActionCard
                title="콜카드 MBTI 적재"
                desc="콜 단위 벡터 → callcard_mbti"
                accentColor={C.purple}
                loading={callcardMbtiLoading}
                disabled={callcardMbtiLoading || !filesReady || anyRunning}
                onRun={handleCallcardMbti}
                btnLabel="콜카드 MBTI 적재"
                error={callcardMbtiError}
                result={callcardMbtiResult ? `${callcardMbtiResult.callcard_count.toLocaleString()}건 적재됨` : undefined}
              />

              <ActionCard
                title="콜카드 프로파일 계산"
                desc="callcard_mbti 집계 → callcard_profile"
                accentColor={C.orange}
                loading={callcardProfileLoading}
                disabled={callcardProfileLoading || anyRunning}
                onRun={handleCallcardProfile}
                btnLabel="프로파일 계산"
                error={callcardProfileError}
                result={callcardProfileResult ? `ASP ${callcardProfileResult.asp_count}개 · ${callcardProfileResult.total_calls_read.toLocaleString()}건` : undefined}
              />

              <ActionCard
                title="기사 MBTI 계산"
                desc="driver_daily_logs 집계 → driver_mbti"
                accentColor={C.cyan}
                loading={driverMbtiLoading}
                disabled={driverMbtiLoading || anyRunning}
                onRun={handleDriverMbti}
                btnLabel="기사 MBTI 계산"
                error={driverMbtiError}
                result={driverMbtiResult ? `기사 ${driverMbtiResult.driver_count.toLocaleString()}명 계산됨` : undefined}
              />

              <ActionCard
                title="매칭 계산"
                desc="코사인 유사도 TOP 10 → matching_scores"
                accentColor={C.red}
                loading={matchingLoading}
                disabled={matchingLoading || !dateReady || anyRunning}
                onRun={handleMatching}
                btnLabel="매칭 계산"
                error={matchingError}
                result={matchingResult ? (
                  <>{matchingResult.match_count.toLocaleString()}건 저장<br />콜 {matchingResult.call_count.toLocaleString()}개 × 기사 {matchingResult.driver_count.toLocaleString()}명</>
                ) : undefined}
              />
            </div>
          </section>

          {/* ASP 분석 상세 결과 */}
          {analyzeResult && (
            <section>
              <SectionTitle>분석 결과</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {analyzeResult.results.map((row) => (
                  <div key={row.asp_id} className="h-card" style={{ ...CARD, padding: '28px 32px' }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                      background: row.success_rate >= 0.8 ? C.green : row.success_rate >= 0.5 ? C.yellow : C.red,
                    }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>ASP #{row.asp_id}</span>
                      <span style={{
                        fontSize: 14, fontWeight: 700, padding: '5px 14px', borderRadius: 20,
                        background: row.success_rate >= 0.8 ? 'rgba(16,185,129,.12)' : row.success_rate >= 0.5 ? 'rgba(245,158,11,.12)' : 'rgba(244,63,94,.12)',
                        color: row.success_rate >= 0.8 ? C.green : row.success_rate >= 0.5 ? C.yellow : C.red,
                        border: `1px solid ${row.success_rate >= 0.8 ? 'rgba(16,185,129,.3)' : row.success_rate >= 0.5 ? 'rgba(245,158,11,.3)' : 'rgba(244,63,94,.3)'}`,
                      }}>
                        수락률 {(row.success_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: row.ai_summary ? 18 : 0 }}>
                      {[
                        { label: '총 콜', value: row.total_calls, color: C.text },
                        { label: '수락', value: row.success_count, color: C.green },
                        { label: '만료', value: row.expired_count, color: C.red },
                        { label: '취소', value: row.canceled_count, color: C.yellow },
                        { label: '서지 콜', value: row.surge_call_cnt, color: C.cyan },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{
                          textAlign: 'center', background: 'rgba(255,255,255,.02)',
                          border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 8px',
                        }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</div>
                          <div style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {row.ai_summary && (
                      <div style={{
                        background: 'rgba(34,211,238,.06)', border: `1px solid rgba(34,211,238,.15)`,
                        borderRadius: 10, padding: '16px 18px',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.cyan, display: 'block', marginBottom: 10 }}>AI 요약</span>
                        <p style={{ fontSize: 16, color: C.sub, lineHeight: 1.7 }}>{row.ai_summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  )
}

'use client'

import { useState, useRef } from 'react'

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

// --- Auto-run pipeline ---

type StepKey = 'driverLogs' | 'callcardMbti' | 'driverMbti' | 'matching'
type StepStatus = 'idle' | 'running' | 'done' | 'error'

interface StepState {
  status: StepStatus
  message?: string
  error?: string
}

const STEP_META: { key: StepKey; label: string }[] = [
  { key: 'driverLogs',   label: '기사 로그 적재' },
  { key: 'callcardMbti', label: '콜카드 MBTI 적재' },
  { key: 'driverMbti',   label: '기사 MBTI 계산' },
  { key: 'matching',     label: '매칭 계산' },
]

const IDLE_STEPS: Record<StepKey, StepState> = {
  driverLogs:   { status: 'idle' },
  callcardMbti: { status: 'idle' },
  driverMbti:   { status: 'idle' },
  matching:     { status: 'idle' },
}

// --- FileInput component ---

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
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <div
        className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-gray-600 flex-1 truncate">
          {file ? file.name : '파일을 클릭해서 선택하세요 (.xlsx)'}
        </span>
        {file && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear() }}
            className="text-gray-400 hover:text-red-500 text-xs"
          >
            ✕
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

// --- Step indicator ---

function StepRow({ index, label, state }: { index: number; label: string; state: StepState }) {
  const { status, message, error } = state

  const numCls =
    status === 'idle'    ? 'bg-gray-100 text-gray-400' :
    status === 'running' ? 'bg-blue-100 text-blue-600' :
    status === 'done'    ? 'bg-green-100 text-green-600' :
                           'bg-red-100 text-red-600'

  const textCls =
    status === 'idle'    ? 'text-gray-400' :
    status === 'running' ? 'text-blue-600' :
    status === 'done'    ? 'text-green-600' :
                           'text-red-600'

  const detail =
    status === 'idle'    ? '대기 중' :
    status === 'running' ? '실행 중…' :
    status === 'done'    ? (message ?? '완료') :
                           (error ?? '오류')

  return (
    <div className="flex items-center gap-3 py-1">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${numCls}`}>
        {status === 'running' ? (
          <span className="inline-block animate-spin">↻</span>
        ) : (
          index
        )}
      </div>
      <span className="text-sm text-gray-700 w-36 flex-shrink-0">{label}</span>
      <span className={`text-xs ${textCls}`}>{detail}</span>
    </div>
  )
}

// --- Helpers ---

function extractDateFromFilename(filename: string): string | null {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

// --- Main page ---

export default function Home() {
  const [callcardFile, setCallcardFile] = useState<File | null>(null)
  const [remappedFile, setRemappedFile] = useState<File | null>(null)
  const [extractedDate, setExtractedDate] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  const callcardRef = useRef<HTMLInputElement>(null)
  const remappedRef = useRef<HTMLInputElement>(null)

  // Auto-run state
  const [autoRunning, setAutoRunning] = useState(false)
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(IDLE_STEPS)

  // Individual action states
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

  // callcard_eta 선택 시 파일명에서 날짜 추출
  function handleCallcardChange(file: File | null) {
    setCallcardFile(file)
    setDateError(null)
    if (!file) {
      setExtractedDate(null)
      return
    }
    const date = extractDateFromFilename(file.name)
    setExtractedDate(date)
    if (!date) setDateError(`파일명에서 날짜를 찾을 수 없습니다. 패턴: YYYYMMDD_*.xlsx`)
  }

  function setStep(key: StepKey, state: StepState) {
    setSteps((prev) => ({ ...prev, [key]: state }))
  }

  // --- Auto-run ---

  async function handleAutoRun() {
    if (!callcardFile || !remappedFile) return

    setAutoRunning(true)
    setSteps(IDLE_STEPS)

    let date = extractedDate ?? extractDateFromFilename(callcardFile.name)
    if (!date) {
      setStep('driverLogs', { status: 'error', error: '파일명에서 날짜를 추출할 수 없습니다. 패턴: YYYYMMDD_*.xlsx' })
      setAutoRunning(false)
      return
    }
    if (!extractedDate) setExtractedDate(date)

    // 1. 기사 로그 적재
    setStep('driverLogs', { status: 'running' })
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      form.append('service_date', date)
      const res = await fetch('/api/driver-logs', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setStep('driverLogs', { status: 'error', error: json.error })
        setAutoRunning(false)
        return
      }
      setStep('driverLogs', { status: 'done', message: `기사 ${json.driver_count}명 적재` })
    } catch (err) {
      setStep('driverLogs', { status: 'error', error: String(err) })
      setAutoRunning(false)
      return
    }

    // 2. 콜카드 MBTI 적재
    setStep('callcardMbti', { status: 'running' })
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      const res = await fetch('/api/callcard-mbti', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setStep('callcardMbti', { status: 'error', error: json.error })
        setAutoRunning(false)
        return
      }
      setStep('callcardMbti', { status: 'done', message: `콜 ${json.callcard_count.toLocaleString()}건 적재` })
    } catch (err) {
      setStep('callcardMbti', { status: 'error', error: String(err) })
      setAutoRunning(false)
      return
    }

    // 3. 기사 MBTI 계산
    setStep('driverMbti', { status: 'running' })
    try {
      const res = await fetch('/api/driver-mbti', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setStep('driverMbti', { status: 'error', error: json.error })
        setAutoRunning(false)
        return
      }
      setStep('driverMbti', { status: 'done', message: `기사 ${json.driver_count.toLocaleString()}명 계산` })
    } catch (err) {
      setStep('driverMbti', { status: 'error', error: String(err) })
      setAutoRunning(false)
      return
    }

    // 4. 매칭 계산
    setStep('matching', { status: 'running' })
    try {
      const res = await fetch('/api/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_date: date }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStep('matching', { status: 'error', error: json.error })
        setAutoRunning(false)
        return
      }
      setStep('matching', { status: 'done', message: `매칭 ${json.match_count.toLocaleString()}건 저장` })
    } catch (err) {
      setStep('matching', { status: 'error', error: String(err) })
      setAutoRunning(false)
      return
    }

    setAutoRunning(false)
  }

  // --- Individual handlers ---

  async function handleAnalyze() {
    if (!callcardFile || !remappedFile || !extractedDate) return
    setAnalyzeLoading(true)
    setAnalyzeError(null)
    setAnalyzeResult(null)
    setAnalyzeDebug(null)
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      form.append('service_date', extractedDate)
      const res = await fetch('/api/analyze', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setAnalyzeError(json.error ?? '알 수 없는 오류')
        if (json.debug) setAnalyzeDebug(json.debug)
      } else {
        setAnalyzeResult(json as AnalyzeResponse)
      }
    } catch { setAnalyzeError('서버 연결에 실패했습니다.') }
    finally { setAnalyzeLoading(false) }
  }

  async function handleDriverLogs() {
    if (!callcardFile || !remappedFile || !extractedDate) return
    setDriverLoading(true)
    setDriverError(null)
    setDriverResult(null)
    setDriverDebug(null)
    try {
      const form = new FormData()
      form.append('callcard_eta', callcardFile)
      form.append('remapped', remappedFile)
      form.append('service_date', extractedDate)
      const res = await fetch('/api/driver-logs', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setDriverError(json.error ?? '알 수 없는 오류')
        if (json.debug) setDriverDebug(json.debug)
      } else {
        setDriverResult(json as DriverLogsResponse)
      }
    } catch { setDriverError('서버 연결에 실패했습니다.') }
    finally { setDriverLoading(false) }
  }

  async function handleCallcardMbti() {
    if (!callcardFile || !remappedFile) return
    setCallcardMbtiLoading(true)
    setCallcardMbtiError(null)
    setCallcardMbtiResult(null)
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
    setCallcardProfileLoading(true)
    setCallcardProfileError(null)
    setCallcardProfileResult(null)
    try {
      const res = await fetch('/api/callcard-mbti-compute', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) setCallcardProfileError(json.error ?? '알 수 없는 오류')
      else setCallcardProfileResult(json as CallcardProfileResponse)
    } catch { setCallcardProfileError('서버 연결에 실패했습니다.') }
    finally { setCallcardProfileLoading(false) }
  }

  async function handleDriverMbti() {
    setDriverMbtiLoading(true)
    setDriverMbtiError(null)
    setDriverMbtiResult(null)
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
    setMatchingLoading(true)
    setMatchingError(null)
    setMatchingResult(null)
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

  const filesReady = !!(callcardFile && remappedFile)
  const dateReady = !!extractedDate
  const anyRunning = autoRunning || analyzeLoading || driverLoading ||
    callcardMbtiLoading || callcardProfileLoading || driverMbtiLoading || matchingLoading

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">PMO 콜 분석</h1>
          <p className="text-sm text-gray-500">callcard_eta, remapped 파일을 업로드하면 날짜가 자동 추출됩니다.</p>
        </div>

        {/* 파일 업로드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">파일 업로드</h2>

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
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <span className="font-medium">서비스 날짜</span>
              <span>{extractedDate}</span>
            </div>
          )}
          {dateError && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              날짜 추출 실패: {dateError}
            </div>
          )}
        </div>

        {/* 자동 실행 파이프라인 */}
        <div className="bg-white rounded-xl shadow-sm border border-indigo-100 border-2 p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">자동 실행</h2>
            <p className="text-xs text-gray-500 mt-0.5">4단계를 순서대로 자동 실행합니다</p>
          </div>

          <div className="space-y-1">
            {STEP_META.map(({ key, label }, i) => (
              <StepRow key={key} index={i + 1} label={label} state={steps[key]} />
            ))}
          </div>

          <button
            onClick={handleAutoRun}
            disabled={autoRunning || !filesReady}
            className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {autoRunning
              ? '실행 중…'
              : `자동 실행${extractedDate ? ` (${extractedDate})` : ''}`}
          </button>
        </div>

        {/* 개별 액션 카드 */}
        <div>
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">개별 실행</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

            {/* ASP 분석 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">ASP 콜 분석</h2>
                <p className="text-xs text-gray-400 mt-0.5">KPI + AI 요약 → daily_snapshots</p>
              </div>
              {analyzeError && (
                <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5">
                  {analyzeError}
                  {analyzeDebug && (
                    <pre className="mt-1 bg-red-100 rounded p-1 overflow-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(analyzeDebug, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              {analyzeResult && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
                  ASP {analyzeResult.asp_count}개 · {analyzeResult.total_rows_processed}건
                </div>
              )}
              <button
                onClick={handleAnalyze}
                disabled={analyzeLoading || !filesReady || !dateReady || anyRunning}
                className="mt-auto w-full py-2 px-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {analyzeLoading ? '분석 중…' : '분석 실행'}
              </button>
            </div>

            {/* 기사 로그 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">기사 로그 적재</h2>
                <p className="text-xs text-gray-400 mt-0.5">하루치 행동 데이터 → driver_daily_logs</p>
              </div>
              {driverError && (
                <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5">
                  {driverError}
                  {driverDebug && (
                    <pre className="mt-1 bg-red-100 rounded p-1 overflow-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(driverDebug, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              {driverResult && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
                  기사 {driverResult.driver_count}명 적재됨
                </div>
              )}
              <button
                onClick={handleDriverLogs}
                disabled={driverLoading || !filesReady || !dateReady || anyRunning}
                className="mt-auto w-full py-2 px-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {driverLoading ? '적재 중…' : '기사 로그 적재'}
              </button>
            </div>

            {/* 콜카드 MBTI */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">콜카드 MBTI 적재</h2>
                <p className="text-xs text-gray-400 mt-0.5">콜 단위 벡터 → callcard_mbti</p>
              </div>
              {callcardMbtiError && (
                <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5">{callcardMbtiError}</div>
              )}
              {callcardMbtiResult && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
                  {callcardMbtiResult.callcard_count.toLocaleString()}건 적재됨
                </div>
              )}
              <button
                onClick={handleCallcardMbti}
                disabled={callcardMbtiLoading || !filesReady || anyRunning}
                className="mt-auto w-full py-2 px-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {callcardMbtiLoading ? '적재 중…' : '콜카드 MBTI 적재'}
              </button>
            </div>

            {/* 콜카드 프로파일 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">콜카드 프로파일 계산</h2>
                <p className="text-xs text-gray-400 mt-0.5">callcard_mbti 집계 → callcard_profile</p>
              </div>
              {callcardProfileError && (
                <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5">{callcardProfileError}</div>
              )}
              {callcardProfileResult && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
                  ASP {callcardProfileResult.asp_count}개 · {callcardProfileResult.total_calls_read.toLocaleString()}건
                </div>
              )}
              <button
                onClick={handleCallcardProfile}
                disabled={callcardProfileLoading || anyRunning}
                className="mt-auto w-full py-2 px-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {callcardProfileLoading ? '계산 중…' : '프로파일 계산'}
              </button>
            </div>

            {/* 기사 MBTI */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">기사 MBTI 계산</h2>
                <p className="text-xs text-gray-400 mt-0.5">driver_daily_logs 집계 → driver_mbti</p>
              </div>
              {driverMbtiError && (
                <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5">{driverMbtiError}</div>
              )}
              {driverMbtiResult && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
                  기사 {driverMbtiResult.driver_count.toLocaleString()}명 계산됨
                </div>
              )}
              <button
                onClick={handleDriverMbti}
                disabled={driverMbtiLoading || anyRunning}
                className="mt-auto w-full py-2 px-3 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {driverMbtiLoading ? '계산 중…' : '기사 MBTI 계산'}
              </button>
            </div>

            {/* 매칭 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">매칭 계산</h2>
                <p className="text-xs text-gray-400 mt-0.5">코사인 유사도 TOP 10 → matching_scores</p>
              </div>
              {matchingError && (
                <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5">{matchingError}</div>
              )}
              {matchingResult && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
                  <div>{matchingResult.match_count.toLocaleString()}건 저장</div>
                  <div className="text-green-600">콜 {matchingResult.call_count.toLocaleString()}개 × 기사 {matchingResult.driver_count.toLocaleString()}명</div>
                </div>
              )}
              <button
                onClick={handleMatching}
                disabled={matchingLoading || !dateReady || anyRunning}
                className="mt-auto w-full py-2 px-3 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {matchingLoading ? '매칭 중…' : '매칭 계산'}
              </button>
            </div>
          </div>
        </div>

        {/* ASP 분석 상세 결과 */}
        {analyzeResult && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              분석 결과
              <span className="ml-3 text-sm font-normal text-gray-500">
                {analyzeResult.service_date} · ASP {analyzeResult.asp_count}개
              </span>
            </h2>
            {analyzeResult.results.map((row) => (
              <div key={row.asp_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">ASP #{row.asp_id}</span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    row.success_rate >= 0.8 ? 'bg-green-100 text-green-700' :
                    row.success_rate >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    수락률 {(row.success_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[
                    { label: '총 콜', value: row.total_calls },
                    { label: '수락', value: row.success_count },
                    { label: '만료', value: row.expired_count },
                    { label: '취소', value: row.canceled_count },
                    { label: '서지 콜', value: row.surge_call_cnt },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center bg-gray-50 rounded-lg py-2">
                      <div className="text-lg font-bold text-gray-900">{value}</div>
                      <div className="text-xs text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
                {row.ai_summary && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed">
                    <span className="text-blue-500 font-medium text-xs block mb-1">AI 요약</span>
                    {row.ai_summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

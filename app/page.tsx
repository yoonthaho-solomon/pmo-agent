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

function FileInput({
  label,
  icon,
  file,
  inputRef,
  onChange,
  onClear,
}: {
  label: string
  icon: string
  file: File | null
  inputRef: React.RefObject<HTMLInputElement>
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

export default function Home() {
  const [callcardFile, setCallcardFile] = useState<File | null>(null)
  const [remappedFile, setRemappedFile] = useState<File | null>(null)
  const [serviceDate, setServiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  )

  // ASP 분석 상태
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analyzeDebug, setAnalyzeDebug] = useState<unknown>(null)

  // 기사 로그 적재 상태
  const [driverLoading, setDriverLoading] = useState(false)
  const [driverResult, setDriverResult] = useState<DriverLogsResponse | null>(null)
  const [driverError, setDriverError] = useState<string | null>(null)
  const [driverDebug, setDriverDebug] = useState<unknown>(null)

  const callcardRef = useRef<HTMLInputElement>(null)
  const remappedRef = useRef<HTMLInputElement>(null)

  function buildFormData() {
    const form = new FormData()
    form.append('callcard_eta', callcardFile!)
    form.append('remapped', remappedFile!)
    form.append('service_date', serviceDate)
    return form
  }

  function validateFiles(): boolean {
    return !!(callcardFile && remappedFile)
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!validateFiles()) return

    setAnalyzeLoading(true)
    setAnalyzeError(null)
    setAnalyzeResult(null)
    setAnalyzeDebug(null)

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: buildFormData() })
      const json = await res.json()
      if (!res.ok) {
        setAnalyzeError(json.error ?? '알 수 없는 오류')
        if (json.debug) setAnalyzeDebug(json.debug)
      } else {
        setAnalyzeResult(json as AnalyzeResponse)
      }
    } catch {
      setAnalyzeError('서버 연결에 실패했습니다.')
    } finally {
      setAnalyzeLoading(false)
    }
  }

  async function handleDriverLogs(e: React.FormEvent) {
    e.preventDefault()
    if (!validateFiles()) return

    setDriverLoading(true)
    setDriverError(null)
    setDriverResult(null)
    setDriverDebug(null)

    try {
      const res = await fetch('/api/driver-logs', { method: 'POST', body: buildFormData() })
      const json = await res.json()
      if (!res.ok) {
        setDriverError(json.error ?? '알 수 없는 오류')
        if (json.debug) setDriverDebug(json.debug)
      } else {
        setDriverResult(json as DriverLogsResponse)
      }
    } catch {
      setDriverError('서버 연결에 실패했습니다.')
    } finally {
      setDriverLoading(false)
    }
  }

  const filesReady = validateFiles()

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-3xl space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">PMO 콜 분석</h1>
          <p className="text-sm text-gray-500">
            callcard_eta, remapped 엑셀 파일을 업로드하여 분석하거나 기사 로그를 적재합니다.
          </p>
        </div>

        {/* 공통 파일 업로드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">파일 업로드</h2>

          <FileInput
            label="callcard_eta 파일"
            icon="📋"
            file={callcardFile}
            inputRef={callcardRef}
            onChange={setCallcardFile}
            onClear={() => setCallcardFile(null)}
          />

          <FileInput
            label="remapped 파일"
            icon="🗂️"
            file={remappedFile}
            inputRef={remappedRef}
            onChange={setRemappedFile}
            onClear={() => setRemappedFile(null)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">서비스 날짜</label>
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* 두 액션 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* ASP 분석 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">ASP 콜 분석</h2>
              <p className="text-xs text-gray-500 mt-0.5">ASP별 KPI 및 AI 요약 생성 후 daily_snapshots에 저장</p>
            </div>

            {analyzeError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 space-y-1">
                <div>{analyzeError}</div>
                {analyzeDebug && (
                  <pre className="bg-red-100 rounded p-2 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(analyzeDebug, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {analyzeResult && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                분석 완료: ASP {analyzeResult.asp_count}개 · 총 {analyzeResult.total_rows_processed}건
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={analyzeLoading || !filesReady}
              className="mt-auto w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {analyzeLoading ? '분석 중… (AI 요약 ~30초)' : '분석 실행'}
            </button>
          </div>

          {/* 기사 로그 적재 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">기사 로그 적재</h2>
              <p className="text-xs text-gray-500 mt-0.5">기사별 하루치 행동 데이터를 driver_daily_logs에 upsert</p>
            </div>

            {driverError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 space-y-1">
                <div>{driverError}</div>
                {driverDebug && (
                  <pre className="bg-red-100 rounded p-2 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(driverDebug, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {driverResult && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                처리 완료: {driverResult.driver_count}명 기사 적재됨
              </div>
            )}

            <button
              onClick={handleDriverLogs}
              disabled={driverLoading || !filesReady}
              className="mt-auto w-full py-2.5 px-4 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {driverLoading ? '적재 중…' : '기사 로그 적재'}
            </button>
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
                    row.success_rate >= 0.8
                      ? 'bg-green-100 text-green-700'
                      : row.success_rate >= 0.5
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
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

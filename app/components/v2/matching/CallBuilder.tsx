import type { ScenarioPointInput } from '@/lib/adapters/matching'
import type { GoogleMapsGlobal } from '@/lib/google-maps/client-loader'
import type { MatchingCallcardModel } from '@/lib/matching-studio-model'
import type { InputMode, ScenarioStatus } from './useMatchingStudio'
import { formatFare, formatMeter } from './formatters'
import { CallcardSelect } from './CallcardSelect'
import { PlaceSearchInput } from './PlaceSearchInput'
import styles from './matchingStudio.module.css'

const STATUS_LABELS: Record<string, string> = {
  accepted: '배차 성공',
  expired: '미배차',
  canceled: '호출 취소',
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  accepted: { label: '배차 성공', tone: 'green' },
  expired: { label: '미배차', tone: 'amber' },
  canceled: { label: '호출 취소', tone: 'muted' },
}

export function CallBuilder({
  google,
  callcards,
  selectedId,
  selectedCallcard,
  asps,
  dates,
  hours,
  statuses,
  selectedAsp,
  selectedDate,
  selectedHour,
  selectedStatus,
  sliceLoading,
  onAspChange,
  onDateChange,
  onHourChange,
  onStatusChange,
  scenarioOrigin,
  scenarioDestination,
  scenarioOriginText,
  scenarioDestinationText,
  scenarioError,
  onSelect,
  onScenarioOrigin,
  onScenarioDestination,
  onScenarioOriginText,
  onScenarioDestinationText,
  onClearScenario,
  inputMode,
  onInputModeChange,
  isPending,
}: {
  google: GoogleMapsGlobal | null
  callcards: MatchingCallcardModel[]
  selectedId: string
  selectedCallcard: MatchingCallcardModel | null
  asps: number[]
  dates: string[]
  hours: number[]
  statuses: string[]
  selectedAsp: string
  selectedDate: string
  selectedHour: string
  selectedStatus: string
  sliceLoading: boolean
  onAspChange: (v: string) => void
  onDateChange: (v: string) => void
  onHourChange: (v: string) => void
  onStatusChange: (v: string) => void
  scenarioOrigin: ScenarioPointInput | null
  scenarioDestination: ScenarioPointInput | null
  scenarioOriginText: string
  scenarioDestinationText: string
  scenarioStatus: ScenarioStatus
  scenarioError: string | null
  onSelect: (id: string) => void
  onRun: () => void
  onScenarioOrigin: (point: ScenarioPointInput | null) => void
  onScenarioDestination: (point: ScenarioPointInput | null) => void
  onScenarioOriginText: (text: string) => void
  onScenarioDestinationText: (text: string) => void
  onClearScenario: () => void
  onSwapScenario: () => void
  onRunScenario: () => void
  inputMode: InputMode
  onInputModeChange: (mode: InputMode) => void
  isPending: boolean
}) {
  const center = selectedCallcard?.route.pickup.lat != null && selectedCallcard.route.pickup.lng != null
    ? { lat: selectedCallcard.route.pickup.lat, lng: selectedCallcard.route.pickup.lng }
    : null
  const hasScenarioInput = Boolean(scenarioOrigin || scenarioDestination || scenarioOriginText.trim() || scenarioDestinationText.trim())

  return (
    <aside className={styles.callBuilder} aria-label="콜카드 입력 패널">
      <header className={styles.builderHead}>
        <span className={styles.builderAccent} aria-hidden />
        <div className={styles.builderHeadText}>
          <p className={styles.eyebrow}>CALL BUILDER</p>
          <h2>콜카드 조건</h2>
        </div>
        <span className={styles.builderCount}>{sliceLoading ? '…' : `${callcards.length}건`}</span>
      </header>

      <section className={styles.builderSection}>
        <p className={styles.sectionLabel}>데이터 필터</p>
        <div className={styles.filterRow}>
          <label>
            <span>ASP 지역</span>
            <select value={selectedAsp} disabled={sliceLoading} onChange={(e) => onAspChange(e.target.value)}>
              <option value="all">전체</option>
              {asps.map((asp) => (
                <option key={asp} value={String(asp)}>ASP {asp}</option>
              ))}
            </select>
          </label>
          <label>
            <span>날짜{sliceLoading ? ' · 로딩중' : ''}</span>
            <select value={selectedDate} disabled={sliceLoading} onChange={(e) => onDateChange(e.target.value)}>
              <option value="all">전체</option>
              {dates.map((d) => (
                <option key={d} value={d}>{d.slice(5)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>시간대</span>
            <select value={selectedHour} disabled={sliceLoading} onChange={(e) => onHourChange(e.target.value)}>
              <option value="all">전체</option>
              {hours.map((h) => (
                <option key={h} value={String(h)}>{h}시</option>
              ))}
            </select>
          </label>
          <label>
            <span>상태</span>
            <select value={selectedStatus} disabled={sliceLoading} onChange={(e) => onStatusChange(e.target.value)}>
              <option value="all">전체</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className={styles.modeToggle} role="tablist" aria-label="입력 모드">
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === 'callcard'}
          data-active={inputMode === 'callcard'}
          onClick={() => onInputModeChange('callcard')}
        >
          콜카드 기준
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === 'scenario'}
          data-active={inputMode === 'scenario'}
          onClick={() => onInputModeChange('scenario')}
        >
          시나리오 입력
        </button>
      </div>

      <section className={styles.builderSection}>
        <p className={styles.sectionLabel}>기준 콜카드</p>
        <CallcardSelect callcards={callcards} selectedId={selectedId} onSelect={onSelect} />

        {inputMode === 'callcard' ? (
          selectedCallcard ? (
            <div className={styles.callCard}>
              <div className={styles.callHero}>
                <div className={styles.callHeroMain}>
                  <strong>{selectedCallcard.callDate ?? '날짜 없음'}</strong>
                  <span>{selectedCallcard.hourSlot ?? '-'}시 · {selectedCallcard.isPaid ? '유료호출' : '일반호출'}</span>
                </div>
                {selectedCallcard.statusGroup && STATUS_META[selectedCallcard.statusGroup] ? (
                  <span className={styles.statusChip} data-tone={STATUS_META[selectedCallcard.statusGroup].tone}>
                    {STATUS_META[selectedCallcard.statusGroup].label}
                  </span>
                ) : null}
              </div>
              <div className={styles.callMetrics}>
                <span>예상거리 <b>{formatMeter(selectedCallcard.expectedDistance)}</b></span>
                <span>예상요금 <b>{formatFare(selectedCallcard.expectedFare)}</b></span>
              </div>
            </div>
          ) : (
            <div className={styles.softNotice}>선택 가능한 콜카드가 없습니다.</div>
          )
        ) : (
          <p className={styles.scenarioCaption}>위 콜카드의 시간·요금·호출 맥락에 가상 출·도착지를 적용해 매칭합니다.</p>
        )}
      </section>

      {inputMode === 'scenario' ? (
        <div className={styles.scenarioBox}>
          <PlaceSearchInput
            google={google}
            label="출발지 검색"
            placeholder="예: 천안시청"
            value={scenarioOrigin}
            text={scenarioOriginText}
            center={center}
            onTextChange={onScenarioOriginText}
            onSelect={onScenarioOrigin}
            onClear={() => onScenarioOrigin(null)}
          />
          <PlaceSearchInput
            google={google}
            label="도착지 검색"
            placeholder="예: 천안역"
            value={scenarioDestination}
            text={scenarioDestinationText}
            center={center}
            onTextChange={onScenarioDestinationText}
            onSelect={onScenarioDestination}
            onClear={() => onScenarioDestination(null)}
          />
          {hasScenarioInput ? (
            <div className={styles.scenarioActions}>
              <button type="button" onClick={onClearScenario}>출·도착지 초기화</button>
            </div>
          ) : null}
          {scenarioError ? <p className={styles.formError}>{scenarioError}</p> : null}
        </div>
      ) : null}

      {isPending ? (
        <div className={styles.pendingNotice}>후보 분석 중…</div>
      ) : null}
    </aside>
  )
}

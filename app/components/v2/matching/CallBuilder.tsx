import type { ScenarioPointInput } from '@/lib/adapters/matching'
import type { GoogleMapsGlobal } from '@/lib/google-maps/client-loader'
import type { MatchingCallcardModel } from '@/lib/matching-studio-model'
import type { ScenarioStatus } from './useMatchingStudio'
import { compactH3, formatCoordinate, formatFare, formatMeter } from './formatters'
import { H3_SOURCE_LABELS } from './matchingMeta'
import { PlaceSearchInput } from './PlaceSearchInput'
import styles from './matchingStudio.module.css'

export function CallBuilder({
  google,
  callcards,
  selectedId,
  selectedCallcard,
  scenarioOrigin,
  scenarioDestination,
  scenarioOriginText,
  scenarioDestinationText,
  scenarioStatus,
  scenarioError,
  onSelect,
  onRun,
  onScenarioOrigin,
  onScenarioDestination,
  onScenarioOriginText,
  onScenarioDestinationText,
  onClearScenario,
  onSwapScenario,
  onRunScenario,
  isPending,
}: {
  google: GoogleMapsGlobal | null
  callcards: MatchingCallcardModel[]
  selectedId: string
  selectedCallcard: MatchingCallcardModel | null
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
  isPending: boolean
}) {
  const center = selectedCallcard?.route.pickup.lat != null && selectedCallcard.route.pickup.lng != null
    ? { lat: selectedCallcard.route.pickup.lat, lng: selectedCallcard.route.pickup.lng }
    : null
  const hasScenarioInput = Boolean(scenarioOrigin || scenarioDestination || scenarioOriginText.trim() || scenarioDestinationText.trim())
  const canRunScenario = Boolean(scenarioOrigin && scenarioDestination)

  return (
    <aside className={styles.callBuilder} aria-label="콜카드 입력 패널">
      <div>
        <p className={styles.eyebrow}>CALL BUILDER</p>
        <h2>콜카드 조건</h2>
        <p className={styles.muted}>기존 콜카드의 22D 성향 벡터는 유지하고, 출발지·도착지 H3를 바꿔 Top 10 후보를 다시 계산합니다.</p>
      </div>

      <label className={styles.field}>
        <span>기준 콜카드</span>
        <select value={selectedId} onChange={(event) => onSelect(event.target.value)} aria-label="분석할 콜카드 선택">
          {callcards.map((callcard) => (
            <option key={callcard.id} value={callcard.id}>
              {callcard.callDate ?? '날짜 없음'} / {callcard.id}
            </option>
          ))}
        </select>
      </label>

      {selectedCallcard ? (
        <div className={styles.callCard}>
          <div className={styles.callHero}>
            <strong>{selectedCallcard.callDate ?? '날짜 없음'}</strong>
            <span>{selectedCallcard.hourSlot ?? '-'}시 · {selectedCallcard.isPaid ? '유료호출' : '일반호출'}</span>
          </div>
          <div className={styles.callMetrics}>
            <span>예상거리 <b>{formatMeter(selectedCallcard.expectedDistance)}</b></span>
            <span>예상요금 <b>{formatFare(selectedCallcard.expectedFare)}</b></span>
            <span>출발 좌표 <b>{formatCoordinate(selectedCallcard.route.pickup.lat, selectedCallcard.route.pickup.lng)}</b></span>
            <span>도착 좌표 <b>{formatCoordinate(selectedCallcard.route.destination.lat, selectedCallcard.route.destination.lng)}</b></span>
          </div>
          <div className={styles.h3Grid}>
            <span>출발 H3 <b>{compactH3(selectedCallcard.route.pickup.h3Res7)}</b></span>
            <span>도착 H3 <b>{compactH3(selectedCallcard.route.destination.h3Res7)}</b></span>
            <span>OD 경로 키 <b>{selectedCallcard.route.originDestinationKey ? '생성됨' : '정보 없음'}</b></span>
            <span>H3 출처 <b>{H3_SOURCE_LABELS[selectedCallcard.diagnostics.pickupH3Source]} / {H3_SOURCE_LABELS[selectedCallcard.diagnostics.destinationH3Source]}</b></span>
          </div>
        </div>
      ) : (
        <div className={styles.softNotice}>선택 가능한 콜카드가 없습니다.</div>
      )}

      <div className={styles.scenarioBox}>
        <div>
          <b>시나리오 매칭</b>
          <small>주소를 바꾸면 기존 22D 벡터는 유지하고 H3 공간점수만 서버에서 다시 계산합니다.</small>
        </div>
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
        <div className={styles.scenarioActions}>
          <button type="button" onClick={onSwapScenario} disabled={!scenarioOrigin && !scenarioDestination}>맞바꾸기</button>
          <button type="button" onClick={onClearScenario}>원본 위치</button>
        </div>
        {scenarioStatus === 'dirty' ? <p className={styles.formNotice}>시나리오 재계산이 필요합니다.</p> : null}
        {hasScenarioInput && !canRunScenario ? <p className={styles.formNotice}>출발지와 도착지를 검색 결과에서 모두 선택해야 계산할 수 있습니다.</p> : null}
        {scenarioError ? <p className={styles.formError}>{scenarioError}</p> : null}
      </div>

      <button className={styles.primaryAction} type="button" disabled={!selectedCallcard || isPending || (hasScenarioInput && !canRunScenario)} onClick={hasScenarioInput ? onRunScenario : onRun}>
        {isPending ? '후보 분석 중' : hasScenarioInput ? '시나리오 Top 10 계산' : '원본 콜카드 Top 10 분석'}
      </button>
    </aside>
  )
}

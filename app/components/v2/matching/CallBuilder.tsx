import type { MatchingCallcardModel } from '@/lib/matching-studio-model'
import { compactH3, formatCoordinate, formatFare, formatMeter } from './formatters'
import { H3_SOURCE_LABELS } from './matchingMeta'
import styles from './matchingStudio.module.css'

export function CallBuilder({
  callcards,
  selectedId,
  selectedCallcard,
  onSelect,
  onRun,
  isPending,
}: {
  callcards: MatchingCallcardModel[]
  selectedId: string
  selectedCallcard: MatchingCallcardModel | null
  onSelect: (id: string) => void
  onRun: () => void
  isPending: boolean
}) {
  return (
    <aside className={styles.callBuilder} aria-label="콜카드 입력 패널">
      <div>
        <p className={styles.eyebrow}>CALLCARD INPUT</p>
        <h2>실제 콜카드 선택</h2>
        <p className={styles.muted}>저장된 콜카드의 시간, 요금, 거리, 출발·도착 H3를 기준으로 후보 기사를 다시 정렬합니다.</p>
      </div>

      <label className={styles.field}>
        <span>콜카드</span>
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

      <button className={styles.primaryAction} type="button" disabled={!selectedCallcard || isPending} onClick={onRun}>
        {isPending ? '후보 분석 중' : '후보 기사 Top 10 분석'}
      </button>
    </aside>
  )
}

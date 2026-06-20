import { AppShell } from './shell/AppShell'
import { Badge } from './primitives/Badge'
import { Button } from './primitives/Button'
import { Input } from './primitives/Input'
import { Panel } from './primitives/Panel'
import { Tooltip } from './primitives/Tooltip'
import { QueryStateBoundary } from './shell/QueryStateBoundary'
import styles from './styles/primitives.module.css'

const workspaceCopy = {
  'data-ops': {
    eyebrow: 'DATA OPS CONSOLE',
    title: '데이터 운영 콘솔',
    body: '호출데이터와 앱미터데이터가 언제, 얼마나, 정상적으로 쌓였는지 날짜 매트릭스와 인스펙터로 확인하는 작업공간입니다.',
    panel: 'Phase 2에서 Source Rail, 적재 Matrix, 선택 Cell Inspector, Data Catalog를 실제 system-status 응답에 연결합니다.',
    badge: '데이터 운영',
  },
  'vector-workbench': {
    eyebrow: 'VECTOR WORKBENCH',
    title: '벡터 워크벤치',
    body: '콜카드 조건과 기사 운행패턴이 어떤 팩터로 임베딩되고, 코사인 유사도에 어떤 차이를 만드는지 비교하는 작업공간입니다.',
    panel: 'Phase 3에서 Factor Library, Vector Matrix, Relationship Map, Cosine Lens를 기존 22D 계산에 연결합니다.',
    badge: '22D 보호',
  },
  'matching-studio': {
    eyebrow: 'MATCHING STUDIO',
    title: '공간 매칭 스튜디오',
    body: '콜 조건과 출발·도착 위치를 기준으로 먼저 발송할 기사 후보를 확인하는 지도 중심 작업공간입니다.',
    panel: 'Phase 4 이후 Call Builder, Map Stage, Candidate Dock, Evidence Drawer를 순서대로 연결합니다.',
    badge: '지도 준비',
  },
} as const

export function WorkspacePlaceholder({ workspace }: { workspace: keyof typeof workspaceCopy }) {
  const copy = workspaceCopy[workspace]

  return (
    <AppShell>
      <div className={styles.workspace}>
        <Panel className={styles.placeholderHero}>
          <div>
            <Badge tone="cyan">{copy.eyebrow}</Badge>
            <h1 className={styles.placeholderTitle}>{copy.title}</h1>
            <p className={styles.placeholderText}>{copy.body}</p>
          </div>
          <Panel floating className={styles.placeholderMeta}>
            <Badge tone="green">Phase 1 Foundation</Badge>
            <strong>{copy.badge}</strong>
            <span>{copy.panel}</span>
          </Panel>
        </Panel>

        <Panel className={styles.placeholderHero}>
          <div>
            <Badge tone="violet">Primitives Check</Badge>
            <p className={styles.placeholderText}>
              이 화면은 V2 AppShell과 공통 UI primitive가 기존 V1 화면과 격리되어 동작하는지 확인하기 위한 placeholder입니다.
            </p>
          </div>
          <div className={styles.placeholderMeta}>
            <Input aria-label="V2 input preview" placeholder="V2 입력 필드" />
            <Tooltip label="Phase 1 기본 tooltip입니다.">
              <Button variant="primary">상태 확인</Button>
            </Tooltip>
          </div>
        </Panel>

        <QueryStateBoundary status="success">
          <Panel className={styles.stateBox}>
            <div>
              <strong>V2 경로 준비 완료</strong>
              <span>실제 데이터 UI는 다음 Phase에서 연결합니다.</span>
            </div>
          </Panel>
        </QueryStateBoundary>
      </div>
    </AppShell>
  )
}

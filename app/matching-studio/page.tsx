import { EmptyState } from '@/app/components/v2/primitives/QueryStates'
import { AppShell } from '@/app/components/v2/shell/AppShell'
import { MatchingRetryState } from '@/app/components/v2/matching/MatchingRetryState'
import { MatchingStudio } from '@/app/components/v2/matching/MatchingStudio'
import { getMatchingStudioModel } from '@/lib/adapters/matching'

export const dynamic = 'force-dynamic'

export default async function MatchingStudioPage() {
  const model = await getMatchingStudioModel()

  return (
    <AppShell>
      {model.status === 'error' ? (
        <MatchingRetryState title="Matching Studio Error" message="매칭 분석 데이터를 다시 불러오지 못했습니다." />
      ) : null}
      {model.status === 'empty' ? <EmptyState message={model.message} /> : null}
      {model.status === 'partial' ? (
        <>
          <MatchingRetryState title="Partial Data" message="일부 매칭 데이터만 준비되었습니다. 화면은 가능한 데이터 기준으로 표시합니다." />
          <MatchingStudio model={model} />
        </>
      ) : null}
      {model.status === 'success' ? <MatchingStudio model={model} /> : null}
    </AppShell>
  )
}

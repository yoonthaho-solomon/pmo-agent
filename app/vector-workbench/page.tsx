import { AppShell } from '@/app/components/v2/shell/AppShell'
import { EmptyState } from '@/app/components/v2/primitives/QueryStates'
import { VectorRetryState } from '@/app/components/v2/vectors/VectorRetryState'
import { VectorWorkbench } from '@/app/components/v2/vectors/VectorWorkbench'
import { getVectorWorkbenchModel } from '@/lib/adapters/vectors'

export const dynamic = 'force-dynamic'

export default async function VectorWorkbenchPage() {
  const model = await getVectorWorkbenchModel()

  return (
    <AppShell>
      {model.status === 'error' ? <VectorRetryState title="Error" message="벡터 데이터를 다시 불러오지 못했습니다." /> : null}
      {model.status === 'empty' ? <EmptyState message={model.message} /> : null}
      {model.status === 'partial' ? (
        <>
          <VectorRetryState title="Partial" message="일부 벡터 원천을 불러오지 못했습니다. 다시 시도할 수 있습니다." />
          <VectorWorkbench model={model} />
        </>
      ) : null}
      {model.status === 'success' ? <VectorWorkbench model={model} /> : null}
    </AppShell>
  )
}

import { AppShell } from '@/app/components/v2/shell/AppShell'
import { EmptyState, ErrorState, PartialState } from '@/app/components/v2/primitives/QueryStates'
import { VectorWorkbench } from '@/app/components/v2/vectors/VectorWorkbench'
import { getVectorWorkbenchModel } from '@/lib/adapters/vectors'

export const dynamic = 'force-dynamic'

export default async function VectorWorkbenchPage() {
  const model = await getVectorWorkbenchModel()

  return (
    <AppShell>
      {model.status === 'error' ? <ErrorState message={model.message} /> : null}
      {model.status === 'empty' ? <EmptyState message={model.message} /> : null}
      {model.status === 'partial' ? (
        <>
          <PartialState message={model.message} />
          <VectorWorkbench model={model} />
        </>
      ) : null}
      {model.status === 'success' ? <VectorWorkbench model={model} /> : null}
    </AppShell>
  )
}


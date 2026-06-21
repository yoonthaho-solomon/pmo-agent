import { AppShell } from '@/app/components/v2/shell/AppShell'
import { VectorWorkbench } from '@/app/components/v2/vectors/VectorWorkbench'
import { VectorRetryState } from '@/app/components/v2/vectors/VectorRetryState'
import { getVectorWorkbenchModel } from '@/lib/adapters/vectors'

export const metadata = {
  title: 'KONAMOBILITY 벡터 워크벤치',
}

export default async function VectorWorkbenchPage() {
  const model = await getVectorWorkbenchModel()

  return (
    <AppShell>
      {model.status === 'error' ? (
        <VectorRetryState title="Error" message={model.message} />
      ) : model.status === 'partial' ? (
        <>
          <VectorRetryState title="Partial" message={model.message} />
          <VectorWorkbench model={model} />
        </>
      ) : (
        <VectorWorkbench model={model} />
      )}
    </AppShell>
  )
}

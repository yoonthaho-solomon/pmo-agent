import { AppShell } from '@/app/components/v2/shell/AppShell'
import { VectorWorkbenchView } from './VectorWorkbenchView'

export const metadata = {
  title: 'KONAMOBILITY — 벡터 워크벤치',
}

export default function VectorWorkbenchPage() {
  return (
    <AppShell>
      <VectorWorkbenchView />
    </AppShell>
  )
}

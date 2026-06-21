import { AppShell } from '@/app/components/v2/shell/AppShell'
import { DataOpsView } from './DataOpsView'

export const metadata = {
  title: 'KONAMOBILITY — 데이터 운영',
}

export default function DataOpsPage() {
  return (
    <AppShell>
      <DataOpsView />
    </AppShell>
  )
}

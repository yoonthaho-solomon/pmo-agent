import { AppShell } from '@/app/components/v2/shell/AppShell'
import { DispatchLogicView } from './DispatchLogicView'

export const metadata = {
  title: 'KONAMOBILITY — 배차 로직',
}

export default function DispatchLogicPage() {
  return (
    <AppShell>
      <DispatchLogicView />
    </AppShell>
  )
}

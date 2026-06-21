import { AppShell } from '@/app/components/v2/shell/AppShell'
import { MatchingStudioView } from './MatchingStudioView'

export const metadata = {
  title: 'KONAMOBILITY — 매칭 스튜디오',
}

export default function MatchingStudioPage() {
  return (
    <AppShell>
      <MatchingStudioView />
    </AppShell>
  )
}

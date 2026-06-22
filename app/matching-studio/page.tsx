import { AppShell } from '@/app/components/v2/shell/AppShell'
import { MatchingStudio } from '@/app/components/v2/matching/MatchingStudio'
import { getMatchingStudioModel } from '@/lib/adapters/matching'

export const metadata = {
  title: 'KONAMOBILITY — 매칭 스튜디오',
}

export default async function MatchingStudioPage() {
  const model = await getMatchingStudioModel()
  return (
    <AppShell>
      <MatchingStudio model={model} />
    </AppShell>
  )
}

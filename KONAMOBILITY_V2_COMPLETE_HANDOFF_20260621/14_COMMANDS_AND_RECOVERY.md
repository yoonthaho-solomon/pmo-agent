# Commands And Recovery

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

PowerShell basics:
`powershell
cd C:\Users\pgman\pmo-agent
git branch --show-current
git rev-parse HEAD
git status -sb
npm install
npm run dev -- -p 3133
npx tsc --noEmit --incremental false
npm run build
git diff --check
`

Bundle restore:
`powershell
git clone KONAMOBILITY_V2_SOURCE_f2b5b2b.bundle pmo-agent-restored
cd pmo-agent-restored
git branch -a
git checkout feature/konamobility-v2-workspaces
`

Source zip restore:
`powershell
Expand-Archive KONAMOBILITY_V2_SOURCE_SNAPSHOT_f2b5b2b.zip .\pmo-agent-source
cd .\pmo-agent-source
npm install
`
"@)

Write-Utf8 '15_NEXT_WORK_MASTER_PLAN.md' ((Header 'Next Work Master Plan') + @"
Next work is not new feature development. Next work is Release QA and real-screen validation.

Order:
1. Verify handoff package.
2. Run full V1/V2 smoke tests.
3. Capture actual screens at 1440x900 and 1920x1080.
4. Fix only release-blocking defects.
5. Ask design review for visual hierarchy improvements.
6. Verify Google Cloud key restrictions.
7. Decide Production auth/rate limit.
8. Clean build in CI/new machine.
9. Merge only after approval.
10. Production smoke test and tag.

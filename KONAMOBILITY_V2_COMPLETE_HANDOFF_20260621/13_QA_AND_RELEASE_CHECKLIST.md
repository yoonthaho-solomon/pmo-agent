# QA And Release Checklist

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

- [ ] V1 /ingest smoke
- [ ] V1 /vectors smoke
- [ ] V1 /simulator smoke
- [ ] V2 /data-ops smoke
- [ ] V2 /vector-workbench smoke
- [ ] V2 /matching-studio smoke
- [ ] Data Ops empty/partial/error/unsupported states
- [ ] Vector 22D order and cosine reuse
- [ ] Matching original/dirty/calculating/ready/error states
- [ ] Scenario stale response and abort behavior
- [ ] Google map fallback behavior
- [ ] 1440x900 visual QA
- [ ] 1920x1080 visual QA
- [ ] TypeScript
- [ ] ESLint on changed files
- [ ] git diff --check
- [ ] clean build outside Windows EPERM environment
- [ ] Vercel Preview Ready
- [ ] Production env configured
- [ ] Production auth/rate limit
- [ ] Rollback plan
- [ ] Production tag after successful release

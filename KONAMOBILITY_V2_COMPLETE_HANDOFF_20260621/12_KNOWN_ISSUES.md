# Known Issues

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

Windows / Next.js 16:
- Local build can hang or hit .next/trace EPERM/Turbopack issues on Windows.
- This is tracked separately from Vercel Ready status.

Preview:
- Vercel protected preview can return 401 for unauthenticated users.
- Treat this as preview protection, not build failure.

Still required:
- Full visual QA at 1440x900 and 1920x1080.
- Production clean build in CI/clean machine.
- Production auth/rate limit decision.
- Google key restriction verification.

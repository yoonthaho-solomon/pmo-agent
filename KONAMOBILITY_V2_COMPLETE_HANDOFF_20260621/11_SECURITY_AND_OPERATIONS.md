# Security And Operations

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

Do not expose:
- Supabase service role key
- Google server key
- Vercel token
- GitHub token
- cookies or bearer tokens

Current known security status:
- Preview can be protected by Vercel authentication; this is not a deployment failure.
- Production auth and rate limit are not complete.
- Public API hardening must be completed before Production.
- Server error details must not be sent to clients.

# Google Maps And Cloud Setup

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

Google Cloud project: KONAMOBILITY-PMO-MAPS

Required APIs:
- Maps JavaScript API
- Places API (New)
- Routes API

Environment variable names only:
`env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAP_ID=
GOOGLE_MAPS_SERVER_API_KEY=
`

Security checklist:
- Browser key: HTTP referrer restrictions for localhost, Vercel Preview, branch alias, and Production domain.
- Server key: restrict to Routes API where possible; never expose to browser.
- Do not log keys.
- Recheck quota and billing alerts before Production.

# System Architecture

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

Stack:
- Next.js App Router
- React client components under pp/components/v2/*
- Server adapters under lib/adapters/*
- Supabase access on server/API side
- Google Maps client loader for the map shell
- Routes server API via /api/maps/routes
- H3 utilities and scoring in lib/h3-dispatch.ts and lib/h3-match-score.ts

`mermaid
flowchart LR
  A["Supabase operational tables"] --> B["Server adapters"]
  B --> C["Data Ops"]
  B --> D["Vector Workbench"]
  B --> E["Matching Studio"]
  F["Google Places"] --> E
  G["Google Routes API"] --> H["/api/maps/routes"]
  H --> E
  I["22D cosine"] --> E
  J["H3 spatial score"] --> E
`

V1 routes are parallel and protected. V2 routes are /data-ops, /vector-workbench, /matching-studio.

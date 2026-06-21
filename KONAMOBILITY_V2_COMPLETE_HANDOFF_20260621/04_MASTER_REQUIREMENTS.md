# Master Requirements

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

Phase 1: isolate V2 routes and components without modifying V1.
Phase 2: implement Data Ops Console with honest status semantics.
Phase 3: implement Vector Workbench, 22D matrix, factor inspector, cosine lens, accessibility and retry.
Phase 4: implement server-side Matching Studio Top 10 using same ASP full driver candidates and existing formula.
Phase 5: add Google Maps, Places, Routes, scenario request state, stale response protection, and map/overlay reuse.

Protected principles:
- V1 routes /ingest, /vectors, /simulator remain protected.
- Matching formula remains cosine similarity 75% + H3 spatial score 25%.
- Routes ETA, road distance, expected fare, and pickup ETA are not part of final score.
- Driver preferred H3 cells are historical preference/behavior cells, not live GPS.
- Production auth and rate limiting are not complete.
- Phase 6 has not started.

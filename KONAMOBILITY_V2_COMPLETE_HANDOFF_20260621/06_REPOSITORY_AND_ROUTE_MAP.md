# Repository And Route Map

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

Core routes:
- /ingest: V1 loading/admin route, protected.
- /vectors: V1 vector view, protected.
- /simulator: V1 simulator, protected.
- /data-ops: V2 Data Operations Console.
- /vector-workbench: V2 Vector Workbench.
- /matching-studio: V2 Matching Studio.

Important implementation paths:
- pp/components/v2/shell/*
- pp/components/v2/data-ops/*
- pp/components/v2/vectors/*
- pp/components/v2/matching/*
- lib/matching-vector.ts
- lib/h3-match-score.ts
- lib/adapters/*
- pp/api/maps/routes/route.ts
- pp/api/matching-studio/scenario/route.ts
"@)

Write-Utf8 '07_DATA_CONTRACTS_AND_FORMULAS.md' ((Header 'Data Contracts And Formulas') + @"
Final score:
`	ext
finalScore = cosineSimilarityScore * 0.75 + h3SpatialScore * 0.25
`

If spatial score is unavailable, similarity score remains the fallback. ETA, road distance, fare, and real-time pickup time are not scoring components.

22D factor order:
0 score_dawn
1 score_morning
2 score_daytime
3 score_night
4 score_mon
5 score_tue
6 score_wed
7 score_thu
8 score_fri
9 score_sat
10 score_sun
11 score_short
12 score_medium
13 score_long
14 score_low_fare
15 score_mid_fare
16 score_high_fare
17 score_paid
18 score_free
19 score_surge
20 score_normal
21 score_near

Current display groups:
- pickup accessibility: score_near
- time fit: score_dawn, score_morning, score_daytime, score_night
- day fit: score_mon ~ score_sun
- distance fit: score_short, score_medium, score_long
- revenue/product fit: fare/product factors

H3 semantics:
- Callcard uses origin and destination H3.
- Driver uses pref_s_hexagons and pref_d_hexagons.
- Driver preferred H3 means historical operating preference, not live position.
- Spatial scoring uses H3 grid distance ring weights.

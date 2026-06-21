# Executive Summary

Generated: 2026-06-21
Package source HEAD: f2b5b2b8ecc83e39423945b9353d54b7f6cb8f60
Branch: feature/konamobility-v2-workspaces

Purpose: reduce dispatch leakage by using existing callcard data and accumulated driver behavior to send a callcard first to the most likely accepting drivers.

V1 answered where, when, and why calls are not completed.
V2 answers which driver group should receive a callcard first based on 22D behavioral similarity and H3 spatial fit.

V2 workspaces:
- Data Ops Console: loaded operational data and usability.
- Vector Workbench: callcard/driver factors, 22D vectors, and cosine similarity.
- Matching Studio: Top 10 dispatch candidates using 75/25 scoring and Google spatial scenario inputs.

Phase 1~5 are feature-developed and stabilized. This is not a Production release package. The next step is Release QA, not feature expansion.

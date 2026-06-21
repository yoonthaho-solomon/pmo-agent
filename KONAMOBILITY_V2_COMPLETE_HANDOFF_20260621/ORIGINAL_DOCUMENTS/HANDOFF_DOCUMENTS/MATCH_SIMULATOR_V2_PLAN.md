# Matching Simulator V2 H3 Plan

## Branch

- Working branch: `feature/matching-simulator-v2-h3`
- V1 backup commit: `895271e`
- V1 backup tag: `matching-simulator-v1`

## Goal

V2 upgrades the current matching simulator from a functional 22D cosine ranking screen into a service-grade, game-stat style decision screen.

The simulator must explain:

1. Which driver should receive the call first.
2. Why that driver is a better match.
3. How the recommendation differs from sequential dispatch.
4. Which 22D factors contributed positively or negatively.
5. How H3 origin/destination and pickup accessibility affect the decision.

## Non-Negotiable Rules

- Keep the 22-dimensional raw vector as the calculation layer.
- Keep cosine similarity based on the full 22D vectors.
- Do not calculate final similarity from the 5 radar axes.
- Use the 5 radar axes only as a display and explanation layer.
- Do not label similarity as acceptance probability.
- Keep similarity, acceptance probability, completion probability, pickup accessibility, and final score separated.
- Do not add CDN-based chart libraries.
- Do not use `body { overflow: hidden; }`.
- Do not hardcode fixed pixel-only typography for the simulator surface.
- Do not change the V1 backup tag.
- Do not alter database schema until a mapping gap is documented.

## Target Visual Direction

The screen should feel like a high-quality game player comparison screen:

- Callcard behaves like a mission card.
- Driver behaves like a player card.
- 22D vector is the underlying stat set.
- 5-axis radar is the readable stat display.
- Cyan polygon represents the callcard.
- Orange polygon represents the selected driver.
- Driver selection animates the orange polygon onto the cyan polygon.
- Positive/negative contribution waterfall explains the result.
- KPI bars compare current sequential dispatch and AI-priority dispatch.

## Target Layout

Desktop and beam projector:

- Left 25%: callcard panel
- Center 50%: XAI radar stage
- Right 25%: driver ranking and KPI

Notebook/tablet:

- Keep radar stage prominent.
- Stack side panels using grid areas.

Mobile:

- One-column layout.
- Radar stage appears first.
- No text clipping.
- Radar labels remain readable.

## Core UI Sections

### 1. Callcard Panel

Shows:

- Call route: pickup to destination
- Request time
- Expected trip distance
- Expected fare
- Product type
- Pickup ETA if available
- Pickup H3 and destination H3 if available
- 22 factor tags

### 2. Radar Stage

Shows:

- 5-axis radar canvas
- Callcard polygon
- Selected driver polygon
- Headline: recommended driver, similarity, acceptance probability, pickup ETA
- Natural-language lead sentence
- Diverging waterfall for positive and negative reasons
- Axis click drilldown for source factors

### 3. Driver Ranking

Shows Top 4:

- Driver ID or display name
- Similarity score
- Acceptance probability
- Pickup ETA
- Final recommendation score
- Confidence level

Selecting a driver updates:

- Radar polygon
- Lead sentence
- Waterfall
- KPI bars
- Drilldown values

### 4. KPI Comparison

Shows:

- Baseline sequential dispatch acceptance rate
- AI-priority dispatch acceptance probability
- Delta in percentage points

These values must be labelled as simulation or model output until validated with production outcomes.

## 5 Display Axes

The 5 radar axes are:

1. Pickup acceptance
2. Origin and area familiarity
3. Destination preference
4. Trip distance and time fit
5. Revenue attractiveness

## V2 22 Factors

### Axis 1. Pickup Acceptance

1. Pickup road-distance fit
2. Pickup ETA fit
3. Acceptance rate by pickup distance bucket
4. Average callcard response speed

### Axis 2. Origin And Area Familiarity

5. Origin H3 acceptance rate
6. Origin H3 trip frequency
7. Nearby H3 activity share
8. Origin H3 activity rate at requested time

### Axis 3. Destination Preference

9. Destination H3 acceptance rate
10. Destination H3 completion rate
11. Average time to next call after destination
12. Average empty distance after destination
13. Origin H3 to destination H3 OD acceptance rate

### Axis 4. Trip Distance And Time Fit

14. Expected trip-distance fit
15. Acceptance rate by trip-distance bucket
16. Current time-slot activity rate
17. Current weekday activity rate
18. Expected trip-end-time fit

### Axis 5. Revenue Attractiveness

19. Expected fare fit
20. Extra reward or paid-product preference
21. Expected hourly revenue
22. Expected post-destination revenue value

## H3 And Location Requirements

Use H3 as a core matching input, not as a minor display-only factor.

Required location inputs:

- Driver current latitude and longitude
- Passenger pickup latitude and longitude
- Passenger destination latitude and longitude
- Driver current H3 resolution 7
- Pickup H3 resolution 7
- Destination H3 resolution 7
- OD key: `pickup.h3Res7 + "_" + destination.h3Res7`

Resolution 7 is the default. Resolution 8 is optional for detailed analysis.

## Candidate Filter Flow

Before ranking, exclude:

- Busy drivers
- Offline drivers
- Disconnected drivers
- Drivers outside service area
- Drivers beyond pickup distance limit
- Drivers not working at the requested time

Fallback sequence:

1. Base pickup radius
2. Expanded pickup radius
3. Nearby H3 expansion
4. Existing sequential dispatch fallback

## Score Separation

Expose these values separately:

- `similarityScore`: 22D cosine similarity, 0-100
- `acceptanceProbability`: estimated probability, 0-100
- `completionProbability`: estimated completion probability, 0-100
- `pickupAccessibilityScore`: pickup accessibility, 0-100
- `finalScore`: combined recommendation score, 0-100

Initial final score weights:

```ts
export const MATCH_WEIGHTS = {
  acceptanceProbability: 0.4,
  similarity: 0.25,
  pickupAccessibility: 0.2,
  completionProbability: 0.1,
  operationPolicy: 0.05,
} as const
```

## React Component Plan

Create or evolve toward:

- `MatchSimulator`
- `CallcardPanel`
- `MatchRadar`
- `DriverRanking`
- `MatchWaterfall`
- `MatchKpiComparison`
- `FactorDrilldownModal`
- `ConfidenceBadge`

Map integration can be added later as:

- `MatchMap`

## Data Adapter Plan

V2 should initially adapt current data without schema changes:

- `callcard_mbti`
- `driver_mbti`
- `matching_scores`
- existing vector helpers in `lib/matching-vector.ts`

If required H3/location fields are missing, the UI should show a "data not yet connected" state rather than inventing production values.

## Implementation Phases

### Phase 1. UI Prototype Integration

- Port `match-radar-demo.html` into React.
- Keep Canvas radar behavior.
- Keep Top 4 ranking.
- Keep lead sentence.
- Keep waterfall.
- Keep KPI comparison.
- Keep drilldown modal.
- Use large responsive typography.

### Phase 2. Current Supabase Data Adapter

- Use current `callcard_mbti` and `driver_mbti`.
- Continue using 22D cosine similarity.
- Generate 5-axis display values from available 22D factors.
- Label missing H3/location fields clearly.

### Phase 3. H3-Aware Scoring Modules

- Add types for location profiles and matching response.
- Add H3 ring-weight helper.
- Add candidate filter helper.
- Add acceptance score helper.
- Add final score helper.

### Phase 4. API Contract Alignment

- Align `/api/matching` or a simulator-specific API response with:
  - callcard
  - baseline
  - candidates
  - recommendation
  - metadata

### Phase 5. QA

- `npm run build`
- Local simulator check
- Mobile viewport check
- Notebook viewport check
- Desktop viewport check
- Beam-projector/wide viewport check
- Vercel deployment check

## Done Criteria For V2 First Pass

- A callcard can be selected or loaded.
- Driver Top 4 is shown.
- The radar compares callcard and selected driver.
- Driver click updates radar, lead, waterfall, KPI, and drilldown.
- Similarity score remains 22D cosine based.
- 5-axis radar is display-only.
- Acceptance probability is visually separated from similarity.
- No CDN chart dependency is introduced.
- No global overflow clipping is introduced.
- The page remains readable on mobile, notebook, desktop, and projector widths.


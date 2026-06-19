# Happycall PMO V3 UI Redesign Blueprint

## 1. Product Thesis

The product should explain one clear idea:

> A call card comes in. The system reads its conditions, compares them with accumulated driver behavior embeddings, ranks the best candidates by similarity and spatial fit, then sends the call to the best driver first.

The UI must stop behaving like a collection of admin pages. It should behave like one dispatch workbench with three large stages.

```text
1. Data Status
2. Embedding Factors
3. Matching Simulator
```

The old Dispatch Logic page is not a primary tab anymore. Developer handoff content belongs inside the Matching Simulator as a supporting section.

## 2. Fixed Header

Every main page must share the same fixed header.

### Top Navigation

```text
Happycall PMO AI Dispatch
[Data Status] [Embedding Factors] [Matching Simulator]
```

### Header Rules

- Tab count is fixed at 3.
- Tab position and size are fixed across pages.
- KPI blocks should stay in the head area of each page.
- No browser-back-only navigation.
- No temporary fourth or fifth tab.

## 3. Global Dispatch Flow

The global dispatch flow is the visual spine of the product.

```text
Passenger Request
-> Call Info Created
-> Candidate Driver Search
-> Similarity Calculation
-> Priority Ranking
-> Call Card Sent
-> Driver Accepts
-> Dispatch Complete
-> Trip Complete
```

Each page highlights the part of this flow it owns.

| Page | Active Flow Steps |
| --- | --- |
| Data Status | Passenger Request, Call Info Created |
| Embedding Factors | Call Info Created, Similarity Calculation |
| Matching Simulator | Candidate Driver Search, Similarity Calculation, Priority Ranking, Call Card Sent, Driver Accepts |

This flow must be visual, large, and easy to scan. It should use icon nodes, glow, and short labels. Long text belongs below the flow, not inside it.

## 4. Page 1: Data Status

### Core Message

Show how much source data is ready and what matching assets were generated from it.

### Main KPI

1. Call data period and count.
2. Meter data period and count.
3. Driver 22D vector count.
4. Matching result count.

### Show

- Call data coverage.
- Meter data coverage.
- What call data gives us: request time, weekday, status, pickup/destination address, coordinates, H3, expected distance, expected fare, ETA.
- What meter data gives us: regional taxi flow, income, operation volume, market reference.
- Generated assets: call-card factors, driver logs, driver vectors, matching scores.
- Missing or failed date checks.

### Hide Or Demote

- Upload buttons as primary UI.
- Watch commands as primary UI.
- Environment variable checklists in the first viewport.
- Duplicate coverage cards.
- Vague readiness labels like `4/4`.

### Visual Direction

Use a data operations board: large KPI, compact timeline, readiness status, and generated-output cards.

## 5. Page 2: Embedding Factors

### Core Message

Explain how raw call-card data and driver behavior patterns become comparable numeric vectors.

### Main KPI

1. Selected call card.
2. Candidate driver count.
3. Best cosine similarity.
4. Display mode: 22D calculated, 5-axis summarized.

### Show

Call-card raw factors:

- Request time.
- Weekday.
- Pickup address.
- Destination address.
- Pickup H3.
- Destination H3.
- Expected distance.
- Expected fare.
- Pickup ETA.
- Paid/free/surge/product type.

Driver behavior factors:

- Preferred time band.
- Preferred weekday.
- Preferred distance band.
- Preferred fare band.
- Paid/free/surge/normal tendency.
- Preferred pickup H3.
- Preferred destination H3.
- Reliability.
- Data days.

22D factor list:

```text
score_dawn
score_morning
score_daytime
score_night
score_mon
score_tue
score_wed
score_thu
score_fri
score_sat
score_sun
score_short
score_medium
score_long
score_low_fare
score_mid_fare
score_high_fare
score_paid
score_free
score_surge
score_normal
score_near
```

### Visual Direction

This page should feel like a sports-game ability comparison screen.

```text
Raw call-card value -> Factor score -> Driver comparison -> Cosine similarity
```

Use radar charts, ability bars, factor cards, and a clear comparison between call-card and selected driver.

## 6. Page 3: Matching Simulator

### Core Message

A call card is selected, the candidate drivers are re-ranked, and the best driver to receive the call first is explained.

### Main KPI

1. Query status.
2. Selected real call-card count.
3. Candidate driver count.
4. Best final score.
5. Ranking basis.

### Show

- Call-card input and raw conditions.
- Candidate pool.
- Final recommendation score.
- 22D cosine similarity.
- H3 spatial fit.
- Pickup H3 fit.
- Destination H3 fit.
- Top 4 and Top 10 drivers.
- Driver receive-card preview.
- Fallback scenario after no acceptance.
- Developer handoff summary.

### Simulation Labels

The following values must always be labeled as simulation until live driver state exists:

- Pickup distance.
- ETA.
- Acceptance probability.
- Driver current location.

### Visual Direction

Use a command-center feel: central call-card node, surrounding candidate drivers, thick connection lines for stronger matches, top candidate spotlight, and a driver receive-card preview.

## 7. Visual Treatment Layer

Use motion and glow only to support hierarchy.

### Surface

- Dark glass panels.
- Soft cyan/purple borders.
- Deep shadow.
- Subtle radial glow around the most important card.

### Cards

- Hover lift only for interactive cards.
- Non-clickable status cards should not move aggressively.
- Active cards should glow more strongly than inactive cards.

### Numbers

- Important numbers use large mono typography.
- Use restrained cyan/green glow.
- Avoid tiny metric labels.

### Phone Preview

- Driver receive-card buttons can use press animation.
- Countdown/ring animation can be added later.
- Always label it as simulation if it is not connected to the real driver app.

## 8. Implementation Order

1. Lock the 3-tab shell and global dispatch flow.
2. Rebuild Data Status around data coverage and generated assets.
3. Rebuild Embedding Factors around raw value to 22D factor comparison.
4. Rebuild Matching Simulator around candidate re-ranking and driver receive-card preview.
5. Move developer handoff into Matching Simulator as a supporting section.
6. Add interaction polish after the information hierarchy is stable.

## 9. Definition Of Done

The V3 redesign is done when:

1. The product purpose is understandable within 30 seconds.
2. The three pages do not duplicate each other.
3. The global dispatch flow is visible and useful.
4. Data Status explains what data is ready.
5. Embedding Factors explains how raw values become factors.
6. Matching Simulator shows candidate re-ranking clearly.
7. Real data and simulation values are visibly separated.
8. Header tabs and KPI positions are stable.
9. Large screens feel intentional, not empty or noisy.
10. The UI looks like a live-service dispatch workbench, not a text report.
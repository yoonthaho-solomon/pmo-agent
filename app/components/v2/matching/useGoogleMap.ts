'use client'

import { useEffect, useRef, useState } from 'react'
import { GoogleMapsOverlay } from '@deck.gl/google-maps'
import { ArcLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { H3HexagonLayer, TripsLayer } from '@deck.gl/geo-layers'
import type { Color, Position } from '@deck.gl/core'
import type { ScenarioPointInput } from '@/lib/adapters/matching'
import { coordinateToH3Res7, getH3GridDistance, getH3RingWeight, h3CellCenterLngLat, normalizeH3Cell } from '@/lib/h3-dispatch'
import type { MatchingCandidateModel } from '@/lib/matching-studio-model'
import { loadGoogleMaps, type GoogleMapInstance } from '@/lib/google-maps/client-loader'
import { decodeEncodedPolyline } from '@/lib/google-maps/polyline'
import type { RouteSummary } from '@/lib/google-maps/route-types'

export type GoogleMapLoadState = 'loading' | 'ready' | 'missing_config' | 'load_error' | 'unsupported_webgl'

type H3LayerDatum = {
  hexagon: string
  type: 'call-origin' | 'call-destination' | 'driver-origin' | 'driver-destination'
  // Match strength of this preferred cell against the call's origin/destination cell,
  // derived from H3 grid distance (1 = same cell … 0 = ≥4 rings away). -1 means there is
  // no reference cell to score against yet, so the hex renders at a neutral base tint.
  weight: number
}

type RoutePathDatum = { path: Position[] }
type RouteTripDatum = { path: Position[]; timestamps: number[] }
type RoutePointDatum = { position: Position; color: Color }
// Three fixed-radius rings around the call origin. A bright pulse sweeps outward through
// stage 0 → 1 → 2 (tight max radius) so the call "radiates" in three contained steps
// instead of one ring ballooning across the whole map.
type RippleDatum = { position: Position; radius: number; stage: number }
// Ring radii in meters. The outermost (stage 2) is the max spread — kept small/tight.
const RIPPLE_STAGE_RADII = [70, 135, 200]
// A connecting arc from the call pickup to the selected driver's best-matching preferred
// origin zone (its H3 cell center — NOT a real-time driver location).
type ArcDatum = { source: Position; target: Position }

function supportsWebGL() {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
}

// Score a preferred cell against the call's reference cell. -1 when there is no
// reference cell yet (renders neutral); otherwise 1 → 0 by H3 ring distance.
function weightForCell(referenceCell: string | null, preferredCell: string): number {
  if (!referenceCell) return -1
  return getH3RingWeight(getH3GridDistance(referenceCell, preferredCell))
}

function pushH3(
  data: H3LayerDatum[],
  seen: Set<string>,
  cell: string | null | undefined,
  type: H3LayerDatum['type'],
  referenceCell: string | null,
) {
  const normalized = normalizeH3Cell(cell)
  if (!normalized || seen.has(`${type}:${normalized}`)) return
  seen.add(`${type}:${normalized}`)
  data.push({ hexagon: normalized, type, weight: weightForCell(referenceCell, normalized) })
}

function h3Data(
  candidate: MatchingCandidateModel | null,
  callOrigin: ScenarioPointInput | null,
  callDestination: ScenarioPointInput | null,
): H3LayerDatum[] {
  const data: H3LayerDatum[] = []
  const seen = new Set<string>()
  // Reference cells are derived from the active origin/destination (callcard pickup in
  // callcard mode, scenario points in scenario mode) so the ramp tracks whatever the
  // candidate's spatial score was actually computed against.
  const originRef = callOrigin ? coordinateToH3Res7(callOrigin.lat, callOrigin.lng) : null
  const destinationRef = callDestination ? coordinateToH3Res7(callDestination.lat, callDestination.lng) : null
  for (const hexagon of candidate?.driver.prefOriginH3.slice(0, 10) ?? []) pushH3(data, seen, hexagon, 'driver-origin', originRef)
  for (const hexagon of candidate?.driver.prefDestinationH3.slice(0, 10) ?? []) pushH3(data, seen, hexagon, 'driver-destination', destinationRef)
  return data
}

// Color ramp for a preferred hex: stronger match → brighter tint + much higher opacity,
// so the zones that actually overlap this call's pickup/dropoff clearly stand out from the
// driver's distant preference zones.
function h3FillColor(type: H3LayerDatum['type'], weight: number): Color {
  const base = type === 'driver-origin' ? [67, 214, 239] : [124, 92, 255]
  if (weight < 0) return [base[0], base[1], base[2], 46] as Color
  const mix = weight * 0.55
  return [
    Math.round(base[0] + (255 - base[0]) * mix),
    Math.round(base[1] + (255 - base[1]) * mix),
    Math.round(base[2] + (255 - base[2]) * mix),
    Math.round(18 + weight * 172),
  ] as Color
}

function h3LineColor(weight: number): Color {
  if (weight < 0) return [235, 249, 255, 70] as Color
  return [235, 249, 255, Math.min(240, Math.round(40 + weight * 200))] as Color
}

export function useGoogleMap({
  effectiveOrigin,
  effectiveDestination,
  focusPoint,
  candidate,
  route,
}: {
  effectiveOrigin: ScenarioPointInput | null
  effectiveDestination: ScenarioPointInput | null
  focusPoint: ScenarioPointInput | null
  candidate: MatchingCandidateModel | null
  route: RouteSummary | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GoogleMapInstance | null>(null)
  const overlayRef = useRef<GoogleMapsOverlay | null>(null)
  const routePathRef = useRef<Position[]>([])
  const routeTimestampsRef = useRef<number[]>([])
  const h3DataRef = useRef<H3LayerDatum[]>([])
  const pointsRef = useRef<RoutePointDatum[]>([])
  const rippleRef = useRef<RippleDatum[]>([])
  const arcRef = useRef<ArcDatum[]>([])
  const tRef = useRef(0)
  const animRafRef = useRef<number | null>(null)
  const lastCenterKeyRef = useRef<string | null>(null)
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
  const configMissing = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || !mapId
  const [state, setState] = useState<GoogleMapLoadState>(configMissing ? 'missing_config' : 'loading')

  const routePath = decodeEncodedPolyline(route?.encodedPolyline).map((point) => [point.lng, point.lat] as Position)

  useEffect(() => {
    if (configMissing) return
    if (!containerRef.current) return
    if (mapRef.current && overlayRef.current) return

    if (!supportsWebGL()) {
      window.setTimeout(() => setState('unsupported_webgl'), 0)
      return
    }

    let cancelled = false
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current || mapRef.current) return
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: 36.8151, lng: 127.1139 },
          zoom: 13,
          mapId,
          colorScheme: 'DARK',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: false,
          zoomControl: true,
        })
        mapRef.current = map
        overlayRef.current = new GoogleMapsOverlay({ layers: [] })
        overlayRef.current.setMap(map as never)
        setState('ready')
      })
      .catch(() => setState('load_error'))

    return () => {
      cancelled = true
      overlayRef.current?.finalize()
      overlayRef.current = null
      mapRef.current = null
    }
  }, [configMissing, mapId])

  // Update data refs whenever underlying data changes
  useEffect(() => {
    routePathRef.current = routePath
    // One timestamp per vertex (index-based) so the trail flows origin → destination.
    routeTimestampsRef.current = routePath.map((_, i) => i)
  }, [routePath])

  useEffect(() => {
    h3DataRef.current = h3Data(candidate, effectiveOrigin, effectiveDestination)
    // Arc connects the call pickup to the selected driver's best-matching origin preference
    // cell center, so it only appears once a candidate is selected and that cell exists.
    const target = h3CellCenterLngLat(candidate?.spatial.originBestCell)
    arcRef.current = effectiveOrigin && target
      ? [{ source: [effectiveOrigin.lng, effectiveOrigin.lat] as Position, target: target as Position }]
      : []
  }, [candidate, effectiveOrigin, effectiveDestination])

  useEffect(() => {
    const pts: RoutePointDatum[] = []
    if (effectiveOrigin) pts.push({ position: [effectiveOrigin.lng, effectiveOrigin.lat] as Position, color: [239, 68, 68, 255] as Color })
    if (effectiveDestination) pts.push({ position: [effectiveDestination.lng, effectiveDestination.lat] as Position, color: [220, 38, 38, 255] as Color })
    pointsRef.current = pts
    // Three fixed-radius rings around BOTH the origin and destination; the sweep (alpha)
    // is animated per-frame in the RAF loop so each marker radiates identically.
    const ripples: RippleDatum[] = []
    const addRings = (point: ScenarioPointInput | null) => {
      if (!point) return
      for (let stage = 0; stage < RIPPLE_STAGE_RADII.length; stage++) {
        ripples.push({ position: [point.lng, point.lat] as Position, radius: RIPPLE_STAGE_RADII[stage], stage })
      }
    }
    addRings(effectiveOrigin)
    addRings(effectiveDestination)
    rippleRef.current = ripples
  }, [effectiveOrigin, effectiveDestination])

  // Single RAF loop — rebuilds all layers each frame so the glow can pulse
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || state !== 'ready') return

    const tick = () => {
      tRef.current += 0.016
      const pulse = (Math.sin(tRef.current * 2.4) + 1) / 2

      const pathLen = routePathRef.current.length

      // Dim full-route guide line.
      const routeLayer = new PathLayer<RoutePathDatum>({
        id: 'km-v2-route-path',
        data: pathLen ? [{ path: routePathRef.current }] : [],
        getPath: (row) => row.path,
        getColor: [255, 72, 72, 120],
        getWidth: 5,
        widthMinPixels: 3,
        rounded: true,
      })

      // Comet trail flowing origin → destination, looping.
      const trailLength = Math.max(6, Math.round(pathLen * 0.2))
      const loopTime = pathLen + trailLength
      const trailSpeed = Math.max(8, pathLen / 4)
      const trailLayer = new TripsLayer<RouteTripDatum>({
        id: 'km-v2-route-trail',
        data: pathLen > 1 ? [{ path: routePathRef.current, timestamps: routeTimestampsRef.current }] : [],
        getPath: (row) => row.path,
        getTimestamps: (row) => row.timestamps,
        getColor: [255, 40, 40],
        widthMinPixels: 5,
        widthMaxPixels: 12,
        capRounded: true,
        jointRounded: true,
        fadeTrail: true,
        trailLength,
        currentTime: (tRef.current * trailSpeed) % loopTime,
      })

      const h3Layer = new H3HexagonLayer<H3LayerDatum>({
        id: 'km-v2-h3-layer',
        data: h3DataRef.current,
        getHexagon: (row) => row.hexagon,
        // Ramp fill + outline by match strength so the driver's preferred zones that
        // actually overlap this call's pickup/dropoff glow brighter than distant ones.
        getFillColor: (row) => h3FillColor(row.type, row.weight),
        getLineColor: (row) => h3LineColor(row.weight),
        updateTriggers: {
          getFillColor: h3DataRef.current,
          getLineColor: h3DataRef.current,
        },
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
      })

      // Origin ripple — three fixed-radius rings; a bright pulse sweeps outward through
      // stage 0 → 1 → 2 so the call "radiates" in three tight, contained steps.
      const rippleCycle = 1.8 // seconds for the pulse to sweep through all three stages
      const rippleWave = (tRef.current / rippleCycle) % 1 // 0 → 1 over one full sweep
      const rippleLayer = new ScatterplotLayer<RippleDatum>({
        id: 'km-v2-origin-ripple',
        data: rippleRef.current,
        getPosition: (row) => row.position,
        getRadius: (row) => row.radius,
        getLineColor: (row) => {
          // Each stage owns a 1/3 slot of the cycle; brightness peaks as the sweep passes it.
          const center = (row.stage + 0.5) / 3
          const raw = Math.abs(rippleWave - center)
          const dist = Math.min(raw, 1 - raw) // wrap-around distance
          const intensity = Math.max(0, 1 - dist / (1 / 3))
          return [255, 80, 80, Math.round(34 + intensity * 176)] as Color
        },
        radiusUnits: 'meters',
        stroked: true,
        filled: false,
        lineWidthMinPixels: 1.5,
        lineWidthMaxPixels: 3,
        updateTriggers: { getLineColor: tRef.current },
      })

      // Match arc — call pickup → selected driver's best origin preference zone.
      // Gentle alpha breathe so the connection reads as "live" without distracting.
      const arcAlpha = Math.round(120 + pulse * 90)
      const arcLayer = new ArcLayer<ArcDatum>({
        id: 'km-v2-match-arc',
        data: arcRef.current,
        getSourcePosition: (row) => row.source,
        getTargetPosition: (row) => row.target,
        getSourceColor: [255, 80, 80, arcAlpha] as Color, // call pickup (red)
        getTargetColor: [67, 214, 239, arcAlpha] as Color, // driver zone (cyan)
        getWidth: 2.5,
        getHeight: 0.4,
        widthMinPixels: 1.5,
        widthMaxPixels: 4,
        updateTriggers: { getSourceColor: arcAlpha, getTargetColor: arcAlpha },
      })

      // Soft bloom — a large, very faint halo beneath the marker glow. True post-process
      // bloom isn't available with the Google Maps interleaved overlay, so this approximates
      // it with an oversized low-alpha scatter that reads as a gentle outer bloom.
      const bloomMinPx = Math.round(14 + pulse * 16)  // 14 → 30 px
      const bloomLayer = new ScatterplotLayer<RoutePointDatum>({
        id: 'km-v2-route-bloom',
        data: pointsRef.current,
        getPosition: (row) => row.position,
        getFillColor: (row) => [row.color[0], row.color[1], row.color[2], Math.round(6 + pulse * 12)] as Color,
        getRadius: 320,
        radiusMinPixels: bloomMinPx,
        radiusMaxPixels: 54,
        filled: true,
        stroked: false,
        updateTriggers: { getFillColor: pulse },
      })

      // Glow halo — slow breathe
      const glowAlpha = Math.round(10 + pulse * 45)
      const glowMinPx = Math.round(6 + pulse * 8)   // 6 → 14 px

      // Dot beat — slightly faster independent wave so it feels alive
      const dotPulse = (Math.sin(tRef.current * 3.6) + 1) / 2
      const dotAlpha = Math.round(160 + dotPulse * 95)
      const dotMinPx = Math.round(3 + dotPulse * 3)   // 3 → 6 px

      const glowLayer = new ScatterplotLayer<RoutePointDatum>({
        id: 'km-v2-route-glow',
        data: pointsRef.current,
        getPosition: (row) => row.position,
        getFillColor: (row) => [row.color[0], row.color[1], row.color[2], glowAlpha] as Color,
        getRadius: 160,
        radiusMinPixels: glowMinPx,
        radiusMaxPixels: 24,
        filled: true,
        stroked: false,
      })

      const pointLayer = new ScatterplotLayer<RoutePointDatum>({
        id: 'km-v2-route-points',
        data: pointsRef.current,
        getPosition: (row) => row.position,
        getFillColor: (row) => [row.color[0], row.color[1], row.color[2], dotAlpha] as Color,
        getLineColor: [255, 255, 255, Math.round(80 + dotPulse * 80)] as Color,
        getRadius: 40,
        radiusMinPixels: dotMinPx,
        radiusMaxPixels: dotMinPx + 3,
        stroked: true,
        lineWidthMinPixels: 1,
      })

      overlay.setProps({ layers: [routeLayer, trailLayer, h3Layer, rippleLayer, arcLayer, bloomLayer, glowLayer, pointLayer] })
      animRafRef.current = requestAnimationFrame(tick)
    }

    animRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRafRef.current != null) {
        cancelAnimationFrame(animRafRef.current)
        animRafRef.current = null
      }
    }
  }, [state])

  // Pan-only recentering (user preference): never auto-zoom/fitBounds — just glide the map
  // to the active focus point (selected callcard pickup, or scenario origin) so changing the
  // ASP/region visibly moves the map to that area while preserving the current zoom level.
  useEffect(() => {
    if (state !== 'ready' || !mapRef.current || !focusPoint) return
    const key = `${focusPoint.lat.toFixed(5)},${focusPoint.lng.toFixed(5)}`
    if (key === lastCenterKeyRef.current) return
    lastCenterKeyRef.current = key
    const map = mapRef.current
    const target = { lat: focusPoint.lat, lng: focusPoint.lng }
    if (typeof map.panTo === 'function') map.panTo(target)
    else map.setCenter(target)
  }, [focusPoint, state])

  return { containerRef, state }
}

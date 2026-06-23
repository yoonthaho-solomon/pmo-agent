'use client'

import { useEffect, useRef, useState } from 'react'
import { GoogleMapsOverlay } from '@deck.gl/google-maps'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { H3HexagonLayer, TripsLayer } from '@deck.gl/geo-layers'
import type { Color, Position } from '@deck.gl/core'
import type { ScenarioPointInput } from '@/lib/adapters/matching'
import { normalizeH3Cell } from '@/lib/h3-dispatch'
import type { MatchingCandidateModel } from '@/lib/matching-studio-model'
import { loadGoogleMaps, type GoogleMapInstance } from '@/lib/google-maps/client-loader'
import { decodeEncodedPolyline } from '@/lib/google-maps/polyline'
import type { RouteSummary } from '@/lib/google-maps/route-types'

export type GoogleMapLoadState = 'loading' | 'ready' | 'missing_config' | 'load_error' | 'unsupported_webgl'

type H3LayerDatum = {
  hexagon: string
  type: 'call-origin' | 'call-destination' | 'driver-origin' | 'driver-destination'
}

type RoutePathDatum = { path: Position[] }
type RouteTripDatum = { path: Position[]; timestamps: number[] }
type RoutePointDatum = { position: Position; color: Color }

function supportsWebGL() {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
}

function pushH3(data: H3LayerDatum[], seen: Set<string>, cell: string | null | undefined, type: H3LayerDatum['type']) {
  const normalized = normalizeH3Cell(cell)
  if (!normalized || seen.has(`${type}:${normalized}`)) return
  seen.add(`${type}:${normalized}`)
  data.push({ hexagon: normalized, type })
}

function h3Data(candidate: MatchingCandidateModel | null): H3LayerDatum[] {
  const data: H3LayerDatum[] = []
  const seen = new Set<string>()
  for (const hexagon of candidate?.driver.prefOriginH3.slice(0, 10) ?? []) pushH3(data, seen, hexagon, 'driver-origin')
  for (const hexagon of candidate?.driver.prefDestinationH3.slice(0, 10) ?? []) pushH3(data, seen, hexagon, 'driver-destination')
  return data
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
          zoom: 12,
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
    h3DataRef.current = h3Data(candidate)
  }, [candidate])

  useEffect(() => {
    const pts: RoutePointDatum[] = []
    if (effectiveOrigin) pts.push({ position: [effectiveOrigin.lng, effectiveOrigin.lat] as Position, color: [239, 68, 68, 255] as Color })
    if (effectiveDestination) pts.push({ position: [effectiveDestination.lng, effectiveDestination.lat] as Position, color: [220, 38, 38, 255] as Color })
    pointsRef.current = pts
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
        getFillColor: (row) => {
          if (row.type === 'driver-origin') return [67, 214, 239, 55]
          return [124, 92, 255, 60]
        },
        getLineColor: () => [235, 249, 255, 90],
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
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

      overlay.setProps({ layers: [routeLayer, trailLayer, h3Layer, glowLayer, pointLayer] })
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

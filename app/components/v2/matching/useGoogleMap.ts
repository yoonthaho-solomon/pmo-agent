'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMapsOverlay } from '@deck.gl/google-maps'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { H3HexagonLayer } from '@deck.gl/geo-layers'
import type { Color, Position } from '@deck.gl/core'
import type { MatchingCallcardModel, MatchingCandidateModel } from '@/lib/matching-studio-model'
import { loadGoogleMaps, type GoogleMapInstance } from '@/lib/google-maps/client-loader'
import { decodeEncodedPolyline } from '@/lib/google-maps/polyline'
import type { RouteSummary } from '@/lib/google-maps/route-types'

export type GoogleMapLoadState = 'loading' | 'ready' | 'missing_config' | 'load_error' | 'unsupported_webgl'

type H3LayerDatum = {
  hexagon: string
  type: 'call-origin' | 'call-destination' | 'driver-origin' | 'driver-destination'
}

type RoutePathDatum = { path: Position[] }
type RoutePointDatum = { position: Position; color: Color }

function supportsWebGL() {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
}

function routeBounds(route: RouteSummary | null) {
  if (!route?.viewport) return null
  return {
    sw: { lat: route.viewport.low.latitude, lng: route.viewport.low.longitude },
    ne: { lat: route.viewport.high.latitude, lng: route.viewport.high.longitude },
  }
}

function h3Data(callcard: MatchingCallcardModel | null, candidate: MatchingCandidateModel | null): H3LayerDatum[] {
  const data: H3LayerDatum[] = []
  if (callcard?.route.pickup.h3Res7) data.push({ hexagon: callcard.route.pickup.h3Res7, type: 'call-origin' })
  if (callcard?.route.destination.h3Res7) data.push({ hexagon: callcard.route.destination.h3Res7, type: 'call-destination' })
  for (const hexagon of candidate?.driver.prefOriginH3.slice(0, 12) ?? []) data.push({ hexagon, type: 'driver-origin' })
  for (const hexagon of candidate?.driver.prefDestinationH3.slice(0, 12) ?? []) data.push({ hexagon, type: 'driver-destination' })
  return data
}

export function useGoogleMap({
  callcard,
  candidate,
  route,
}: {
  callcard: MatchingCallcardModel | null
  candidate: MatchingCandidateModel | null
  route: RouteSummary | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GoogleMapInstance | null>(null)
  const overlayRef = useRef<GoogleMapsOverlay | null>(null)
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
  const configMissing = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || !mapId
  const [state, setState] = useState<GoogleMapLoadState>(configMissing ? 'missing_config' : 'loading')

  const routePath = useMemo<Position[]>(() => {
    return decodeEncodedPolyline(route?.encodedPolyline).map((point) => [point.lng, point.lat] as Position)
  }, [route?.encodedPolyline])

  useEffect(() => {
    if (configMissing) return
    if (!containerRef.current) return

    if (!supportsWebGL()) {
      window.setTimeout(() => setState('unsupported_webgl'), 0)
      return
    }

    let cancelled = false
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return
        const initialCenter = callcard?.route.pickup.lat != null && callcard.route.pickup.lng != null
          ? { lat: callcard.route.pickup.lat, lng: callcard.route.pickup.lng }
          : { lat: 36.8151, lng: 127.1139 }
        const map = new google.maps.Map(containerRef.current, {
          center: initialCenter,
          zoom: 12,
          mapId,
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
  }, [callcard?.route.pickup.lat, callcard?.route.pickup.lng, configMissing, mapId])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || state !== 'ready') return

    const routeLayer = new PathLayer<RoutePathDatum>({
      id: 'km-v2-route-path',
      data: routePath.length ? [{ path: routePath }] : [],
      getPath: (row) => row.path,
      getColor: [67, 214, 239, 230],
      getWidth: 5,
      widthMinPixels: 3,
      rounded: true,
    })
    const h3Layer = new H3HexagonLayer<H3LayerDatum>({
      id: 'km-v2-h3-layer',
      data: h3Data(callcard, candidate),
      getHexagon: (row) => row.hexagon,
      getFillColor: (row) => {
        if (row.type === 'call-origin') return [67, 214, 239, 80]
        if (row.type === 'call-destination') return [124, 92, 255, 84]
        if (row.type === 'driver-origin') return [67, 214, 239, 38]
        return [124, 92, 255, 42]
      },
      getLineColor: [235, 249, 255, 150],
      lineWidthMinPixels: 1,
      filled: true,
      stroked: true,
      extruded: false,
    })
    const points: RoutePointDatum[] = []
    if (callcard?.route.pickup.lat != null && callcard.route.pickup.lng != null) {
      points.push({
        position: [callcard.route.pickup.lng, callcard.route.pickup.lat] as Position,
        color: [67, 214, 239, 230] as Color,
      })
    }
    if (callcard?.route.destination.lat != null && callcard.route.destination.lng != null) {
      points.push({
        position: [callcard.route.destination.lng, callcard.route.destination.lat] as Position,
        color: [85, 214, 154, 230] as Color,
      })
    }
    const pointLayer = new ScatterplotLayer<RoutePointDatum>({
      id: 'km-v2-route-points',
      data: points,
      getPosition: (row) => row.position,
      getFillColor: (row) => row.color,
      getLineColor: [6, 16, 24, 240],
      getRadius: 90,
      radiusMinPixels: 8,
      radiusMaxPixels: 15,
      stroked: true,
      lineWidthMinPixels: 2,
    })

    overlay.setProps({ layers: [routeLayer, h3Layer, pointLayer] })
  }, [callcard, candidate, routePath, state])

  useEffect(() => {
    if (state !== 'ready' || !mapRef.current) return
    loadGoogleMaps().then((google) => {
      const bounds = routeBounds(route)
      if (bounds) {
        mapRef.current?.fitBounds(new google.maps.LatLngBounds(bounds.sw, bounds.ne))
      } else if (callcard?.route.pickup.lat != null && callcard.route.pickup.lng != null) {
        mapRef.current?.setCenter({ lat: callcard.route.pickup.lat, lng: callcard.route.pickup.lng })
      }
    }).catch(() => undefined)
  }, [callcard?.route.pickup.lat, callcard?.route.pickup.lng, route, state])

  return { containerRef, state }
}


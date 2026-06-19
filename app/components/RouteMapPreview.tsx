'use client'

type LocationPoint = {
  lat: number | null | undefined
  lng: number | null | undefined
  h3Res7?: string | null | undefined
  roadAddress?: string | null | undefined
}

const C = {
  cyan: '#22D3EE',
  green: '#10B981',
  orange: '#FB923C',
  ink: '#F8FAFC',
  sub: '#B8C7DE',
  muted: '#8290A8',
  line: 'rgba(148, 163, 184, 0.22)',
}

function validPoint(point: LocationPoint | null | undefined): point is { lat: number; lng: number; h3Res7?: string | null; roadAddress?: string | null } {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
}

function formatKm(meter: number | null | undefined) {
  if (meter == null || !Number.isFinite(meter)) return '-'
  return meter >= 1000 ? `${(meter / 1000).toFixed(1)}km` : `${Math.round(meter)}m`
}

function formatEta(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return '-'
  if (seconds < 60) return `${Math.round(seconds)}초`
  return `${Math.round(seconds / 60)}분`
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371000
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function mapboxStaticUrl(pickup: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  if (!token) return null

  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { stroke: C.cyan, 'stroke-width': 4, 'stroke-opacity': 0.78 },
        geometry: { type: 'LineString', coordinates: [[pickup.lng, pickup.lat], [destination.lng, destination.lat]] },
      },
    ],
  }
  const overlay = [
    `geojson(${encodeURIComponent(JSON.stringify(geojson))})`,
    `pin-l-a+22D3EE(${pickup.lng},${pickup.lat})`,
    `pin-l-b+10B981(${destination.lng},${destination.lat})`,
  ].join(',')

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}/auto/920x420@2x?padding=70,80,70,80&access_token=${encodeURIComponent(token)}`
}

export function RouteMapPreview({
  pickup,
  destination,
  expectedDistanceMeters,
  etaSeconds,
  title = '출발·도착 경로 프리뷰',
  compact = false,
}: {
  pickup: LocationPoint | null | undefined
  destination: LocationPoint | null | undefined
  expectedDistanceMeters?: number | null
  etaSeconds?: number | null
  title?: string
  compact?: boolean
}) {
  const hasRoute = validPoint(pickup) && validPoint(destination)
  const staticUrl = hasRoute ? mapboxStaticUrl(pickup, destination) : null
  const straightDistance = hasRoute ? haversineMeters(pickup, destination) : null
  const distanceRatio = straightDistance && expectedDistanceMeters
    ? Math.max(0.1, Math.min(2.4, expectedDistanceMeters / straightDistance))
    : null

  return (
    <section className={compact ? 'route-map compact' : 'route-map'}>
      <div className="map-head">
        <div>
          <span>MAPBOX ROUTE</span>
          <h3>{title}</h3>
        </div>
        <b>{staticUrl ? 'Mapbox' : 'Preview'}</b>
      </div>

      <div className="map-canvas">
        {staticUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staticUrl} alt="Mapbox route preview" />
        ) : (
          <div className="fallback-map" aria-label="Route preview fallback">
            <i className="route-line" />
            <span className="pin pickup">A</span>
            <span className="pin dest">B</span>
            <em className="pulse one" />
            <em className="pulse two" />
          </div>
        )}
        <div className="map-overlay">
          <strong>{formatKm(expectedDistanceMeters)}</strong>
          <span>콜카드 예상거리</span>
          <strong>{formatEta(etaSeconds)}</strong>
          <span>승객 탑승 ETA</span>
        </div>
      </div>

      <div className="route-facts">
        <div><span>출발 H3</span><b>{pickup?.h3Res7 ?? '-'}</b></div>
        <div><span>도착 H3</span><b>{destination?.h3Res7 ?? '-'}</b></div>
        <div><span>직선거리</span><b>{formatKm(straightDistance)}</b></div>
        <div><span>예상/직선</span><b>{distanceRatio == null ? '-' : `${distanceRatio.toFixed(1)}x`}</b></div>
      </div>

      <p className="map-note">
        Mapbox는 출발·도착 좌표와 H3를 시각화합니다. 현재 거리와 ETA는 콜카드 원본 예상값이며, 도로 ETA API 계산값은 아직 연결하지 않았습니다.
      </p>

      <style jsx>{`
        .route-map {
          min-width: 0;
          border: 1px solid ${C.line};
          border-radius: 24px;
          background: radial-gradient(circle at 18% 10%, rgba(34,211,238,.14), transparent 18rem), linear-gradient(180deg, rgba(15,23,42,.86), rgba(5,8,16,.92));
          padding: 20px;
          box-shadow: 0 24px 72px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.04);
        }
        .route-map.compact { padding: 18px; }
        .map-head { display: flex; justify-content: space-between; gap: 18px; align-items: start; margin-bottom: 16px; }
        .map-head span { color: ${C.cyan}; font-size: var(--pmo-fs-caption, 18px); font-weight: 950; }
        .map-head h3 { margin: 5px 0 0; color: ${C.ink}; font-size: var(--pmo-fs-section, 32px); line-height: 1.12; }
        .map-head b { border: 1px solid rgba(34,211,238,.38); border-radius: 999px; color: ${C.cyan}; background: rgba(34,211,238,.1); padding: 8px 12px; font-size: var(--pmo-fs-caption, 18px); }
        .map-canvas { position: relative; min-height: ${compact ? '260px' : '340px'}; overflow: hidden; border: 1px solid rgba(148,163,184,.22); border-radius: 20px; background: #06101F; }
        .map-canvas img { width: 100%; height: 100%; min-height: inherit; object-fit: cover; display: block; filter: saturate(1.08) contrast(1.06); }
        .fallback-map { position: absolute; inset: 0; background: radial-gradient(circle at 28% 34%, rgba(34,211,238,.22), transparent 18rem), radial-gradient(circle at 72% 64%, rgba(16,185,129,.18), transparent 18rem), linear-gradient(90deg, rgba(148,163,184,.08) 1px, transparent 1px), linear-gradient(180deg, rgba(148,163,184,.07) 1px, transparent 1px), #07101F; background-size: auto, auto, 54px 54px, 54px 54px, auto; }
        .route-line { position: absolute; left: 18%; right: 18%; top: 53%; height: 8px; border-radius: 999px; background: linear-gradient(90deg, ${C.cyan}, ${C.green}); box-shadow: 0 0 28px rgba(34,211,238,.46); transform: rotate(-12deg); }
        .pin { position: absolute; width: 58px; height: 58px; display: grid; place-items: center; border-radius: 18px; color: #06101F; font-size: 28px; font-weight: 950; box-shadow: 0 0 28px rgba(34,211,238,.38); }
        .pickup { left: 16%; top: 45%; background: ${C.cyan}; }
        .dest { right: 16%; top: 35%; background: ${C.green}; }
        .pulse { position: absolute; width: 130px; height: 130px; border: 1px solid rgba(34,211,238,.28); border-radius: 999px; animation: pulse 2.4s ease-in-out infinite; }
        .pulse.one { left: 10%; top: 36%; }
        .pulse.two { right: 10%; top: 25%; border-color: rgba(16,185,129,.32); animation-delay: .7s; }
        @keyframes pulse { 0%, 100% { transform: scale(.78); opacity: .32; } 50% { transform: scale(1.08); opacity: .82; } }
        .map-overlay { position: absolute; left: 18px; bottom: 18px; display: grid; grid-template-columns: auto auto; gap: 4px 12px; align-items: baseline; border: 1px solid rgba(255,255,255,.14); border-radius: 18px; background: rgba(5,8,16,.78); backdrop-filter: blur(14px); padding: 14px 16px; }
        .map-overlay strong { color: ${C.ink}; font-size: 28px; line-height: 1; }
        .map-overlay span { color: ${C.sub}; font-size: 18px; font-weight: 850; }
        .route-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
        .route-facts div { min-width: 0; border: 1px solid rgba(148,163,184,.18); border-radius: 16px; background: rgba(15,23,42,.62); padding: 12px; }
        .route-facts span { display: block; color: ${C.muted}; font-size: 18px; font-weight: 900; }
        .route-facts b { display: block; margin-top: 5px; color: ${C.ink}; font-size: 20px; line-height: 1.22; overflow-wrap: anywhere; }
        .map-note { margin: 14px 0 0; color: ${C.sub}; font-size: 19px; line-height: 1.45; font-weight: 760; }
        @media (max-width: 980px) { .route-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .map-canvas { min-height: 260px; } }
      `}</style>
    </section>
  )
}
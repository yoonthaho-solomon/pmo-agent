'use client'

type LocationPoint = {
  lat: number | null | undefined
  lng: number | null | undefined
  h3Res7?: string | null | undefined
  roadAddress?: string | null | undefined
}

const C = {
  cyan: '#38bdf8',
  green: '#3fb950',
  ink: '#e7ebf2',
  sub: '#9aa6b8',
  muted: '#6a7688',
  line: 'rgba(255, 255, 255, 0.07)',
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
    `pin-l-a+38BDF8(${pickup.lng},${pickup.lat})`,
    `pin-l-b+3FB950(${destination.lng},${destination.lat})`,
  ].join(',')

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}/auto/920x420@2x?padding=70,80,70,80&access_token=${encodeURIComponent(token)}`
}

export function RouteMapPreview({
  pickup,
  destination,
  expectedDistanceMeters,
  etaSeconds,
  title = '출발지·도착지 경로 프리뷰',
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
          <span>ROUTE CONTEXT</span>
          <h3>{title}</h3>
        </div>
        <b>{staticUrl ? 'Mapbox' : 'Preview'}</b>
      </div>

      <div className="map-canvas">
        {staticUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staticUrl} alt="출발지와 도착지 경로 프리뷰" />
        ) : (
          <div className="fallback-map" aria-label="경로 프리뷰">
            <i className="route-line" />
            <span className="pin pickup">A</span>
            <span className="pin dest">B</span>
            <em className="pulse one" />
            <em className="pulse two" />
          </div>
        )}
        <div className="map-overlay">
          <strong>{formatKm(expectedDistanceMeters)}</strong>
          <span>예상 운행거리</span>
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
        Mapbox 토큰이 있으면 출발지와 도착지 좌표를 지도 위에 표시합니다. 현재 거리와 ETA는 콜카드 원본 예상값이며, 도로 ETA API 계산값은 아직 연결하지 않았습니다.
      </p>

      <style jsx>{`
        .route-map {
          min-width: 0;
          border: 1px solid ${C.line};
          border-radius: 18px;
          background: var(--bg-1);
          padding: clamp(16px, 1.6vw, 22px);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
        }
        .route-map.compact {
          padding: 16px;
        }
        .map-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: start;
          margin-bottom: 14px;
        }
        .map-head span {
          color: ${C.cyan};
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .map-head h3 {
          margin: 6px 0 0;
          color: ${C.ink};
          font-size: 21px;
          line-height: 1.2;
          font-weight: 850;
          letter-spacing: -0.03em;
        }
        .map-head b {
          border: 1px solid ${C.line};
          border-radius: 999px;
          color: ${C.sub};
          background: rgba(255, 255, 255, 0.04);
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 800;
        }
        .map-canvas {
          position: relative;
          min-height: ${compact ? '240px' : '320px'};
          overflow: hidden;
          border: 1px solid ${C.line};
          border-radius: 14px;
          background: #06090f;
        }
        .map-canvas img {
          width: 100%;
          height: 100%;
          min-height: inherit;
          object-fit: cover;
          display: block;
        }
        .fallback-map {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
            radial-gradient(circle at 28% 34%, rgba(56,189,248,.14), transparent 18rem),
            radial-gradient(circle at 72% 64%, rgba(63,185,80,.12), transparent 18rem),
            #06090f;
          background-size: 40px 40px, 40px 40px, auto, auto, auto;
        }
        .route-line {
          position: absolute;
          left: 18%;
          right: 18%;
          top: 53%;
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, ${C.cyan}, ${C.green});
          transform: rotate(-12deg);
          box-shadow: 0 0 28px rgba(56, 189, 248, 0.28);
        }
        .pin {
          position: absolute;
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: #04141f;
          font-size: 18px;
          font-weight: 900;
        }
        .pickup {
          left: 16%;
          top: 45%;
          background: ${C.cyan};
        }
        .dest {
          right: 16%;
          top: 35%;
          background: ${C.green};
        }
        .pulse {
          position: absolute;
          width: 120px;
          height: 120px;
          border: 1px solid rgba(56, 189, 248, 0.24);
          border-radius: 999px;
          animation: pulse 2.6s ease-in-out infinite;
        }
        .pulse.one {
          left: 10%;
          top: 36%;
        }
        .pulse.two {
          right: 10%;
          top: 25%;
          border-color: rgba(63, 185, 80, 0.24);
          animation-delay: 0.8s;
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.7;
          }
        }
        .map-overlay {
          position: absolute;
          left: 14px;
          bottom: 14px;
          display: grid;
          grid-template-columns: auto auto;
          gap: 4px 12px;
          align-items: baseline;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          background: rgba(6, 9, 15, 0.84);
          backdrop-filter: blur(10px);
          padding: 12px 14px;
        }
        .map-overlay strong {
          color: ${C.ink};
          font-size: 20px;
          line-height: 1;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .map-overlay span {
          color: ${C.sub};
          font-size: 12px;
          font-weight: 650;
        }
        .route-facts {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }
        .route-facts div {
          min-width: 0;
          border: 1px solid ${C.line};
          border-radius: 12px;
          background: var(--bg-2);
          padding: 12px;
        }
        .route-facts span {
          display: block;
          color: ${C.muted};
          font-size: 12px;
          font-weight: 800;
        }
        .route-facts b {
          display: block;
          margin-top: 6px;
          color: ${C.ink};
          font-size: 14px;
          line-height: 1.25;
          font-weight: 800;
          overflow-wrap: anywhere;
          font-family: var(--ff-mono);
        }
        .map-note {
          margin: 12px 0 0;
          color: ${C.sub};
          font-size: 14px;
          line-height: 1.5;
          font-weight: 550;
        }
        @media (max-width: 980px) {
          .route-facts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .map-canvas {
            min-height: 240px;
          }
        }
      `}</style>
    </section>
  )
}

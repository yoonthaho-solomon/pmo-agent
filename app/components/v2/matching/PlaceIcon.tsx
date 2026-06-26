type PlaceIconKind = 'train' | 'bus' | 'airport' | 'store' | 'food' | 'road' | 'pin'

// Map Google place types to a small, scannable icon set. Korean POI results are
// dominated by stations (역), bus stops, shops/marts (상가/마트), and street/dong
// addresses, so we cover those and fall back to a generic pin.
export function placeIconKind(types: string[]): PlaceIconKind {
  const set = new Set(types)
  if (set.has('train_station') || set.has('subway_station') || set.has('transit_station') || set.has('light_rail_station')) return 'train'
  if (set.has('bus_station') || set.has('bus_stop')) return 'bus'
  if (set.has('airport')) return 'airport'
  if (
    set.has('store') || set.has('shopping_mall') || set.has('supermarket') ||
    set.has('department_store') || set.has('convenience_store') || set.has('market')
  ) return 'store'
  if (set.has('restaurant') || set.has('cafe') || set.has('food') || set.has('bakery') || set.has('meal_takeaway')) return 'food'
  if (set.has('route')) return 'road'
  return 'pin'
}

export function PlaceIcon({ types, className }: { types: string[]; className?: string }) {
  const kind = placeIconKind(types)
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }
  switch (kind) {
    case 'train':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="13" rx="3" />
          <path d="M5 11h14" />
          <circle cx="8.5" cy="14" r="0.6" fill="currentColor" />
          <circle cx="15.5" cy="14" r="0.6" fill="currentColor" />
          <path d="M8 20l-1.5 1.5M16 20l1.5 1.5" />
        </svg>
      )
    case 'bus':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="13" rx="2" />
          <path d="M5 12h14" />
          <circle cx="8" cy="15" r="0.6" fill="currentColor" />
          <circle cx="16" cy="15" r="0.6" fill="currentColor" />
          <path d="M7 17v2M17 17v2" />
        </svg>
      )
    case 'airport':
      return (
        <svg {...common}>
          <path d="M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7 4v2l-7-2v4l2 1.5V20l-3.5-1L8 20v-1.5L10 17v-4l-7 2v-2l7-4z" />
        </svg>
      )
    case 'store':
      return (
        <svg {...common}>
          <path d="M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16M9 19v-5h6v5" />
        </svg>
      )
    case 'food':
      return (
        <svg {...common}>
          <path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9" />
        </svg>
      )
    case 'road':
      return (
        <svg {...common}>
          <path d="M6 21L9 3M18 21L15 3M12 6v2M12 11v2M12 16v2" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      )
  }
}

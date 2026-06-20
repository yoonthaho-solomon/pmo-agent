export type IngestionStatus = 'healthy' | 'partial' | 'missing' | 'pending'

export type RawTableStatus = {
  table: string
  label: string
  count: number | null
  minDate: string | null
  maxDate: string | null
  status?: 'ok' | 'empty' | 'error'
  importance?: 'core' | 'optional'
  error?: string
}

export type RawDateRow = {
  date: string
  callcards: number | null
  driverLogs: number | null
  matches: number | null
}

export type SystemStatusResponse = {
  ok?: boolean
  source?: string
  message?: string
  env?: Record<string, boolean>
  callTables?: RawTableStatus[]
  meterTables?: RawTableStatus[]
  vectorTables?: RawTableStatus[]
  dateRows?: RawDateRow[]
  error?: string
}

export type DataSourceId = 'all' | 'call' | 'meter' | 'driver' | 'matching'

export type SourceCard = {
  id: DataSourceId
  title: string
  status: IngestionStatus
  dateRange: string
  countLabel: string
  description: string
}

export type MatrixRow = {
  id: string
  title: string
  table: string
  sourceId: DataSourceId
}

export type MatrixCell = {
  id: string
  rowId: string
  sourceId: DataSourceId
  date: string
  status: IngestionStatus
  count: number | null
  table: string
  reason: string
}

export type CatalogItem = {
  id: string
  title: string
  group: string
  description: string
  fields: string[]
  tables: string[]
  status: 'available' | 'partial' | 'unavailable'
  availability: number | null
}

export type IngestionViewModel = {
  ok: boolean
  source: string
  period: string
  dates: string[]
  sources: SourceCard[]
  rows: MatrixRow[]
  cells: MatrixCell[]
  catalog: CatalogItem[]
  kpis: {
    loadedDays: number | null
    missingDays: number | null
    coreTablesReady: number
    coreTablesTotal: number
    latestDate: string | null
  }
  error: string | null
}

const MATRIX_ROWS: MatrixRow[] = [
  { id: 'callcards', title: 'Call cards', table: 'callcard_mbti', sourceId: 'call' },
  { id: 'driverLogs', title: 'Driver logs', table: 'driver_daily_logs', sourceId: 'driver' },
  { id: 'matches', title: 'Top 10 matches', table: 'matching_scores', sourceId: 'matching' },
  { id: 'meterHourly', title: 'Meter hourly', table: 'meter_hourly_logs', sourceId: 'meter' },
  { id: 'meterDrivers', title: 'Meter drivers', table: 'meter_driver_logs', sourceId: 'meter' },
]

const CATALOG: Array<Omit<CatalogItem, 'status' | 'availability'>> = [
  {
    id: 'route-space',
    group: 'Call card',
    title: 'Origin and destination',
    description: 'Pickup address, destination address, coordinates, H3 origin cell, H3 destination cell, and OD route key.',
    fields: ['passenger_addr', 'dest_addr', 'passenger_lat', 'passenger_lng', 'dest_lat', 'dest_lng', 's_hexagon', 'd_hexagon'],
    tables: ['callcard_mbti'],
  },
  {
    id: 'trip-terms',
    group: 'Call card',
    title: 'Trip terms',
    description: 'Expected fare, expected distance, pickup ETA, paid call, and product conditions used to build call factors.',
    fields: ['expected_fare_amt', 'expected_distance', 'eta', 'call_fee', 'payment_method'],
    tables: ['callcard_mbti'],
  },
  {
    id: 'time-demand',
    group: 'Demand',
    title: 'Day and time pattern',
    description: 'Service date, weekday, request time, allocation time, and cancellation/drop states.',
    fields: ['service_date', 'request_datetime', 'alloc_datetime', 'cancel_datetime', 'drop_datetime', 'status'],
    tables: ['callcard_mbti'],
  },
  {
    id: 'driver-pattern',
    group: 'Driver',
    title: 'Driver behavior pattern',
    description: 'Accepted calls are aggregated into driver logs and converted into driver 22D preference vectors.',
    fields: ['driver_id', 'vehicle_id', 'driver_daily_logs', 'driver_mbti'],
    tables: ['driver_daily_logs', 'driver_mbti'],
  },
  {
    id: 'meter-market',
    group: 'Meter',
    title: 'Meter market baseline',
    description: 'Cheonan taxi market flow, hourly demand, driver activity, and fare movement used as reference data.',
    fields: ['meter_hourly_logs', 'meter_driver_logs'],
    tables: ['meter_hourly_logs', 'meter_driver_logs'],
  },
  {
    id: 'matching-result',
    group: 'Matching',
    title: 'Similarity match result',
    description: 'Call vectors and driver vectors are compared, then Top 10 recommendation rows are stored.',
    fields: ['callcard_id', 'driver_id', 'similarity_score', 'final_score'],
    tables: ['matching_scores'],
  },
]

function onlyDate(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null
}

function formatNumber(value: number | null | undefined): string {
  return value == null ? '-' : value.toLocaleString('ko-KR')
}

function formatRange(minDate: string | null, maxDate: string | null): string {
  const min = onlyDate(minDate)
  const max = onlyDate(maxDate)
  if (!min || !max) return '-'
  return `${min} ~ ${max}`
}

function tableStatus(table: RawTableStatus | null): IngestionStatus {
  if (!table) return 'pending'
  if (table.status === 'error') return table.importance === 'optional' ? 'partial' : 'missing'
  if (!table.count) return 'missing'
  return 'healthy'
}

function getTables(raw: SystemStatusResponse): RawTableStatus[] {
  return [
    ...(raw.callTables ?? []),
    ...(raw.meterTables ?? []),
    ...(raw.vectorTables ?? []),
  ]
}

function findTable(raw: SystemStatusResponse, table: string): RawTableStatus | null {
  return getTables(raw).find((row) => row.table === table) ?? null
}

function sourceCard(id: DataSourceId, title: string, tables: RawTableStatus[], description: string): SourceCard {
  const count = tables.reduce((sum, row) => sum + (row.count ?? 0), 0)
  const statuses = tables.map(tableStatus)
  const status = statuses.includes('missing')
    ? 'missing'
    : statuses.includes('partial')
      ? 'partial'
      : statuses.includes('pending')
        ? 'pending'
        : 'healthy'
  const minDate = tables.map((row) => onlyDate(row.minDate)).filter(Boolean).sort()[0] ?? null
  const maxDate = tables.map((row) => onlyDate(row.maxDate)).filter(Boolean).sort().at(-1) ?? null
  return {
    id,
    title,
    status,
    dateRange: formatRange(minDate, maxDate),
    countLabel: formatNumber(count),
    description,
  }
}

function buildDates(raw: SystemStatusResponse): string[] {
  return [...new Set((raw.dateRows ?? []).map((row) => onlyDate(row.date)).filter(Boolean) as string[])]
    .sort((a, b) => a.localeCompare(b))
}

function dateRowCount(rowId: string, dateRow: RawDateRow | undefined): number | null {
  if (!dateRow) return null
  if (rowId === 'callcards') return dateRow.callcards
  if (rowId === 'driverLogs') return dateRow.driverLogs
  if (rowId === 'matches') return dateRow.matches
  return null
}

function cellStatus(row: MatrixRow, count: number | null, table: RawTableStatus | null): IngestionStatus {
  if (!table) return 'pending'
  if (table.status === 'error') return table.importance === 'optional' ? 'partial' : 'missing'
  if (row.sourceId === 'meter') return tableStatus(table)
  if (count == null) return 'pending'
  if (count <= 0) return 'missing'
  return 'healthy'
}

function availability(raw: SystemStatusResponse, tables: string[]): { value: number | null; status: CatalogItem['status'] } {
  const resolved = tables.map((table) => findTable(raw, table)).filter(Boolean) as RawTableStatus[]
  if (resolved.length === 0) return { value: null, status: 'unavailable' }
  const available = resolved.filter((row) => tableStatus(row) === 'healthy').length
  const value = Math.round((available / resolved.length) * 100)
  return {
    value,
    status: value === 100 ? 'available' : value > 0 ? 'partial' : 'unavailable',
  }
}

export function adaptIngestionSummary(raw: SystemStatusResponse): IngestionViewModel {
  const allTables = getTables(raw)
  const dates = buildDates(raw)
  const dateRows = new Map((raw.dateRows ?? []).map((row) => [onlyDate(row.date), row]))

  const callTables = allTables.filter((row) => row.table === 'callcard_mbti')
  const driverTables = allTables.filter((row) => row.table === 'driver_daily_logs')
  const matchingTables = allTables.filter((row) => row.table === 'matching_scores')
  const meterTables = raw.meterTables ?? []

  const cells = MATRIX_ROWS.flatMap((row) => dates.map((date) => {
    const table = findTable(raw, row.table)
    const count = dateRowCount(row.id, dateRows.get(date))
    const status = cellStatus(row, count, table)
    return {
      id: `${row.id}:${date}`,
      rowId: row.id,
      sourceId: row.sourceId,
      date,
      status,
      count,
      table: row.table,
      reason: row.sourceId === 'meter'
        ? 'Meter tables are available at table level. Daily matrix counts need a later API extension.'
        : status === 'healthy'
          ? 'Loaded and connected for this date.'
          : 'No daily count was returned for this date.',
    }
  }))

  const dayStatuses = dates.map((date) => {
    const dateCells = cells.filter((cell) => cell.date === date && cell.sourceId !== 'meter')
    if (dateCells.length === 0) return 'pending'
    if (dateCells.some((cell) => cell.status === 'missing')) return 'missing'
    if (dateCells.some((cell) => cell.status === 'partial')) return 'partial'
    if (dateCells.some((cell) => cell.status === 'pending')) return 'pending'
    return 'healthy'
  })

  const catalog = CATALOG.map((item) => {
    const score = availability(raw, item.tables)
    return {
      ...item,
      availability: score.value,
      status: score.status,
    }
  })

  const minDate = dates[0] ?? onlyDate(findTable(raw, 'callcard_mbti')?.minDate)
  const maxDate = dates.at(-1) ?? onlyDate(findTable(raw, 'callcard_mbti')?.maxDate)
  const coreTables = ['callcard_mbti', 'driver_daily_logs', 'matching_scores', 'driver_mbti']
  const readyCoreTables = coreTables.filter((table) => tableStatus(findTable(raw, table)) === 'healthy').length
  const coreError = allTables.find((row) => row.status === 'error' && row.importance !== 'optional')

  return {
    ok: Boolean(raw.ok) && !coreError,
    source: raw.source ?? 'unknown',
    period: formatRange(minDate, maxDate),
    dates,
    sources: [
      sourceCard('all', 'All data', [...callTables, ...driverTables, ...matchingTables, ...meterTables], 'Overall readiness across call, meter, driver, and match tables.'),
      sourceCard('call', 'Call data', callTables, 'Passenger request, route, fare, product, and call outcome records.'),
      sourceCard('meter', 'Meter data', meterTables, 'Market baseline from meter hourly and driver activity logs.'),
      sourceCard('driver', 'Driver logs', driverTables, 'Accepted call history used to build driver behavior vectors.'),
      sourceCard('matching', 'Match results', matchingTables, 'Stored Top 10 recommendation rows for call-driver matching.'),
    ],
    rows: MATRIX_ROWS,
    cells,
    catalog,
    kpis: {
      loadedDays: dates.length ? dayStatuses.filter((status) => status === 'healthy').length : null,
      missingDays: dates.length ? dayStatuses.filter((status) => status === 'missing').length : null,
      coreTablesReady: readyCoreTables,
      coreTablesTotal: coreTables.length,
      latestDate: maxDate,
    },
    error: raw.error ?? coreError?.error ?? null,
  }
}

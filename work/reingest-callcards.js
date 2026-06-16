const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] == null) process.env[match[1]] = value;
  }
}

loadEnv('.env.local');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SOURCE_FIELD_COLUMNS = [
  'status',
  'status_group',
  'passenger_id',
  'payment_method',
  'passenger_addr',
  'dest_addr',
  'passenger_lat',
  'passenger_lng',
  'dest_lat',
  'dest_lng',
  'request_datetime',
  'alloc_datetime',
  'cancel_datetime',
  'pickup_datetime',
  'drop_datetime',
  'call_fee',
];

function field(row, ...keys) {
  if (!row) return undefined;
  for (const key of keys) {
    if (row[key] != null) return row[key];
  }
  return undefined;
}

function nullableText(raw) {
  if (raw == null) return null;
  const value = String(raw).trim();
  return value ? value : null;
}

function nullableNumber(raw) {
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function sourceIdentifier(raw) {
  const value = nullableText(raw);
  if (!value) return null;
  return ['NONE', 'NULL', 'N/A', 'NA', '-'].includes(value.toUpperCase()) ? null : value;
}

function jsWeekdayToMon0(jsDay) {
  return (jsDay + 6) % 7;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseLocalDatetime(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw);
    if (!date) return null;
    return {
      year: date.y,
      month: date.m,
      day: date.d,
      hour: date.H,
      minute: date.M,
      second: date.S,
      date: `${date.y}-${pad2(date.m)}-${pad2(date.d)}`,
      weekday: jsWeekdayToMon0(new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay()),
    };
  }
  const value = String(raw).trim();
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    weekday: jsWeekdayToMon0(new Date(Date.UTC(year, month - 1, day)).getUTCDay()),
  };
}


function parseServiceDate(raw) {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim().replace(/-/g, '');
  const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return {
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    weekday: jsWeekdayToMon0(new Date(Date.UTC(year, month - 1, day)).getUTCDay()),
  };
}
function localTimestamp(raw) {
  const parsed = parseLocalDatetime(raw);
  return parsed ? `${parsed.date}T${pad2(parsed.hour)}:${pad2(parsed.minute)}:${pad2(parsed.second)}+09:00` : null;
}

function statusGroup(status) {
  if (!status) return null;
  if (['FINISHED', 'FINISH', 'DROP', 'ACCEPTED'].includes(status)) return 'accepted';
  if (status === 'EXPIRED') return 'expired';
  if (['CANCELED', 'D_CANCELED', 'SYS_CANCELED', 'CC_CANCELED'].includes(status)) return 'canceled';
  if (status === 'PICKUP') return 'pickup';
  return 'other';
}

function callcardId(row) {
  return String(field(row, 'call_id', 'CALL_ID') ?? '').trim();
}

function readRows(file) {
  const workbook = XLSX.readFile(file);
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
}

function buildRecord(row, remapped) {
  const id = callcardId(row);
  if (!id) return null;

  const requestDatetime = field(row, 'request_datetime', 'REQUEST_DATETIME');
  const parsedRequest = parseLocalDatetime(requestDatetime);
  const serviceDate = parseServiceDate(field(row, 'service_date', 'SERVICE_DATE'));
  const status = nullableText(field(row, 'status', 'STATUS') ?? field(remapped, 'status', 'STATUS'))?.toUpperCase() ?? null;
  const callFee = nullableNumber(field(row, 'call_fee', 'CALL_FEE'));
  const etaRaw = field(row, 'accept_eta', 'ACCEPTED_TAXI_ETA');
  const eta = etaRaw != null && etaRaw !== '' ? Number(etaRaw) : null;

  return {
    callcard_id: id,
    asp_id: Number(field(row, 'asp_id', 'ASP_ID') ?? 0),
    call_date: serviceDate?.date ?? parsedRequest?.date ?? '',
    hour_slot: parsedRequest ? parsedRequest.hour : 0,
    weekday: serviceDate?.weekday ?? parsedRequest?.weekday ?? 0,
    s_area: nullableText(field(row, 's_area', 'S_AREA')),
    s_hexagon: String(field(row, 'passenger_hexagon_id', 'PASSENGER_HEXAGON_ID') ?? field(remapped, 'passenger_hexagon_id', 'PASSENGER_HEXAGON_ID') ?? '').trim(),
    d_area: nullableText(field(row, 'd_area', 'D_AREA')),
    d_hexagon: String(field(row, 'dest_hexagon_id', 'DEST_HEXAGON_ID') ?? field(remapped, 'dest_hexagon_id', 'DEST_HEXAGON_ID') ?? '').trim(),
    expected_distance: Number(field(row, 'expected_distance', 'EXPECTED_DISTANCE') ?? 0),
    expected_fare: Number(field(row, 'expected_fare_amt', 'EXPECTED_FARE_AMT') ?? 0),
    is_paid: Number(callFee ?? 0) > 0,
    eta_distance: eta != null && eta > 0 ? eta : null,
    product_type: String(field(row, 'service_info_name', 'SERVICE_INFO_NAME') ?? field(remapped, 'service_info_name', 'SERVICE_INFO_NAME') ?? '').trim(),
    is_surge: Number(field(row, 'surge_price_A', 'SURGE_PRICE_A', 'SURGE_PRICE') ?? field(remapped, 'surge_price_A', 'SURGE_PRICE_A', 'SURGE_PRICE') ?? 0) > 0,
    urgency_score: 0,
    status,
    status_group: statusGroup(status),
    passenger_id: nullableText(field(row, 'passenger_id', 'PASSENGER_ID')),
    payment_method: nullableText(field(row, 'payment_method', 'PAYMENT_METHOD')),
    passenger_addr: nullableText(field(row, 'passenger_addr', 'PASSENGER_ADDR')),
    dest_addr: nullableText(field(row, 'dest_addr', 'DEST_ADDR')),
    passenger_lat: nullableNumber(field(row, 'dec_enc_passenger_latitude', 'DEC_ENC_PASSENGER_LATITUDE')),
    passenger_lng: nullableNumber(field(row, 'dec_enc_passenger_longitude', 'DEC_ENC_PASSENGER_LONGITUDE')),
    dest_lat: nullableNumber(field(row, 'dec_enc_dest_latitude', 'DEC_ENC_DEST_LATITUDE')),
    dest_lng: nullableNumber(field(row, 'dec_enc_dest_longitude', 'DEC_ENC_DEST_LONGITUDE')),
    request_datetime: localTimestamp(requestDatetime),
    alloc_datetime: localTimestamp(field(row, 'alloc_datetime', 'ALLOC_DATETIME')),
    cancel_datetime: localTimestamp(field(row, 'cancel_datetime', 'CANCEL_DATETIME')),
    pickup_datetime: localTimestamp(field(row, 'pickup_datetime', 'PICKUP_DATETIME')),
    drop_datetime: localTimestamp(field(row, 'drop_datetime', 'DROP_DATETIME')),
    call_fee: callFee,
    driver_id: sourceIdentifier(field(row, 'driver_id', 'DRIVER_ID')),
    vehicle_id: sourceIdentifier(field(row, 'vehicle_id', 'VEHICLE_ID')),
  };
}

async function main() {
  const root = 'C:\\Users\\pgman\\OneDrive\\바탕 화면\\호출데이터';
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}_call_data$/.test(entry.name))
    .map((entry) => path.join(root, entry.name))
    .sort();

  const available = new Set();
  for (const column of SOURCE_FIELD_COLUMNS) {
    const { error } = await supabase.from('callcard_mbti').select(column).limit(1);
    if (!error) available.add(column);
  }

  console.log(`source_columns=${available.size}/${SOURCE_FIELD_COLUMNS.length}`);

  let total = 0;
  for (const dir of dirs) {
    const date = path.basename(dir).slice(0, 8);
    const callcardFile = path.join(dir, `${date}_RAW_DATA_callcard_eta.xlsx`);
    const remappedFile = path.join(dir, `${date}_RAW_DATA_remapped.xlsx`);

    if (!fs.existsSync(callcardFile) || !fs.existsSync(remappedFile)) {
      console.log(`${date} skipped missing_pair`);
      continue;
    }

    const callcardRows = readRows(callcardFile);
    const remappedRows = readRows(remappedFile);
    const remappedById = new Map();
    for (const row of remappedRows) {
      const id = callcardId(row);
      if (id) remappedById.set(id, row);
    }

    const records = callcardRows
      .map((row) => buildRecord(row, remappedById.get(callcardId(row))))
      .filter(Boolean);

    const statusCounts = records.reduce((acc, row) => {
      const key = row.status_group || 'null';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    for (let i = 0; i < records.length; i += 500) {
      const chunk = records.slice(i, i + 500);
      const { error } = await supabase.from('callcard_mbti').upsert(chunk, { onConflict: 'callcard_id' });
      if (error) throw new Error(`${date} batch ${i}: ${error.message}`);
    }

    total += records.length;
    console.log(`${date} upserted=${records.length} status_groups=${JSON.stringify(statusCounts)}`);
  }

  console.log(`done total=${total}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});





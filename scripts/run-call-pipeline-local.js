const fs = require('fs')
const path = require('path')

const DEFAULT_ROOT = 'C:\\Users\\pgman\\OneDrive\\바탕 화면\\호출데이터'
const DEFAULT_BASE_URL = 'http://localhost:3133'

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

function hasArg(name) {
  return process.argv.includes(`--${name}`)
}

function ymdToDate(ymd) {
  const match = String(ymd).match(/^(\d{4})(\d{2})(\d{2})$/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

function normalizeDateArg(value) {
  if (!value) return null
  const compact = String(value).replace(/-/g, '')
  return /^\d{8}$/.test(compact) ? compact : null
}

function discoverDateDirs(root, from, to, onlyDate) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}_call_data$/.test(entry.name))
    .map((entry) => {
      const date = entry.name.slice(0, 8)
      return { date, dir: path.join(root, entry.name) }
    })
    .filter((item) => !onlyDate || item.date === onlyDate)
    .filter((item) => !from || item.date >= from)
    .filter((item) => !to || item.date <= to)
    .sort((a, b) => itemCompare(a.date, b.date))
}

function itemCompare(a, b) {
  return a.localeCompare(b)
}

function callcardFiles(item) {
  const eta = path.join(item.dir, `${item.date}_RAW_DATA_callcard_eta.xlsx`)
  const remapped = path.join(item.dir, `${item.date}_RAW_DATA_remapped.xlsx`)
  return { eta, remapped }
}

function fileBlob(filePath) {
  return new Blob([fs.readFileSync(filePath)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function buildCallcardForm(item) {
  const files = callcardFiles(item)
  if (!fs.existsSync(files.eta) || !fs.existsSync(files.remapped)) {
    throw new Error(`${item.date}: callcard/remapped pair is missing`)
  }

  const form = new FormData()
  form.append('callcard_eta', fileBlob(files.eta), path.basename(files.eta))
  form.append('remapped', fileBlob(files.remapped), path.basename(files.remapped))
  return form
}

async function postJson(baseUrl, endpoint, body) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function postForm(baseUrl, endpoint, form) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    body: form,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function ping(baseUrl) {
  const res = await fetch(`${baseUrl}/ingest`)
  if (!res.ok) throw new Error(`${baseUrl}/ingest returned ${res.status}`)
}

function logRecord(record) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...record }))
}

async function main() {
  const root = argValue('root', DEFAULT_ROOT)
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL)
  const from = normalizeDateArg(argValue('from'))
  const to = normalizeDateArg(argValue('to'))
  const onlyDate = normalizeDateArg(argValue('date'))
  const skipCallcards = hasArg('skip-callcards')
  const skipDriverLogs = hasArg('skip-driver-logs')
  const skipDriverMbti = hasArg('skip-driver-mbti')
  const skipMatching = hasArg('skip-matching')
  const dryRun = hasArg('dry-run')

  if (!fs.existsSync(root)) throw new Error(`root not found: ${root}`)
  await ping(baseUrl)

  const items = discoverDateDirs(root, from, to, onlyDate)
  if (items.length === 0) throw new Error('no call_data directories matched')

  logRecord({
    step: 'start',
    base_url: baseUrl,
    root,
    dates: items.map((item) => item.date),
    skips: { skipCallcards, skipDriverLogs, skipDriverMbti, skipMatching },
    dry_run: dryRun,
  })

  if (dryRun) {
    for (const item of items) {
      const files = callcardFiles(item)
      const bytes = fs.existsSync(files.eta) && fs.existsSync(files.remapped)
        ? fs.statSync(files.eta).size + fs.statSync(files.remapped).size
        : 0
      logRecord({
        step: 'dry_run_date',
        date: item.date,
        callcard_eta_exists: fs.existsSync(files.eta),
        remapped_exists: fs.existsSync(files.remapped),
        upload_mb: Number((bytes / 1024 / 1024).toFixed(2)),
      })
    }
    logRecord({ step: 'dry_run_done' })
    return
  }

  for (const item of items) {
    const files = callcardFiles(item)
    const bytes = fs.statSync(files.eta).size + fs.statSync(files.remapped).size
    logRecord({ step: 'date_start', date: item.date, upload_mb: Number((bytes / 1024 / 1024).toFixed(2)) })

    if (!skipCallcards) {
      const result = await postForm(baseUrl, '/api/callcard-mbti', buildCallcardForm(item))
      logRecord({ step: 'callcard-mbti', date: item.date, result })
    }

    if (!skipDriverLogs) {
      const result = await postForm(baseUrl, '/api/driver-logs', buildCallcardForm(item))
      logRecord({ step: 'driver-logs', date: item.date, result })
    }
  }

  if (!skipDriverMbti) {
    const result = await postJson(baseUrl, '/api/driver-mbti', {})
    logRecord({ step: 'driver-mbti', result })
  }

  if (!skipMatching) {
    for (const item of items) {
      const callDate = ymdToDate(item.date)
      const result = await postJson(baseUrl, '/api/matching', { call_date: callDate })
      logRecord({ step: 'matching', date: item.date, result })
    }
  }

  logRecord({ step: 'done', dates: items.map((item) => item.date) })
}

main().catch((error) => {
  logRecord({ step: 'failed', error: error.message })
  process.exit(1)
})

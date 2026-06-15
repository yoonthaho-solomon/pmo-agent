const fs = require('fs')
const path = require('path')

const DESKTOP_DIR = '\uBC14\uD0D5 \uD654\uBA74'
const METER_DATA_DIR = '\uC571\uBBF8\uD130\uB370\uC774\uD130'
const DEFAULT_ROOT = path.join(process.env.USERPROFILE || 'C:\\Users\\pgman', 'OneDrive', DESKTOP_DIR, METER_DATA_DIR)
const DEFAULT_BASE_URL = 'http://localhost:3133'
const DEFAULT_ASP_ID = '147'

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

function hasArg(name) {
  return process.argv.includes(`--${name}`)
}

function normalizeDateArg(value) {
  if (!value) return null
  const compact = String(value).replace(/-/g, '')
  return /^\d{8}$/.test(compact) ? compact : null
}

function logRecord(record) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...record }))
}

function fileBlob(filePath) {
  return new Blob([fs.readFileSync(filePath)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function extractDateFromFileName(fileName) {
  const match = fileName.match(/(\d{8})_(\d{8})/)
  return match ? match[1] : null
}

function discoverFiles(root, from, to, onlyDate, explicitFile) {
  if (explicitFile) {
    const resolved = path.resolve(explicitFile)
    if (!fs.existsSync(resolved)) throw new Error(`file not found: ${resolved}`)
    const date = extractDateFromFileName(path.basename(resolved))
    return [{ date, file: resolved }]
  }

  const results = []
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.isFile() || !/\.xlsx$/i.test(entry.name)) continue
      const date = extractDateFromFileName(entry.name)
      if (!date) continue
      if (onlyDate && date !== onlyDate) continue
      if (from && date < from) continue
      if (to && date > to) continue
      results.push({ date, file: full })
    }
  }

  walk(root)
  return results.sort((a, b) => a.date.localeCompare(b.date) || a.file.localeCompare(b.file))
}

async function ping(baseUrl) {
  const res = await fetch(`${baseUrl}/ingest`)
  if (!res.ok) throw new Error(`${baseUrl}/ingest returned ${res.status}`)
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

function buildMeterLogsForm(file) {
  const form = new FormData()
  form.append('file', fileBlob(file), path.basename(file))
  return form
}

function buildMeterExcelForm(file, aspId) {
  const form = new FormData()
  form.append('meter_file', fileBlob(file), path.basename(file))
  form.append('asp_id', aspId)
  return form
}

async function main() {
  const root = argValue('root', DEFAULT_ROOT)
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL)
  const aspId = argValue('asp-id', DEFAULT_ASP_ID)
  const from = normalizeDateArg(argValue('from'))
  const to = normalizeDateArg(argValue('to'))
  const onlyDate = normalizeDateArg(argValue('date'))
  const explicitFile = argValue('file')
  const mode = argValue('mode', 'excel')
  const dryRun = hasArg('dry-run')

  if (!['daily', 'excel', 'both'].includes(mode)) {
    throw new Error('--mode must be daily, excel, or both')
  }
  if (!explicitFile && !fs.existsSync(root)) throw new Error(`root not found: ${root}`)
  await ping(baseUrl)

  const items = discoverFiles(root, from, to, onlyDate, explicitFile)
  if (items.length === 0) throw new Error('no meter xlsx files matched')

  logRecord({
    step: 'start',
    base_url: baseUrl,
    root: explicitFile ? null : root,
    files: items.map((item) => ({ date: item.date, file: item.file })),
    mode,
    asp_id: aspId,
    dry_run: dryRun,
  })

  for (const item of items) {
    const stat = fs.statSync(item.file)
    logRecord({
      step: 'file_start',
      date: item.date,
      file: item.file,
      upload_mb: Number((stat.size / 1024 / 1024).toFixed(2)),
    })

    if (dryRun) continue

    if (mode === 'daily' || mode === 'both') {
      const result = await postForm(baseUrl, '/api/meter-logs', buildMeterLogsForm(item.file))
      logRecord({ step: 'meter-logs', date: item.date, result })
    }

    if (mode === 'excel' || mode === 'both') {
      const result = await postForm(baseUrl, '/api/meter-excel', buildMeterExcelForm(item.file, aspId))
      logRecord({ step: 'meter-excel', date: item.date, result })
    }
  }

  logRecord({ step: dryRun ? 'dry_run_done' : 'done', count: items.length })
}

main().catch((error) => {
  logRecord({ step: 'failed', error: error.message })
  process.exit(1)
})

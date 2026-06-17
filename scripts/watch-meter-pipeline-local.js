const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const DESKTOP_DIR = '\uBC14\uD0D5 \uD654\uBA74'
const METER_DATA_DIR = '\uC571\uBBF8\uD130\uB370\uC774\uD130'
const DEFAULT_ROOT = path.join(process.env.USERPROFILE || 'C:\\Users\\pgman', 'OneDrive', DESKTOP_DIR, METER_DATA_DIR)
const DEFAULT_BASE_URL = 'http://localhost:3133'
const DEFAULT_INTERVAL_MS = 30_000
const DEFAULT_STABLE_MS = 60_000

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

function hasArg(name) {
  return process.argv.includes(`--${name}`)
}

function now() {
  return new Date().toISOString()
}

function log(record) {
  console.log(JSON.stringify({ at: now(), ...record }))
}

function compactDate(value) {
  return value ? String(value).replaceAll('-', '').slice(0, 8) : null
}

async function loadedMeterMaxDate(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/system-status`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`status api ${res.status}`)
    const json = await res.json()
    const dates = (json.meterTables || [])
      .filter((item) => item.table === 'meter_hourly_logs' || item.table === 'meter_driver_logs')
      .map((item) => compactDate(item.maxDate))
      .filter(Boolean)
      .sort()
    return dates.at(-1) || null
  } catch (error) {
    log({ step: 'loaded_range_unavailable', source: 'meter', error: error.message })
    return null
  }
}

function extractDateFromFileName(fileName) {
  const match = fileName.match(/(\d{8})_(\d{8})/)
  return match ? match[1] : null
}

function meterFiles(root) {
  const results = []
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.isFile() || !/\.xlsx$/i.test(entry.name)) continue
      const date = extractDateFromFileName(entry.name)
      if (!date) continue
      results.push({ date, file: full })
    }
  }
  walk(root)
  return results.sort((a, b) => a.date.localeCompare(b.date) || a.file.localeCompare(b.file))
}

function fileState(file) {
  if (!fs.existsSync(file)) return { ready: false, bytes: 0, mtime: 0 }
  const stat = fs.statSync(file)
  return { ready: true, bytes: stat.size, mtime: stat.mtimeMs }
}

function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return { processed: {}, failed: {}, pending: {} }
  }
}

function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(state, null, 2))
}

function fileKey(file) {
  return path.resolve(file).toLowerCase()
}

function runPipeline(file, baseUrl, mode, aspId) {
  return new Promise((resolve, reject) => {
    const args = [
      'run',
      'meter:pipeline',
      '--',
      `--file=${file}`,
      `--base-url=${baseUrl}`,
      `--mode=${mode}`,
      `--asp-id=${aspId}`,
    ]
    const child = spawn('npm.cmd', args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`meter pipeline exited with code ${code}`))
    })
  })
}

async function main() {
  const root = argValue('root', DEFAULT_ROOT)
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL)
  const intervalMs = Number(argValue('interval-ms', DEFAULT_INTERVAL_MS))
  const stableMs = Number(argValue('stable-ms', DEFAULT_STABLE_MS))
  const stateFile = argValue('state', path.join('work', 'meter-pipeline-watch-state.json'))
  const processExisting = hasArg('process-existing')
  const skipLoaded = !hasArg('no-skip-loaded')
  const once = hasArg('once')
  const mode = argValue('mode', 'excel')
  const aspId = argValue('asp-id', '147')

  if (!['daily', 'excel', 'both'].includes(mode)) {
    throw new Error('--mode must be daily, excel, or both')
  }
  if (!fs.existsSync(root)) throw new Error(`root not found: ${root}`)

  const state = loadState(stateFile)
  const seenAtStart = new Set(meterFiles(root).map((item) => fileKey(item.file)))
  const loadedThrough = processExisting && skipLoaded ? await loadedMeterMaxDate(baseUrl) : null

  log({
    step: 'watch_start',
    root,
    base_url: baseUrl,
    interval_ms: intervalMs,
    stable_ms: stableMs,
    process_existing: processExisting,
    skip_loaded: skipLoaded,
    loaded_through: loadedThrough,
    state_file: stateFile,
    mode,
    asp_id: aspId,
  })

  let running = false

  async function scan() {
    if (running) return
    running = true
    try {
      for (const item of meterFiles(root)) {
        const key = fileKey(item.file)
        if (!processExisting && seenAtStart.has(key)) continue
        if (loadedThrough && item.date <= loadedThrough) {
          log({ step: 'skip_loaded', date: item.date, file: item.file, loaded_through: loadedThrough })
          state.processed[key] = state.processed[key] || { at: now(), date: item.date, file: item.file, source: 'loaded_range' }
          saveState(stateFile, state)
          continue
        }
        if (state.processed[key]) continue

        const current = fileState(item.file)
        if (!current.ready) continue

        const last = state.pending?.[key]
        state.pending = state.pending || {}
        const signature = `${current.bytes}:${current.mtime}`
        const firstSeenAt = last?.signature === signature ? last.first_seen_at : Date.now()
        state.pending[key] = {
          date: item.date,
          file: item.file,
          signature,
          first_seen_at: firstSeenAt,
        }
        saveState(stateFile, state)

        const stableForMs = Date.now() - firstSeenAt
        if (stableForMs < stableMs) {
          log({
            step: 'waiting_stable',
            date: item.date,
            file: item.file,
            upload_mb: Number((current.bytes / 1024 / 1024).toFixed(2)),
            stable_for_ms: stableForMs,
          })
          continue
        }

        log({ step: 'pipeline_start', date: item.date, file: item.file })
        try {
          await runPipeline(item.file, baseUrl, mode, aspId)
          state.processed[key] = { at: now(), date: item.date, file: item.file }
          delete state.failed[key]
          delete state.pending[key]
          saveState(stateFile, state)
          log({ step: 'pipeline_done', date: item.date, file: item.file })
        } catch (error) {
          state.failed[key] = { at: now(), date: item.date, file: item.file, error: error.message }
          saveState(stateFile, state)
          log({ step: 'pipeline_failed', date: item.date, file: item.file, error: error.message })
        }
      }
    } finally {
      running = false
    }
  }

  await scan()
  if (once) return

  setInterval(() => {
    scan().catch((error) => log({ step: 'scan_failed', error: error.message }))
  }, intervalMs)
}

main().catch((error) => {
  log({ step: 'failed', error: error.message })
  process.exit(1)
})

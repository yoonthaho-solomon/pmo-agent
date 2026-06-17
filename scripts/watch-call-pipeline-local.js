const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const DESKTOP_DIR = '\uBC14\uD0D5 \uD654\uBA74'
const CALL_DATA_DIR = '\uD638\uCD9C\uB370\uC774\uD130'
const DEFAULT_ROOT = path.join(process.env.USERPROFILE || 'C:\\Users\\pgman', 'OneDrive', DESKTOP_DIR, CALL_DATA_DIR)
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

async function loadedCallMaxDate(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/system-status`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`status api ${res.status}`)
    const json = await res.json()
    const row = json.callTables?.find((item) => item.table === 'callcard_mbti')
    return compactDate(row?.maxDate)
  } catch (error) {
    log({ step: 'loaded_range_unavailable', source: 'callcard_mbti', error: error.message })
    return null
  }
}

function dateDirs(root) {
  if (!fs.existsSync(root)) return []
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}_call_data$/.test(entry.name))
    .map((entry) => {
      const date = entry.name.slice(0, 8)
      return { date, dir: path.join(root, entry.name) }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

function pairFiles(item) {
  return {
    eta: path.join(item.dir, `${item.date}_RAW_DATA_callcard_eta.xlsx`),
    remapped: path.join(item.dir, `${item.date}_RAW_DATA_remapped.xlsx`),
  }
}

function pairState(item) {
  const files = pairFiles(item)
  if (!fs.existsSync(files.eta) || !fs.existsSync(files.remapped)) {
    return { ready: false, bytes: 0, mtimes: [] }
  }
  const eta = fs.statSync(files.eta)
  const remapped = fs.statSync(files.remapped)
  return {
    ready: true,
    bytes: eta.size + remapped.size,
    mtimes: [eta.mtimeMs, remapped.mtimeMs],
  }
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

function runPipeline(date, baseUrl, extraArgs) {
  return new Promise((resolve, reject) => {
    const args = [
      'run',
      'call:pipeline',
      '--',
      `--date=${date}`,
      `--base-url=${baseUrl}`,
      ...extraArgs,
    ]
    const child = spawn('npm.cmd', args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`pipeline exited with code ${code}`))
    })
  })
}

async function main() {
  const root = argValue('root', DEFAULT_ROOT)
  const baseUrl = argValue('base-url', DEFAULT_BASE_URL)
  const intervalMs = Number(argValue('interval-ms', DEFAULT_INTERVAL_MS))
  const stableMs = Number(argValue('stable-ms', DEFAULT_STABLE_MS))
  const stateFile = argValue('state', path.join('work', 'call-pipeline-watch-state.json'))
  const processExisting = hasArg('process-existing')
  const skipLoaded = !hasArg('no-skip-loaded')
  const once = hasArg('once')
  const extraArgs = []
  for (const name of ['skip-callcards', 'skip-driver-logs', 'skip-driver-mbti', 'skip-matching']) {
    if (hasArg(name)) extraArgs.push(`--${name}`)
  }

  if (!fs.existsSync(root)) throw new Error(`root not found: ${root}`)

  const state = loadState(stateFile)
  const seenAtStart = new Set(dateDirs(root).map((item) => item.date))
  const loadedThrough = processExisting && skipLoaded ? await loadedCallMaxDate(baseUrl) : null

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
  })

  let running = false

  async function scan() {
    if (running) return
    running = true
    try {
      for (const item of dateDirs(root)) {
        if (!processExisting && seenAtStart.has(item.date)) continue
        if (loadedThrough && item.date <= loadedThrough) {
          log({ step: 'skip_loaded', date: item.date, loaded_through: loadedThrough })
          state.processed[item.date] = state.processed[item.date] || { at: now(), source: 'loaded_range' }
          saveState(stateFile, state)
          continue
        }
        if (state.processed[item.date]) continue

        const current = pairState(item)
        if (!current.ready) {
          log({ step: 'waiting_pair', date: item.date })
          continue
        }

        const last = state.pending?.[item.date]
        state.pending = state.pending || {}
        const signature = `${current.bytes}:${current.mtimes.join(',')}`
        const firstSeenAt = last?.signature === signature ? last.first_seen_at : Date.now()
        state.pending[item.date] = { signature, first_seen_at: firstSeenAt }
        saveState(stateFile, state)

        const stableForMs = Date.now() - firstSeenAt
        if (stableForMs < stableMs) {
          log({
            step: 'waiting_stable',
            date: item.date,
            upload_mb: Number((current.bytes / 1024 / 1024).toFixed(2)),
            stable_for_ms: stableForMs,
          })
          continue
        }

        log({ step: 'pipeline_start', date: item.date })
        try {
          await runPipeline(item.date, baseUrl, extraArgs)
          state.processed[item.date] = { at: now() }
          delete state.failed[item.date]
          delete state.pending[item.date]
          saveState(stateFile, state)
          log({ step: 'pipeline_done', date: item.date })
        } catch (error) {
          state.failed[item.date] = { at: now(), error: error.message }
          saveState(stateFile, state)
          log({ step: 'pipeline_failed', date: item.date, error: error.message })
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

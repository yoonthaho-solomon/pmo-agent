'use client'

import { useEffect, useRef, useState } from 'react'
import type { VectorSampleData, VectorSampleAxis, VectorSampleDim } from '@/app/api/vector-workbench/sample/route'
import type { EmbeddingData } from '@/app/api/vector-workbench/embedding/route'
import type { BufferGeometry, Line, Mesh, Points, WebGLRenderer } from 'three'

// ---- PCA (top-2 components via power iteration) for the embedding scatter ----
function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

function powerIteration(C: number[][], d: number): number[] {
  let v = new Array(d).fill(0).map((_, i) => Math.sin(i + 1)) // deterministic seed
  let norm = Math.sqrt(dot(v, v))
  v = v.map((x) => x / norm)
  for (let iter = 0; iter < 120; iter++) {
    const w = new Array(d).fill(0)
    for (let i = 0; i < d; i++) {
      let s = 0
      const Ci = C[i]
      for (let j = 0; j < d; j++) s += Ci[j] * v[j]
      w[i] = s
    }
    norm = Math.sqrt(dot(w, w))
    if (norm < 1e-9) break
    v = w.map((x) => x / norm)
  }
  return v
}

function pca2(rows: number[][]): [number, number][] {
  const n = rows.length
  if (!n) return []
  const d = rows[0].length
  const mean = new Array(d).fill(0)
  for (const r of rows) for (let j = 0; j < d; j++) mean[j] += r[j]
  for (let j = 0; j < d; j++) mean[j] /= n
  const X = rows.map((r) => r.map((v, j) => v - mean[j]))
  const C = Array.from({ length: d }, () => new Array(d).fill(0))
  for (const r of X) for (let i = 0; i < d; i++) {
    const ri = r[i]
    if (ri === 0) continue
    for (let j = 0; j < d; j++) C[i][j] += ri * r[j]
  }
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i][j] /= n
  const v1 = powerIteration(C, d)
  const l1 = dot(v1, C.map((row) => dot(row, v1))) // Rayleigh quotient ≈ λ1
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i][j] -= l1 * v1[i] * v1[j]
  const v2 = powerIteration(C, d)
  return X.map((r) => [dot(r, v1), dot(r, v2)])
}

// ---- Helpers ----
function hourSlotLabel(h: number): string {
  if (h <= 5) return '새벽'
  if (h <= 11) return '오전'
  if (h <= 17) return '주간'
  return '야간'
}
function weekdayLabel(wd: number): string {
  return ['일', '월', '화', '수', '목', '금', '토'][wd] ?? '-'
}
function distanceLabel(m: number): string {
  if (m <= 3000) return '단거리'
  if (m <= 8000) return '중거리'
  return '장거리'
}
function driverShortId(id: string): string {
  return id.length > 8 ? id.slice(-6).toUpperCase() : id.toUpperCase()
}

function contribOf(dim: VectorSampleDim): number {
  return Math.max(0, 1 - Math.abs(dim.call - dim.drv) * 4) * (dim.call + dim.drv) / 2
}

// ---- Canvas drawing ----
function drawVectorCanvas(canvas: HTMLCanvasElement, axes: VectorSampleAxis[], similarity: number, t: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  if (W <= 0 || H <= 0) return

  // Gentle breathing pulse drives the glow + wedge so the lens feels alive.
  const pulse = (Math.sin(t * 2.2) + 1) / 2

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, 'rgba(3,7,14,.98)')
  bg.addColorStop(0.46, 'rgba(8,13,23,.96)')
  bg.addColorStop(1, 'rgba(2,4,10,.99)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.globalAlpha = 0.34
  ctx.strokeStyle = 'rgba(148,163,184,.075)'
  ctx.lineWidth = 1
  for (let x = -80 + ((t * 18) % 80); x < W + 120; x += 80) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + H * 0.55, H)
    ctx.stroke()
  }
  for (let y = 34; y < H; y += 34) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const chamber = ctx.createRadialGradient(W * 0.48, H * 0.44, 0, W * 0.48, H * 0.44, Math.max(W, H) * 0.62)
  chamber.addColorStop(0, 'rgba(34,211,238,.08)')
  chamber.addColorStop(0.42, 'rgba(167,139,250,.045)')
  chamber.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = chamber
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // ===== BACKDROP: 22-axis constellation =====
  const ccx = W * 0.50, ccy = H * 0.50
  const orbitR = Math.min(W * 0.34, H * 0.42)
  const axisCount = 22
  const axisPoints: { x: number; y: number }[] = []
  for (let i = 0; i < axisCount; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / axisCount
    const phase = (t * 1.3 + i * 0.17) % 1
    const depth = 0.82 + 0.18 * Math.sin(t * 0.5 + i)
    const x = ccx + orbitR * depth * Math.cos(a)
    const y = ccy + orbitR * 0.72 * depth * Math.sin(a)
    const glow = 0.22 + 0.46 * Math.max(0, Math.sin((phase + 0.08) * Math.PI))
    axisPoints.push({ x, y })

    ctx.beginPath()
    ctx.moveTo(ccx, ccy)
    ctx.lineTo(x, y)
    ctx.strokeStyle = `rgba(148,163,184,${0.025 + glow * 0.028})`
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(x, y, 1.7 + glow * 1.8, 0, 7)
    ctx.fillStyle = i % 2 ? `rgba(167,139,250,${0.18 + glow * 0.28})` : `rgba(34,211,238,${0.18 + glow * 0.28})`
    ctx.shadowColor = i % 2 ? '#a78bfa' : '#22d3ee'
    ctx.shadowBlur = 3 + glow * 7
    ctx.fill()
    ctx.shadowBlur = 0
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < axisPoints.length; i++) {
    const p = axisPoints[i]
    const q = axisPoints[(i + 7) % axisPoints.length]
    const alpha = 0.018 + 0.026 * (0.5 + 0.5 * Math.sin(t + i))
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.quadraticCurveTo(ccx, ccy, q.x, q.y)
    ctx.strokeStyle = `rgba(180,210,245,${alpha})`
    ctx.lineWidth = 1
    ctx.stroke()
  }
  for (let i = 0; i < 34; i++) {
    const a = i * 12.989 + t * (0.08 + (i % 5) * 0.012)
    const r = orbitR * (0.18 + ((i * 37) % 100) / 130)
    const x = ccx + Math.cos(a) * r
    const y = ccy + Math.sin(a * 0.9) * r * 0.58
    ctx.beginPath()
    ctx.arc(x, y, 0.8 + (i % 3) * 0.35, 0, 7)
    ctx.fillStyle = i % 3 === 0 ? 'rgba(92,224,240,.42)' : 'rgba(195,172,255,.32)'
    ctx.fill()
  }
  ctx.restore()

  ctx.beginPath()
  ctx.arc(ccx, ccy, orbitR * 0.72, 0, 7)
  ctx.strokeStyle = 'rgba(148,163,184,.055)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(ccx, ccy, orbitR, 0, 7)
  ctx.strokeStyle = 'rgba(148,163,184,.075)'
  ctx.stroke()

  const centerHalo = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, orbitR * 0.46)
  centerHalo.addColorStop(0, 'rgba(232,237,246,.13)')
  centerHalo.addColorStop(0.5, 'rgba(34,211,238,.08)')
  centerHalo.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.fillStyle = centerHalo
  ctx.beginPath()
  ctx.arc(ccx, ccy, orbitR * 0.46, 0, 7)
  ctx.fill()

  ctx.fillStyle = '#e8edf6'
  ctx.font = '800 19px Pretendard, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('22 AXIS VECTOR FIELD', ccx, ccy - 10)
  ctx.fillStyle = '#8b98ae'
  ctx.font = '600 13px Pretendard, sans-serif'
  ctx.fillText('same direction = higher cosine similarity', ccx, ccy + 16)

  // ===== LEFT: radar pentagon =====
  const rcx = W * 0.24, rcy = H * 0.52
  const R = Math.min(W * 0.17, H * 0.34)
  const n = axes.length
  const ang = (i: number) => -Math.PI / 2 + i * 2 * Math.PI / n

  // grid rings
  for (let g = 1; g <= 4; g++) {
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const a = ang(i % n)
      const rr = R * g / 4
      const x = rcx + rr * Math.cos(a), y = rcy + rr * Math.sin(a)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.strokeStyle = `rgba(148,163,184,${0.05 + g * 0.012})`
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // spokes + labels
  for (let i = 0; i < n; i++) {
    const a = ang(i)
    const x = rcx + R * Math.cos(a), y = rcy + R * Math.sin(a)
    ctx.beginPath()
    ctx.moveTo(rcx, rcy)
    ctx.lineTo(x, y)
    ctx.strokeStyle = 'rgba(148,163,184,.07)'
    ctx.stroke()
    ctx.fillStyle = '#9aa7bd'
    ctx.font = '600 11px Pretendard, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(axes[i].label, rcx + (R + 22) * Math.cos(a), rcy + (R + 16) * Math.sin(a))
  }

  const poly = (key: 'call' | 'drv', stroke: string, fill: string, glow: string) => {
    ctx.save()
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const a = ang(i % n)
      const v = axes[i % n][key]
      const rr = R * v
      const x = rcx + rr * Math.cos(a), y = rcy + rr * Math.sin(a)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.shadowColor = glow
    ctx.shadowBlur = 8 + pulse * 10
    ctx.stroke()
    ctx.restore()
    for (let i = 0; i < n; i++) {
      const a = ang(i)
      const v = axes[i][key]
      const rr = R * v
      const x = rcx + rr * Math.cos(a), y = rcy + rr * Math.sin(a)
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 7)
      ctx.fillStyle = stroke
      ctx.fill()
    }
  }
  poly('call', '#34d8ee', 'rgba(34,211,238,.14)', '#22d3ee')
  poly('drv',  '#b79bff', 'rgba(167,139,250,.16)', '#a78bfa')

  // ===== RIGHT: cosine wedge =====
  const ox = W * 0.70, oy = H * 0.76
  const L = Math.min(W * 0.24, H * 0.52)
  const cosv = Math.max(-1, Math.min(1, similarity))
  const theta = Math.acos(cosv)
  const base = -Math.PI / 2 - 0.18
  const aCall = base, aDrv = base + theta

  // arc fill
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.arc(ox, oy, L * 0.42, aCall, aDrv)
  ctx.closePath()
  const gg = ctx.createRadialGradient(ox, oy, 0, ox, oy, L * 0.42)
  gg.addColorStop(0, `rgba(120,160,255,${(0.18 + pulse * 0.22).toFixed(3)})`)
  gg.addColorStop(1, 'rgba(120,160,255,0)')
  ctx.fillStyle = gg
  ctx.fill()
  ctx.restore()

  // two rays
  const ray = (a: number, col: string, glow: string, lbl: string) => {
    const x = ox + L * Math.cos(a), y = oy + L * Math.sin(a)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(x, y)
    ctx.strokeStyle = col
    ctx.lineWidth = 2.5
    ctx.shadowColor = glow
    ctx.shadowBlur = 10 + pulse * 12
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 4.5, 0, 7)
    ctx.fillStyle = col
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = col
    ctx.font = '600 12px Pretendard, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(lbl, x + Math.cos(a) * 18, y + Math.sin(a) * 14)
  }

  ctx.beginPath()
  ctx.arc(ox, oy, 4, 0, 7)
  ctx.fillStyle = '#e8edf6'
  ctx.fill()
  ray(aCall, '#34d8ee', '#22d3ee', 'CALL')
  ray(aDrv,  '#b79bff', '#a78bfa', 'DRIVER')

  // theta arc indicator
  ctx.beginPath()
  ctx.arc(ox, oy, 30, aCall, aDrv)
  ctx.strokeStyle = 'rgba(220,230,245,.5)'
  ctx.lineWidth = 1.4
  ctx.stroke()
  const midA = (aCall + aDrv) / 2
  const thetaDeg = (theta * 180 / Math.PI).toFixed(1)
  ctx.fillStyle = '#dbe7f2'
  ctx.font = '600 12px JetBrains Mono, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${thetaDeg} deg`, ox + 50 * Math.cos(midA), oy + 50 * Math.sin(midA))
  ctx.fillStyle = '#9aa7bd'
  ctx.font = '600 12px Pretendard, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('smaller angle means closer vector direction', ox - L * 0.1, oy + 26)
  ctx.fillStyle = '#c3acff'
  ctx.font = '700 13px JetBrains Mono, monospace'
  ctx.fillText(`cos = ${cosv.toFixed(3)}`, ox - L * 0.1, oy + 46)
}


async function startVectorWebGLScene(
  canvas: HTMLCanvasElement,
  getAxes: () => VectorSampleAxis[] | null,
  getSimilarity: () => number,
) {
  const THREE = await import('three')
  const renderer: WebGLRenderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x02040a, 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x02040a, 0.045)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
  camera.position.set(0, 1.05, 7.8)

  const root = new THREE.Group()
  root.rotation.x = -0.18
  scene.add(root)

  const ambient = new THREE.AmbientLight(0xb8ccff, 0.55)
  const key = new THREE.PointLight(0x5ce0f0, 2.1, 18)
  key.position.set(-3.8, 3.1, 4.2)
  const rim = new THREE.PointLight(0xa78bfa, 1.7, 16)
  rim.position.set(4.6, -1.4, 3.8)
  scene.add(ambient, key, rim)

  const disposable: Array<{ dispose: () => void }> = []
  const dynamicGeometries: BufferGeometry[] = []
  const axisNodes: Mesh[] = []

  const makeMat = (color: number, opacity: number) => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    disposable.push(mat)
    return mat
  }
  const axisLineMat = new THREE.LineBasicMaterial({
    color: 0x9aa7bd,
    transparent: true,
    opacity: 0.13,
    blending: THREE.AdditiveBlending,
  })
  const callLineMat = new THREE.LineBasicMaterial({
    color: 0x34d8ee,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  })
  const driverLineMat = new THREE.LineBasicMaterial({
    color: 0xb79bff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  })
  disposable.push(axisLineMat, callLineMat, driverLineMat)

  const starPositions = new Float32Array(900 * 3)
  for (let i = 0; i < 900; i++) {
    const r = 6 + ((i * 37) % 100) / 12
    const a = i * 2.399963
    starPositions[i * 3] = Math.cos(a) * r
    starPositions[i * 3 + 1] = ((i * 97) % 100) / 12 - 4
    starPositions[i * 3 + 2] = Math.sin(a) * r - 1.5
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const starMat = new THREE.PointsMaterial({
    color: 0x6ee7ff,
    size: 0.024,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const stars: Points = new THREE.Points(starGeo, starMat)
  scene.add(stars)
  disposable.push(starGeo, starMat)

  const orbitGeo = new THREE.TorusGeometry(2.52, 0.004, 8, 160)
  const orbitMat = new THREE.MeshBasicMaterial({
    color: 0x8aa0bd,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
  })
  const orbit = new THREE.Mesh(orbitGeo, orbitMat)
  orbit.rotation.x = Math.PI / 2
  root.add(orbit)
  disposable.push(orbitGeo, orbitMat)

  const nodeGeo = new THREE.SphereGeometry(0.04, 12, 12)
  const cyanNode = makeMat(0x22d3ee, 0.78)
  const violetNode = makeMat(0xa78bfa, 0.7)
  disposable.push(nodeGeo)

  for (let i = 0; i < 22; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 22
    const p = new THREE.Vector3(Math.cos(a) * 2.42, Math.sin(a) * 1.46, Math.sin(a * 2.2) * 0.62)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), p])
    const line: Line = new THREE.Line(lineGeo, axisLineMat)
    root.add(line)
    dynamicGeometries.push(lineGeo)

    const node = new THREE.Mesh(nodeGeo, i % 2 ? violetNode : cyanNode)
    node.position.copy(p)
    root.add(node)
    axisNodes.push(node)
  }

  const callGeo = new THREE.BufferGeometry()
  const driverGeo = new THREE.BufferGeometry()
  const callLine: Line = new THREE.Line(callGeo, callLineMat)
  const driverLine: Line = new THREE.Line(driverGeo, driverLineMat)
  root.add(callLine, driverLine)
  dynamicGeometries.push(callGeo, driverGeo)

  const callCore = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 18), makeMat(0x34d8ee, 0.9))
  const driverCore = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 18), makeMat(0xb79bff, 0.86))
  callCore.position.set(-1.35, -1.55, 0.25)
  driverCore.position.set(1.35, -1.55, 0.25)
  root.add(callCore, driverCore)
  disposable.push(callCore.geometry, driverCore.geometry)

  const beamGeo = new THREE.BufferGeometry()
  const beamMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
  })
  const beam: Line = new THREE.Line(beamGeo, beamMat)
  root.add(beam)
  dynamicGeometries.push(beamGeo)
  disposable.push(beamMat)

  const axisPosition = (index: number, value: number, zBias: number) => {
    const count = Math.max(1, getAxes()?.length ?? 5)
    const a = -Math.PI / 2 + (index * Math.PI * 2) / count
    const radius = 0.74 + value * 1.62
    return new THREE.Vector3(
      Math.cos(a) * radius,
      Math.sin(a) * radius * 0.78,
      zBias + Math.sin(a * 1.7 + index * 0.33) * 0.38 + (value - 0.5) * 0.28,
    )
  }

  const updateVectorGeometry = () => {
    const axes = getAxes()
    if (!axes?.length) return
    const callPoints = axes.map((axis, index) => axisPosition(index, axis.call, -0.28))
    const driverPoints = axes.map((axis, index) => axisPosition(index, axis.drv, 0.28))
    callPoints.push(callPoints[0].clone())
    driverPoints.push(driverPoints[0].clone())
    callGeo.setFromPoints(callPoints)
    driverGeo.setFromPoints(driverPoints)

    const similarity = Math.max(0, Math.min(1, getSimilarity()))
    const beamLift = 0.35 + similarity * 1.2
    beamGeo.setFromPoints([
      new THREE.Vector3(-1.35, -1.55, 0.25),
      new THREE.Vector3(-0.4, -0.85 + beamLift, 0.02),
      new THREE.Vector3(0.4, -0.85 + beamLift, 0.02),
      new THREE.Vector3(1.35, -1.55, 0.25),
    ])
    beamMat.opacity = 0.16 + similarity * 0.38
  }

  let raf = 0
  let stopped = false
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const animate = (ms: number) => {
    if (stopped) return
    const t = ms * 0.001
    resize()
    updateVectorGeometry()
    root.rotation.y = Math.sin(t * 0.22) * 0.34 + t * 0.045
    orbit.rotation.z = t * 0.18
    stars.rotation.y = -t * 0.012
    key.intensity = 1.7 + Math.sin(t * 1.8) * 0.28
    axisNodes.forEach((node, index) => {
      const scale = 1 + Math.sin(t * 2.1 + index) * 0.32
      node.scale.setScalar(scale)
    })
    renderer.render(scene, camera)
    raf = requestAnimationFrame(animate)
  }
  raf = requestAnimationFrame(animate)

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    renderer.dispose()
    dynamicGeometries.forEach((geometry) => geometry.dispose())
    disposable.forEach((item) => item.dispose())
  }
}

// ---- Main component ----
export function VectorWorkbenchView() {
  const [data, setData] = useState<VectorSampleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(0) // selected factor (0..21)
  const [proj, setProj] = useState<{ coords: [number, number][]; points: EmbeddingData['points'] } | null>(null)
  const [projLoading, setProjLoading] = useState(false)
  const [projError, setProjError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // RAF reads the latest selected-driver radar via refs so the loop never goes stale.
  const axesRef = useRef<VectorSampleAxis[] | null>(null)
  const cosRef = useRef(0)

  useEffect(() => {
    fetch('/api/vector-workbench/sample')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json.data)
        else setError(json.message ?? 'API 오류')
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const selDriver = data && data.drivers.length ? data.drivers[0] : null

  useEffect(() => {
    axesRef.current = selDriver?.axes ?? null
    cosRef.current = selDriver?.cosineSimilarity ?? 0
  }, [selDriver])

  // WebGL first, 2D canvas fallback: keeps the visual alive even on weak GPUs.
  useEffect(() => {
    if (!selDriver) return
    let stopped = false
    let cleanup: (() => void) | null = null
    let fallbackRaf = 0
    let fallbackT = 0

    const startFallback = () => {
      const loop = () => {
        const canvas = canvasRef.current
        if (canvas && axesRef.current) drawVectorCanvas(canvas, axesRef.current, cosRef.current, fallbackT)
        fallbackT += 0.016
        fallbackRaf = requestAnimationFrame(loop)
      }
      fallbackRaf = requestAnimationFrame(loop)
    }

    const canvas = canvasRef.current
    if (!canvas) {
      startFallback()
      return () => cancelAnimationFrame(fallbackRaf)
    }

    startVectorWebGLScene(canvas, () => axesRef.current, () => cosRef.current)
      .then((stopWebGL) => {
        if (stopped) stopWebGL()
        else cleanup = stopWebGL
      })
      .catch(() => startFallback())

    return () => {
      stopped = true
      cleanup?.()
      cancelAnimationFrame(fallbackRaf)
    }
  }, [selDriver])

  if (loading) {
    return (
      <div style={{ maxWidth: '1560px', margin: '0 auto', padding: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <span style={{ fontSize: '14px', color: '#8b98ae' }}>벡터 데이터 로딩 중…</span>
      </div>
    )
  }

  if (error || !data || !selDriver) {
    return (
      <div style={{ maxWidth: '1560px', margin: '0 auto', padding: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <span style={{ fontSize: '14px', color: '#f87171' }}>{error ?? '데이터 없음'}</span>
      </div>
    )
  }

  const dims = selDriver.dims
  const f = dims[selected] ?? dims[0]
  const diff = f.drv - f.call
  const contrib = contribOf(f)
  const cc = data.callcard
  const drvLabel = `예시 기사 ${driverShortId(selDriver.id)}`
  const cosDisp = selDriver.cosineSimilarity.toFixed(3)
  const axisGroups = [
    { title: '시간대', count: '4축', source: `hour_slot = ${hourSlotLabel(cc.hourSlot)}`, rule: '새벽 · 오전 · 주간 · 야간 중 하나가 1' },
    { title: '요일', count: '7축', source: `weekday = ${weekdayLabel(cc.weekday)}`, rule: '월~일 중 해당 요일만 1' },
    { title: '거리', count: '3축', source: distanceLabel(cc.expectedDistance), rule: '단거리 · 중거리 · 장거리 구간화' },
    { title: '요금', count: '3축', source: 'expected_fare', rule: '저요금 · 중요금 · 고요금 구간화' },
    { title: '콜유형', count: '2축', source: 'is_paid', rule: '유료콜 / 무료콜 one-hot' },
    { title: '상품', count: '2축', source: 'is_surge', rule: '탄력 / 일반 one-hot' },
    { title: 'ETA', count: '1축', source: 'eta_distance', rule: '근접성을 0~1 값으로 정규화' },
  ]
  const similaritySteps = [
    { title: '1. 원천값을 축으로 변환', desc: '콜카드 조건과 기사 행동 집계값을 같은 22개 축 위에 올립니다.' },
    { title: '2. 축별 값 차이를 비교', desc: '같은 축에서 값이 가까울수록 두 벡터의 방향이 비슷해집니다.' },
    { title: '3. 벡터 각도를 계산', desc: '22D 전체 방향 차이를 cos θ로 압축합니다.' },
    { title: '4. 매칭 후보 정렬에 전달', desc: '여기서 계산된 유사도는 다음 매칭 스튜디오의 랭킹 입력으로 사용됩니다.' },
  ]

  const loadProjection = () => {
    if (projLoading) return
    setProjLoading(true)
    setProjError(null)
    fetch('/api/vector-workbench/embedding')
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) { setProjError(json.message ?? 'API 오류'); return }
        const d = json.data as EmbeddingData
        const rows = [d.callcardVector, ...d.points.map((p) => p.vector)]
        setProj({ coords: pca2(rows), points: d.points })
      })
      .catch((e) => setProjError(String(e)))
      .finally(() => setProjLoading(false))
  }

  return (
    <div className="vector-workbench-view" style={{ maxWidth: '1560px', margin: '0 auto', padding: '22px 22px 32px' }}>
      <style>{`
        @media (max-width: 1100px) {
          .vector-title,
          .vector-lens-header,
          .vector-projection-header {
            align-items: flex-start !important;
            flex-direction: column;
            gap: 12px;
          }
          .vector-kpi-grid,
          .vector-main-grid {
            grid-template-columns: 1fr !important;
          }
          .vector-candidate-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .vector-inspector {
            position: static !important;
          }
        }
        @media (max-width: 700px) {
          .vector-workbench-view {
            padding: 18px 16px 28px !important;
            overflow-x: hidden;
          }
          .vector-candidate-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .vector-kpi-value {
            font-size: 34px !important;
            white-space: nowrap;
          }
        }
      `}</style>
      {/* Page title */}
      <div className="vector-title" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <h1 style={{ fontSize: '31px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>벡터 워크벤치</h1>
          <p style={{ fontSize: '16px', color: '#8b98ae', margin: 0 }}>원천 값이 22개 축으로 바뀌고, 두 벡터가 유사도를 찾아가는 방식</p>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', display: 'inline-block' }} />
            <span style={{ fontSize: '14px', color: '#9aa7bd', fontWeight: 500 }}>콜카드 벡터</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa', display: 'inline-block' }} />
            <span style={{ fontSize: '14px', color: '#9aa7bd', fontWeight: 500 }}>기사 벡터 예시</span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="vector-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '15px 18px', borderRadius: '16px', background: 'rgba(10,15,25,.7)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#7c89a0' }}>22D 축 구성</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '22px', fontWeight: 700 }}>4+7+3+3+2+2+1</span>
          <span style={{ fontSize: '13px', color: '#8b98ae' }}>시간 · 요일 · 거리 · 요금 · 콜유형 · 상품 · ETA</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '15px 18px', borderRadius: '16px', background: 'rgba(10,15,25,.7)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#7c89a0' }}>콜카드 변환 예시</span>
          <span style={{ fontSize: '17px', fontWeight: 700 }}>{hourSlotLabel(cc.hourSlot)} · {weekdayLabel(cc.weekday)} · {distanceLabel(cc.expectedDistance)}</span>
          <span style={{ fontSize: '13px', color: '#8b98ae', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cc.passengerAddr ?? cc.callDate}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '15px 18px', borderRadius: '16px', background: 'linear-gradient(160deg, rgba(28,24,46,.7), rgba(10,15,25,.66))', border: '1px solid rgba(167,139,250,.32)', boxShadow: '0 18px 44px rgba(0,0,0,.4),0 0 26px rgba(167,139,250,.1)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#b79bff' }}>코사인 유사도</span>
          <span className="vector-kpi-value" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '38px', fontWeight: 700, lineHeight: 1, color: '#c3acff', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 22px rgba(167,139,250,.4)', whiteSpace: 'nowrap' }}>{cosDisp}</span>
          <span style={{ fontSize: '13px', color: '#8b98ae' }}>1에 가까울수록 두 벡터 방향이 가까움</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '15px 18px', borderRadius: '16px', background: 'rgba(10,15,25,.7)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#7c89a0' }}>축 해석 예시</span>
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#5ce0f0' }}>{f.label}</span>
          <span style={{ fontSize: '13px', color: '#8b98ae' }}>{f.group} 축 · 값 차이 {Math.abs(diff).toFixed(3)}</span>
        </div>
      </div>

      {/* 22D axis map + similarity flow */}
      <section style={{ borderRadius: '16px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.4)', padding: '16px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>22D 축 구성 지도</h2>
            <span style={{ fontSize: '14px', color: '#8b98ae' }}>콜카드 원천값과 기사 행동 집계값을 같은 축 체계로 맞춘 뒤 비교합니다.</span>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#7c89a0', flexShrink: 0 }}>total 22 axes</span>
        </div>
        <div className="vector-candidate-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: '8px', marginBottom: '14px' }}>
          {axisGroups.map((group) => (
            <div key={group.title} style={{ minHeight: '116px', borderRadius: '12px', background: 'rgba(16,22,35,.5)', border: '1px solid rgba(148,163,184,.1)', padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8edf6' }}>{group.title}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#5ce0f0' }}>{group.count}</span>
              </div>
              <span style={{ fontSize: '13px', color: '#9aa7bd' }}>{group.source}</span>
              <span style={{ fontSize: '13px', lineHeight: 1.4, color: '#7c89a0' }}>{group.rule}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px' }}>
          {similaritySteps.map((step) => (
            <div key={step.title} style={{ borderRadius: '12px', background: 'rgba(34,211,238,.045)', border: '1px solid rgba(34,211,238,.12)', padding: '11px 12px' }}>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#5ce0f0', marginBottom: '5px' }}>{step.title}</span>
              <span style={{ fontSize: '13px', lineHeight: 1.45, color: '#9aa7bd' }}>{step.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Vector explanation workbench */}
      <div className="vector-main-grid" style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr) 340px', gap: '13px', alignItems: 'start' }}>
        {/* Left: 22D factor list */}
        <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>축별 값 탐색</h2>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#7c89a0' }}>22 axes</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '560px', overflowY: 'auto', paddingRight: '2px' }}>
            {dims.map((dim, i) => {
              const isSel = i === selected
              const c = contribOf(dim)
              return (
                <button
                  key={dim.key}
                  onClick={() => setSelected(i)}
                  style={{
                    textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 11px', borderRadius: '10px',
                    background: isSel ? 'linear-gradient(150deg, rgba(20,38,50,.92), rgba(16,22,38,.9))' : 'rgba(16,22,35,.5)',
                    border: isSel ? '1px solid rgba(34,211,238,.5)' : '1px solid rgba(148,163,184,.09)',
                  }}
                >
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#6b778d', width: '56px', flexShrink: 0 }}>{dim.group}</span>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: isSel ? '#5ce0f0' : '#cdd6e6', minWidth: 0 }}>{dim.label}</span>
                  <span style={{ width: '54px', height: '5px', borderRadius: '3px', background: 'rgba(148,163,184,.14)', overflow: 'hidden', flexShrink: 0, display: 'block' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.round(c * 100)}%`, background: isSel ? 'linear-gradient(90deg,#22d3ee,#a78bfa)' : 'rgba(120,150,190,.5)' }} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Center: canvas + 22D bar chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
            <div className="vector-lens-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>코사인 유사도 렌즈 · 5축 요약</h2>
                <span style={{ fontSize: '14px', color: '#8b98ae' }}>두 특성이 얼마나 비슷한지 비교한 점수 — 22D를 5축으로 요약</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#8b98ae' }}>cos θ</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '34px', fontWeight: 700, color: '#c3acff', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 20px rgba(167,139,250,.4)' }}>{cosDisp}</span>
              </div>
            </div>
            <div style={{ position: 'relative', height: '460px', borderRadius: '14px', overflow: 'hidden', background: '#02040a', border: '1px solid rgba(148,163,184,.11)' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              <div style={{ position: 'absolute', left: 16, top: 14, display: 'flex', alignItems: 'center', gap: '8px', color: '#5ce0f0', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', fontWeight: 800, letterSpacing: '.02em', pointerEvents: 'none' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
                WEBGL VECTOR FIELD
              </div>
              <div style={{ position: 'absolute', right: 16, bottom: 14, color: '#c3acff', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', fontWeight: 800, pointerEvents: 'none' }}>
                22 AXES / COSINE DIRECTION
              </div>
            </div>
          </section>

          {/* 22D bar chart */}
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>22D 원본 벡터 비교</h2>
              <span style={{ fontSize: '13px', color: '#7c89a0' }}>콜카드 vs {drvLabel} · 같은 순서</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '96px' }}>
              {dims.map((dim, i) => {
                const isSel = i === selected
                return (
                  <div
                    key={dim.key}
                    onClick={() => setSelected(i)}
                    title={`${dim.label} · 콜 ${dim.call.toFixed(2)} / 기사 ${dim.drv.toFixed(2)}`}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', height: '100%', justifyContent: 'flex-end' }}
                  >
                    <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2px', height: '78px' }}>
                      <span style={{ width: '42%', borderRadius: '2px 2px 0 0', height: `${Math.max(2, Math.round(dim.call * 100))}%`, background: isSel ? '#5ce0f0' : 'rgba(34,211,238,.55)', display: 'inline-block' }} />
                      <span style={{ width: '42%', borderRadius: '2px 2px 0 0', height: `${Math.max(2, Math.round(dim.drv * 100))}%`, background: isSel ? '#c3acff' : 'rgba(167,139,250,.5)', display: 'inline-block' }} />
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: isSel ? '#9fb4cc' : '#5a6680', textAlign: 'center', lineHeight: 1.1 }}>{dim.label}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Right: Axis explanation */}
        <aside className="vector-inspector" style={{ display: 'flex', flexDirection: 'column', gap: '13px', position: 'sticky', top: '78px' }}>
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '4px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#5ce0f0', boxShadow: '0 0 8px #5ce0f0', display: 'inline-block' }} />
              <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>축 해석</h2>
            </div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#5ce0f0', margin: '8px 0 3px' }}>{f.label}</p>
            <p style={{ fontSize: '14px', color: '#8b98ae', marginBottom: '16px' }}>그룹: {f.group} · 차원 키: {f.key}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#9aa7bd' }}>콜카드 값</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '14px', fontWeight: 700, color: '#5ce0f0' }}>{f.call.toFixed(3)}</span>
                </div>
                <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(148,163,184,.12)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(f.call * 100)}%`, background: 'linear-gradient(90deg,#22d3ee,#3ddcef)', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#9aa7bd' }}>기사 행동 벡터 값</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '14px', fontWeight: 700, color: '#c3acff' }}>{f.drv.toFixed(3)}</span>
                </div>
                <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(148,163,184,.12)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(f.drv * 100)}%`, background: 'linear-gradient(90deg,#a78bfa,#c3acff)', borderRadius: '4px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', paddingTop: '6px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', padding: '11px 13px', borderRadius: '11px', background: 'rgba(20,28,42,.6)', border: '1px solid rgba(148,163,184,.12)' }}>
                  <span style={{ fontSize: '13px', color: '#7c89a0' }}>축 값 차이</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '18px', fontWeight: 700, color: Math.abs(diff) < 0.05 ? '#7ee0a3' : '#fbd77a' }}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(3)}
                  </span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', padding: '11px 13px', borderRadius: '11px', background: 'rgba(20,28,42,.6)', border: '1px solid rgba(148,163,184,.12)' }}>
                  <span style={{ fontSize: '13px', color: '#7c89a0' }}>방향 일치도</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '18px', fontWeight: 700, color: '#7ee0a3' }}>+{contrib.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </section>

          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '16px 20px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '12px' }}>계산 방식</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#22d3ee', width: '62px' }}>cosine</span>
                <span style={{ fontSize: '14px', color: '#9aa7bd' }}>22D 벡터의 방향 유사도</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#a78bfa', width: '62px' }}>near 1</span>
                <span style={{ fontSize: '14px', color: '#9aa7bd' }}>방향이 거의 같음</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#4ade80', width: '62px' }}>next</span>
                <span style={{ fontSize: '14px', color: '#9aa7bd' }}>매칭 스튜디오 랭킹 입력</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Embedding projection (PCA 2D) — opt-in / lazy to keep the page light */}
      <section style={{ marginTop: '16px', borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '16px 20px' }}>
        <div className="vector-projection-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>벡터 공간 투영 · PCA 2D</h2>
            <span style={{ fontSize: '14px', color: '#8b98ae' }}>22D 벡터를 2축으로 압축해 방향이 비슷한 표본이 어떻게 모이는지 봅니다.</span>
          </div>
          <button
            onClick={loadProjection}
            disabled={projLoading}
            style={{ fontFamily: 'inherit', cursor: projLoading ? 'default' : 'pointer', padding: '9px 14px', borderRadius: '10px', background: proj ? 'rgba(16,22,35,.6)' : 'linear-gradient(150deg, rgba(28,24,46,.92), rgba(16,22,38,.9))', border: '1px solid rgba(167,139,250,.4)', color: '#c3acff', fontSize: '14px', fontWeight: 700 }}
          >
            {projLoading ? '계산 중…' : proj ? '다시 계산' : 'PCA 투영 계산'}
          </button>
        </div>
        {projError ? <p style={{ fontSize: '12px', color: '#f87171', margin: '8px 0 0' }}>{projError}</p> : null}
        {proj ? (() => {
          const W = 1000, H = 320, pad = 34
          const xs = proj.coords.map((c) => c[0])
          const ys = proj.coords.map((c) => c[1])
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
          const sx = (x: number) => pad + ((x - minX) / ((maxX - minX) || 1)) * (W - 2 * pad)
          const sy = (y: number) => H - pad - ((y - minY) / ((maxY - minY) || 1)) * (H - 2 * pad)
          const callX = sx(proj.coords[0][0]), callY = sy(proj.coords[0][1])
          return (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '320px', display: 'block', marginTop: '10px' }} role="img" aria-label="PCA 임베딩 산점도">
              {proj.points.map((p, i) => {
                const [x, y] = proj.coords[i + 1]
                const cx = sx(x), cy = sy(y)
                if (p.id === selDriver.id) return <circle key={p.id} cx={cx} cy={cy} r={6} fill="#c3acff" stroke="#ffb454" strokeWidth={2.5} />
                if (p.isCandidate) return <circle key={p.id} cx={cx} cy={cy} r={4.5} fill="#a78bfa" stroke="rgba(195,172,255,.9)" strokeWidth={1.4} />
                return <circle key={p.id} cx={cx} cy={cy} r={2.6} fill="rgba(124,99,200,.5)" />
              })}
              <rect x={callX - 6} y={callY - 6} width={12} height={12} fill="#34d8ee" stroke="#0a1420" strokeWidth={1.5} transform={`rotate(45 ${callX} ${callY})`} />
            </svg>
          )
        })() : (projLoading
          ? <p style={{ fontSize: '14px', color: '#8b98ae', margin: '12px 0 0' }}>투영 계산 중…</p>
          : <p style={{ fontSize: '14px', color: '#7c89a0', margin: '10px 0 0' }}>버튼을 눌러 기사 벡터 표본을 2D로 투영합니다 (지연 로드).</p>)}
        {proj ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px', fontSize: '11px', color: '#9aa7bd' }}>
            <span style={{ color: '#34d8ee' }}>◆ 콜카드</span>
            <span style={{ color: '#c3acff' }}>● 비교 표본 기사</span>
            <span style={{ color: '#ffb454' }}>◉ 예시 기사</span>
            <span>배경 점 = 표본 기사 {proj.points.length}명</span>
          </div>
        ) : null}
      </section>
    </div>
  )
}

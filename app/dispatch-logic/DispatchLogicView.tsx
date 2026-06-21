'use client'

/* Dispatch Logic — AI 우선배차 레이어
 * Implements 배차 로직.dc.html design:
 *   SummaryBand (4 chips) + Pipeline (vertical timeline) + FormulaCard + DevNotes
 * Layout: max-width 1560px, two-column main grid (pipeline | formula+notes)
 */

const km = {
  cyan:        '#22d3ee',
  cyanBright:  '#5ce0f0',
  violet:      '#a78bfa',
  violetBright:'#c3acff',
  green:       '#4ade80',
  greenText:   '#7ee0a3',
  amber:       '#fbbf24',
  amberText:   '#fbd77a',
  red:         '#f87171',
  textHi:      '#e8edf6',
  textMid:     '#9aa7bd',
  textDim:     '#8b98ae',
  textFaint:   '#7c89a0',
  panel:       'rgba(9,14,23,.72)',
  border:      'rgba(148,163,184,.13)',
  borderHair:  'rgba(148,163,184,.09)',
}

const summaryBand = [
  {
    icon: '＋',
    iconBg: 'rgba(34,211,238,.14)',
    iconColor: km.cyanBright,
    borderColor: km.border,
    title: '추가 레이어',
    sub: '기존 배차 위에 얹는 우선 발송',
  },
  {
    icon: 'cos',
    iconBg: 'rgba(167,139,250,.16)',
    iconColor: km.violetBright,
    borderColor: 'rgba(167,139,250,.22)',
    title: '성향 유사도 75%',
    sub: '콜카드 ↔ 기사 22D 코사인',
    mono: true,
  },
  {
    icon: '⬡',
    iconBg: 'rgba(74,222,128,.14)',
    iconColor: km.greenText,
    borderColor: 'rgba(74,222,128,.20)',
    title: '공간 적합도 25%',
    sub: '출발·도착 H3 선호 적합',
  },
  {
    icon: '↺',
    iconBg: 'rgba(251,191,36,.14)',
    iconColor: km.amberText,
    borderColor: 'rgba(251,191,36,.20)',
    title: 'Fallback 보장',
    sub: '미수락 시 기존 배차',
  },
]

const steps = [
  {
    n: '01',
    title: '콜 발생',
    desc: 'call_id, asp_id, 출발·도착 H3, 예상거리/요금, ETA 조건, 호출 상품을 수신합니다.',
    tag: 'AI 레이어',
    tagColor: km.cyanBright,
    tagBg: 'rgba(34,211,238,.10)',
    numColor: '#05070d',
    numBg: `linear-gradient(180deg, ${km.cyan}, #1bb8d4)`,
    numBorder: 'none',
    numGlow: `0 4px 16px rgba(34,211,238,.30)`,
    lineColor: `linear-gradient(180deg, rgba(34,211,238,.4), rgba(167,139,250,.25))`,
    cardBg: 'rgba(14,22,36,.60)',
    cardBorder: `1px solid rgba(34,211,238,.22)`,
    code: null,
  },
  {
    n: '02',
    title: '후보 기사군 생성',
    desc: '기존 배차 엔진의 반경·지역·상태·정책 기준으로 후보군을 먼저 만듭니다. 이 단계는 기존 로직 그대로입니다.',
    tag: '기존 로직',
    tagColor: km.greenText,
    tagBg: 'rgba(74,222,128,.10)',
    numColor: '#05070d',
    numBg: km.green,
    numBorder: 'none',
    numGlow: `0 4px 14px rgba(74,222,128,.30)`,
    lineColor: `rgba(148,163,184,.20)`,
    cardBg: 'rgba(14,22,36,.60)',
    cardBorder: `1px solid rgba(74,222,128,.20)`,
    code: null,
  },
  {
    n: '03',
    title: '콜카드 임베딩',
    desc: '시간대·요일·거리·요금·상품·ETA 조건을 22차원 콜카드 벡터로 변환합니다.',
    tag: 'AI 레이어',
    tagColor: km.cyanBright,
    tagBg: 'rgba(34,211,238,.10)',
    numColor: '#05070d',
    numBg: `linear-gradient(180deg, ${km.violet}, #8a6eea)`,
    numBorder: 'none',
    numGlow: `0 4px 14px rgba(167,139,250,.30)`,
    lineColor: `rgba(148,163,184,.20)`,
    cardBg: 'rgba(14,22,36,.60)',
    cardBorder: `1px solid rgba(167,139,250,.20)`,
    code: 'callToVector(callcard)',
  },
  {
    n: '04',
    title: '기사 임베딩 조회',
    desc: 'driver_mbti 테이블에서 기사별 22D 누적 패턴 벡터와 데이터 신뢰도를 조회합니다.',
    tag: 'AI 레이어',
    tagColor: km.cyanBright,
    tagBg: 'rgba(34,211,238,.10)',
    numColor: '#05070d',
    numBg: km.amber,
    numBorder: 'none',
    numGlow: `0 4px 14px rgba(251,191,36,.30)`,
    lineColor: `rgba(148,163,184,.20)`,
    cardBg: 'rgba(14,22,36,.60)',
    cardBorder: `1px solid rgba(251,191,36,.18)`,
    code: 'driverToVector(driver_id)',
  },
  {
    n: '05',
    title: '유사도 + 공간 적합도 계산',
    desc: '22D 코사인 유사도(75%)와 출발·도착 H3 공간 적합도(25%)로 최종점수를 계산합니다.',
    tag: 'AI 레이어',
    tagColor: km.cyanBright,
    tagBg: 'rgba(34,211,238,.10)',
    numColor: '#05070d',
    numBg: `linear-gradient(180deg, ${km.cyan}, ${km.violet})`,
    numBorder: 'none',
    numGlow: `0 4px 14px rgba(34,211,238,.25)`,
    lineColor: `rgba(148,163,184,.20)`,
    cardBg: 'rgba(14,22,36,.60)',
    cardBorder: `1px solid rgba(34,211,238,.22)`,
    code: 'score = 0.75·cosine + 0.25·spatial',
  },
  {
    n: '06',
    title: 'Top N 정렬 → gridDisk 탐색',
    desc: '출발 H3 기준 탐색반경(gridDisk)으로 후보를 압축하고 최종점수 내림차순으로 정렬합니다.',
    tag: 'AI 레이어',
    tagColor: km.cyanBright,
    tagBg: 'rgba(34,211,238,.10)',
    numColor: '#05070d',
    numBg: `linear-gradient(180deg, ${km.cyan}, #1ab0ca)`,
    numBorder: 'none',
    numGlow: `0 4px 14px rgba(34,211,238,.25)`,
    lineColor: `rgba(148,163,184,.20)`,
    cardBg: 'rgba(14,22,36,.60)',
    cardBorder: `1px solid rgba(34,211,238,.22)`,
    code: 'gridDisk(originH3, k)',
  },
  {
    n: '07',
    title: '우선 발송',
    desc: '가장 잘 맞는 기사에게 먼저 콜카드를 발송합니다. 이 단계가 기존 배차와 달라지는 유일한 부분입니다.',
    tag: 'AI 레이어',
    tagColor: km.cyanBright,
    tagBg: 'rgba(34,211,238,.10)',
    numColor: '#05070d',
    numBg: `linear-gradient(180deg, ${km.cyan}, #19a8c0)`,
    numBorder: 'none',
    numGlow: `0 4px 14px rgba(34,211,238,.30)`,
    lineColor: `rgba(148,163,184,.20)`,
    cardBg: 'rgba(14,22,36,.60)',
    cardBorder: `1px solid rgba(34,211,238,.28)`,
    code: null,
  },
]

const formulaRows = [
  {
    label: '성향 유사도',
    sublabel: 'cosine(callcard 22D, driver 22D)',
    weight: '× 0.75',
    color: km.violetBright,
    bar: '75%',
    barColor: `linear-gradient(90deg, ${km.violet}, ${km.cyan})`,
  },
  {
    label: '공간 적합도',
    sublabel: 'originH3 45% + destH3 55%',
    weight: '× 0.25',
    color: km.greenText,
    bar: '25%',
    barColor: km.green,
  },
]

export function DispatchLogicView() {
  return (
    <div style={{
      maxWidth: 1560,
      margin: '0 auto',
      padding: '22px 22px 40px',
    }}>
      {/* Page title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
        <h1 style={{
          fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em',
          color: km.textHi, margin: 0,
        }}>
          배차 로직 — AI 우선배차 레이어
        </h1>
        <p style={{ fontSize: 14, color: km.textDim, maxWidth: 760, margin: 0 }}>
          기존 배차를 버리는 것이 아니다.{' '}
          <span style={{ color: km.cyanBright, fontWeight: 600 }}>
            콜 발생 시 가장 잘 받을 기사에게 먼저 콜카드를 보내는 레이어
          </span>
          를 앞단에 추가하고, 미수락이면 기존 순차·반경 배차로 자연스럽게 넘긴다.
        </p>
      </div>

      {/* Summary band */}
      <div style={{ display: 'flex', gap: 13, margin: '18px 0 22px', flexWrap: 'wrap' }}>
        {summaryBand.map((chip) => (
          <div key={chip.title} style={{
            flex: '1 1 200px',
            display: 'flex', alignItems: 'center', gap: 13,
            padding: '15px 18px',
            borderRadius: 14,
            background: 'rgba(10,15,25,.70)',
            border: `1px solid ${chip.borderColor}`,
          }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10,
              background: chip.iconBg, color: chip.iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, flex: 'none',
              fontFamily: chip.mono ? 'var(--km-font-mono)' : 'inherit',
            }}>
              {chip.icon}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: km.textHi }}>{chip.title}</span>
              <span style={{ fontSize: 12, color: km.textDim }}>{chip.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid: pipeline + right column */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 372px',
        gap: 13,
        alignItems: 'start',
      }}>
        {/* Pipeline */}
        <section style={{
          borderRadius: 18,
          background: km.panel,
          backdropFilter: 'blur(20px) saturate(135%)',
          WebkitBackdropFilter: 'blur(20px) saturate(135%)',
          border: `1px solid ${km.border}`,
          boxShadow: '0 22px 52px rgba(0,0,0,.45)',
          padding: '22px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: km.textHi }}>
              콜 발생 → 우선 발송 파이프라인
            </h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: km.cyan, display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: km.textMid }}>AI 우선배차 레이어</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: km.amber, display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: km.textMid }}>기존 배차 fallback</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((s, i) => (
              <div key={s.n} style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: 16 }}>
                {/* Rail */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{
                    width: 38, height: 38, borderRadius: 11, flex: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--km-font-mono)',
                    fontSize: 14, fontWeight: 700,
                    color: s.numColor,
                    background: s.numBg,
                    border: s.numBorder,
                    boxShadow: s.numGlow,
                  }}>
                    {s.n}
                  </span>
                  {i < steps.length - 1 && (
                    <span style={{
                      flex: 1, width: 2, minHeight: 22,
                      background: s.lineColor, margin: '4px 0',
                    }} />
                  )}
                </div>
                {/* Card */}
                <div style={{
                  marginBottom: i < steps.length - 1 ? 10 : 0,
                  padding: '14px 17px',
                  borderRadius: 13,
                  background: s.cardBg,
                  border: s.cardBorder,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: km.textHi }}>{s.title}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: s.tagColor,
                      background: s.tagBg, borderRadius: 5, padding: '2px 7px',
                    }}>
                      {s.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: km.textMid, lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
                  {s.code && (
                    <span style={{
                      display: 'inline-block', marginTop: 8,
                      fontFamily: 'var(--km-font-mono)', fontSize: 11,
                      color: '#7fd9ec',
                      background: 'rgba(34,211,238,.08)',
                      border: '1px solid rgba(34,211,238,.18)',
                      borderRadius: 6, padding: '4px 9px',
                    }}>
                      {s.code}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Branch outcome */}
            <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: 16, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: km.greenText, fontWeight: 800,
                  background: 'rgba(74,222,128,.14)',
                  border: '1px solid rgba(74,222,128,.40)',
                }}>✓</span>
              </div>
              <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
                {/* Success */}
                <div style={{
                  flex: '1 1 160px', padding: '14px 17px', borderRadius: 13,
                  background: 'linear-gradient(150deg, rgba(18,40,30,.70), rgba(12,20,16,.60))',
                  border: '1px solid rgba(74,222,128,.32)',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: km.greenText, margin: '0 0 4px' }}>수락 → 운행 시작</p>
                  <p style={{ fontSize: 12, color: km.textMid, margin: 0, lineHeight: 1.45 }}>
                    콜수락율 향상 이벤트 기록. 기존 배차 대비 개선 효과 검증.
                  </p>
                </div>
                {/* Fallback */}
                <div style={{
                  flex: '1 1 160px', padding: '14px 17px', borderRadius: 13,
                  background: 'linear-gradient(150deg, rgba(40,30,10,.70), rgba(20,16,6,.60))',
                  border: '1px solid rgba(251,191,36,.28)',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: km.amberText, margin: '0 0 4px' }}>미수락 → 기존 배차</p>
                  <p style={{ fontSize: 12, color: km.textMid, margin: 0, lineHeight: 1.45 }}>
                    순차·반경 확장 등 기존 배차 흐름으로 안전하게 넘긴다. Fallback은 항상 보장.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right column: Formula + Dev notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, position: 'sticky', top: 80 }}>
          {/* Formula card */}
          <section style={{
            borderRadius: 18,
            background: km.panel,
            backdropFilter: 'blur(20px) saturate(135%)',
            WebkitBackdropFilter: 'blur(20px) saturate(135%)',
            border: `1px solid ${km.border}`,
            boxShadow: '0 22px 52px rgba(0,0,0,.45)',
            padding: '18px 20px',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: km.textHi, margin: '0 0 14px' }}>최종점수 공식</h2>

            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(20,28,42,.60)',
              border: '1px solid rgba(148,163,184,.14)',
              marginBottom: 14,
            }}>
              <p style={{
                fontFamily: 'var(--km-font-mono)', fontSize: 13, fontWeight: 600,
                color: km.cyanBright, margin: 0, lineHeight: 1.6,
              }}>
                final = 0.75 · cosine(22D)
                <br />
                {'      '}+ 0.25 · spatial(H3)
              </p>
            </div>

            {formulaRows.map((row) => (
              <div key={row.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: km.textFaint, marginLeft: 8 }}>{row.sublabel}</span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--km-font-mono)', fontSize: 12, fontWeight: 700, color: row.color,
                  }}>{row.weight}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(148,163,184,.14)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: row.bar, borderRadius: 3, background: row.barColor }} />
                </div>
              </div>
            ))}

            {/* ETA warning */}
            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 9,
              background: 'rgba(248,113,113,.07)',
              border: '1px solid rgba(248,113,113,.22)',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ color: '#f87171', fontSize: 13, fontWeight: 700, flex: 'none' }}>⚠</span>
              <p style={{ fontSize: 12, color: km.textMid, margin: 0, lineHeight: 1.45 }}>
                외부 ETA는 최종점수에 미반영.
                화면에서 비교 참고값으로만 표시하며, amber 라벨 필수.
              </p>
            </div>
          </section>

          {/* Dev notes */}
          <section style={{
            borderRadius: 18,
            background: km.panel,
            backdropFilter: 'blur(20px) saturate(135%)',
            WebkitBackdropFilter: 'blur(20px) saturate(135%)',
            border: `1px solid ${km.border}`,
            boxShadow: '0 22px 52px rgba(0,0,0,.45)',
            padding: '18px 20px',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: km.textHi, margin: '0 0 12px' }}>개발자 전달 핵심</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '앞단 레이어', desc: '기존 배차를 대체하지 않는다. 후보군 안에서 순서만 바꾼다.', color: km.cyan },
                { label: '코사인 재사용', desc: 'cosineSimilarityForMatching() 기존 함수를 그대로 사용한다. UI에서 재구현 금지.', color: km.violetBright },
                { label: '목표 지표', desc: '콜수락율(수락 수 / 발송 수). 호출 수 총량이 아님.', color: km.greenText },
              ].map((note) => (
                <div key={note.label} style={{
                  padding: '11px 13px', borderRadius: 10,
                  background: 'rgba(20,28,42,.50)',
                  border: `1px solid rgba(148,163,184,.10)`,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: note.color, margin: '0 0 3px' }}>
                    {note.label}
                  </p>
                  <p style={{ fontSize: 12, color: km.textMid, margin: 0, lineHeight: 1.45 }}>
                    {note.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Responsive override */}
      <style>{`
        @media (max-width: 1100px) {
          .dispatch-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

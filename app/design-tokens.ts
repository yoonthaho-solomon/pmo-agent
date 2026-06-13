// Design tokens extracted from C:\Users\pgman\happycall\index.html :root{}
// Source of truth: happycall 인사이트/액션플랜 화면 카드 시스템

// ── 배경색 ──────────────────────────────────────────────
export const BG = {
  base:        '#080C18',               // body background
  card:        '#0F1628',               // .h-card, .v2-card, .v3-card background
  cardHover:   '#131D35',               // --bg-card-hover
  cardDanger:  'rgba(244,63,94,0.08)',  // --bg-card-danger
  cardSuccess: 'rgba(16,185,129,0.06)', // --bg-card-success
  header:      'rgba(8,12,24,0.95)',    // #topbar background (+ backdrop-filter:blur(20px))
  overlay:     'rgba(13,13,15,0.85)',   // .hud-l / .hud-r panel
}

// ── 테두리 ──────────────────────────────────────────────
export const BORDER = {
  default:  '#1E2D4A',               // --border
  hover:    '#2D4470',               // --border-hover
  danger:   'rgba(244,63,94,0.4)',   // --border-danger
  success:  'rgba(16,185,129,0.3)',  // --border-success
  subtle:   'rgba(30,45,74,0.5)',    // --line2
}

// ── 텍스트 색상 ─────────────────────────────────────────
export const TEXT = {
  primary:   '#F1F5F9',  // --text-primary  (KPI 숫자, 제목)
  secondary: '#94A3B8',  // --text-secondary (라벨, 본문)
  muted:     '#4E6080',  // --text-muted    (캡션, 단위, placeholder)
}

// ── 강조 색상 ────────────────────────────────────────────
export const COLOR = {
  cyan:   '#22D3EE',  // --cyan   (primary accent, 링크, 수치 강조)
  purple: '#8B5CF6',  // --purple (secondary accent, --acc)
  green:  '#10B981',  // --green  (성공, 긍정 지표)
  red:    '#F43F5E',  // --red    (위험, 부정 지표)
  yellow: '#F59E0B',  // --yellow (경고)
  blue:   '#3B82F6',  // --blue
  orange: '#FB923C',  // --orange
}

// ── 타이포그래피 ─────────────────────────────────────────
export const FONT = {
  family: "'Pretendard', -apple-system, sans-serif",  // --sans

  // 크기 (실제 :root 값)
  hero:    '72px',   // --font-hero    (최대 KPI 숫자)
  display: '48px',   // --font-display (대형 KPI)
  title:   '28px',   // --font-title   (섹션 타이틀)
  kpiCard: '28px',   // .kc-val font-size (카드 내 KPI 숫자)
  ciVal:   '20px',   // .ci-val (HUD 좌우 패널 수치)
  body:    '16px',   // --font-body (본문, base font-size)
  label:   '14px',   // --font-label (라벨, 캡션, 배지)
  caption: '14px',   // --font-caption
  micro:   '14px',   // --font-micro
  brand:   '15px',   // .tb-brand (헤더 로고)
  navBtn:  '13px',   // .nav-btn, .tb-report (헤더 버튼)

  // 굵기
  heavy:   800,      // --weight-heavy (KPI 숫자, 브랜드)
  bold:    700,      // --weight-bold
  medium:  500,      // --weight-medium / --weight-regular (base)
}

// ── 카드 형태 ────────────────────────────────────────────
export const CARD = {
  // .h-card / .v2-card / .v3-card 공통
  background:   '#0F1628',
  border:       '1px solid #1E2D4A',
  borderHover:  '1px solid #2D4470',
  radiusSm:     '8px',   // --radius-sm
  radiusMd:     '12px',  // --radius-md
  radiusLg:     '16px',  // --radius-lg  ← 카드 기본값
  padding:      '28px',  // --space-xl   ← .h-card, .v2-card, .v3-card padding
  paddingKpi:   '14px',  // .kc padding (KPI 2×2 서브카드)
  topBarHeight: '3px',   // .kc-bar (컬러 상단 강조선)
  transition:   'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
  hoverTranslateY: '-2px',
  animation:    'cardReveal 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards',
}

// ── 섹션 타이틀 (.panel-ttl / .v2-ttl) ──────────────────
export const SECTION_TITLE = {
  fontSize:      '14px',         // --font-label / --font-caption
  fontWeight:    700,
  letterSpacing: '0.06em',       // .panel-ttl: .06em  /  .v2-ttl: .1em
  textTransform: 'uppercase' as const,
  color:         '#94A3B8',      // --text-secondary
  // ::after 구분선
  lineHeight:    '1px',
  lineBackground: '#1E2D4A',
}

// ── 헤더 (#topbar) ───────────────────────────────────────
export const HEADER = {
  height:     '48px',
  background: 'rgba(8,12,24,0.95)',
  blur:       'blur(20px)',
  borderBottom: '1px solid #1E2D4A',
  padding:    '0 16px',
  zIndex:     50,

  // 좌 (tb-left): 브랜드 | 구분선(1px) | 날짜 | 구분선 | ASP필터
  left: {
    brandFontSize:   '15px',
    brandFontWeight: 800,
    brandGradient:   'linear-gradient(135deg, #22D3EE, #8B5CF6)',
    sepWidth:        '1px',
    sepHeight:       '16px',
    sepColor:        '#1E2D4A',
    dateFontSize:    '13px',
    dateColor:       '#94A3B8',
  },

  // 중 (tb-center): position:absolute; left:50%; transform:translateX(-50%)
  // 뷰 전환 탭 (.nav-btn)
  center: {
    navBtnHeight:    '28px',
    navBtnPadding:   '0 11px',
    navBtnRadius:    '8px',
    navBtnFontSize:  '13px',
    navBtnFontWeight: 600,
    navBtnColor:     '#4E6080',        // text-muted (기본)
    navBtnOnBg:      'rgba(139,92,246,0.2)',
    navBtnOnColor:   '#8B5CF6',
    navBtnOnBorder:  'rgba(139,92,246,0.4)',
  },

  // 우 (tb-right): 액션/이동 버튼 (.tb-report)
  right: {
    btnFontSize:   '13px',
    btnFontWeight: 600,
    btnColor:      '#94A3B8',
    btnBg:         'transparent',
    btnBorder:     '1px solid #1E2D4A',
    btnRadius:     '8px',
    btnPadding:    '4px 11px',
    btnHoverColor: '#F1F5F9',
    btnHoverBorder: '1px solid #2D4470',
    // 강조 이동 버튼 (누적 분석 →)
    accentBg:     'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(139,92,246,0.1))',
    accentColor:  '#22D3EE',
    accentBorder: 'rgba(34,211,238,0.3)',
  },
}

// ── 간격 ─────────────────────────────────────────────────
export const SPACE = {
  xs:  '8px',   // --space-xs
  sm:  '12px',  // --space-sm
  md:  '16px',  // --space-md
  lg:  '24px',  // --space-lg
  xl:  '28px',  // --space-xl  ← 카드 padding 기준
  xxl: '40px',  // --space-2xl
  // 카드 간 gap
  gridGap: '14px',  // .v2-wrap, .v3-wrap gap
}

// ── 앰비언트 라이트 (body::before/after) ─────────────────
export const AMBIENT = {
  cyan:   'radial-gradient(circle, rgba(34,211,238,0.09), transparent 70%)',
  purple: 'radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)',
}

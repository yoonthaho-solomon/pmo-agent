'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── 22차원 팩터 정의 ────────────────────────────────────
const FACTORS = [
  // 시간대 (4)
  { key: 'score_dawn',      label: '새벽형',  group: '시간대',  emoji: '🌙', desc: '00~05시' },
  { key: 'score_morning',   label: '오전형',  group: '시간대',  emoji: '🌅', desc: '06~11시' },
  { key: 'score_daytime',   label: '낮형',    group: '시간대',  emoji: '☀️', desc: '12~17시' },
  { key: 'score_night',     label: '야간형',  group: '시간대',  emoji: '🌆', desc: '18~23시' },
  // 요일 (7)
  { key: 'score_mon',       label: '월요일',  group: '요일',    emoji: '📅', desc: 'Monday' },
  { key: 'score_tue',       label: '화요일',  group: '요일',    emoji: '📅', desc: 'Tuesday' },
  { key: 'score_wed',       label: '수요일',  group: '요일',    emoji: '📅', desc: 'Wednesday' },
  { key: 'score_thu',       label: '목요일',  group: '요일',    emoji: '📅', desc: 'Thursday' },
  { key: 'score_fri',       label: '금요일',  group: '요일',    emoji: '📅', desc: 'Friday' },
  { key: 'score_sat',       label: '토요일',  group: '요일',    emoji: '📅', desc: 'Saturday' },
  { key: 'score_sun',       label: '일요일',  group: '요일',    emoji: '📅', desc: 'Sunday' },
  // 거리 (3)
  { key: 'score_short',     label: '단거리',  group: '거리',    emoji: '🚶', desc: '3km 미만' },
  { key: 'score_medium',    label: '중거리',  group: '거리',    emoji: '🚗', desc: '3~10km' },
  { key: 'score_long',      label: '장거리',  group: '거리',    emoji: '🛣️', desc: '10km 초과' },
  // 요금 (3)
  { key: 'score_low_fare',  label: '저요금',  group: '요금',    emoji: '💚', desc: '5,000원 미만' },
  { key: 'score_mid_fare',  label: '중요금',  group: '요금',    emoji: '💛', desc: '5,000~15,000원' },
  { key: 'score_high_fare', label: '고요금',  group: '요금',    emoji: '❤️', desc: '15,000원 초과' },
  // 유료/무료 (2)
  { key: 'score_paid',      label: '유료콜',  group: '콜유형',  emoji: '💳', desc: '콜카드 필요' },
  { key: 'score_free',      label: '무료콜',  group: '콜유형',  emoji: '🆓', desc: '일반 호출' },
  // 상품 (2)
  { key: 'score_normal',    label: '일반요금', group: '상품',   emoji: '🟦', desc: '기본 요금제' },
  { key: 'score_surge',     label: '탄력요금', group: '상품',   emoji: '🔴', desc: '수요 폭등' },
] as const;

type FactorKey = typeof FACTORS[number]['key'];
type AspId = 137000000000 | 147000000000 | 160000000000;

const ASP_MAP: Record<AspId, { name: string; short: string; color: string }> = {
  137000000000: { name: 'e음택시 (인천)',  short: 'e음',  color: '#22D3EE' },
  147000000000: { name: '행복콜택시 (천안)', short: '행복콜', color: '#8B5CF6' },
  160000000000: { name: '동백택시 (부산)', short: '동백',  color: '#10B981' },
};

interface DriverMBTI {
  driver_id: string;
  asp_id: number;
  score_dawn: number; score_morning: number; score_daytime: number; score_night: number;
  score_mon: number; score_tue: number; score_wed: number; score_thu: number;
  score_fri: number; score_sat: number; score_sun: number;
  score_short: number; score_medium: number; score_long: number;
  score_low_fare: number; score_mid_fare: number; score_high_fare: number;
  score_paid: number; score_free: number;
  score_normal: number; score_surge: number;
  score_loyalty: number;
  data_days: number;
  reliability: number;
}

interface CallCard {
  hour: number;
  weekday: number;
  distance: 'short' | 'medium' | 'long';
  fare_tier: 'low' | 'mid' | 'high';
  is_paid: boolean;
  product: 'normal' | 'surge';
  asp_id: AspId;
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const GROUP_COLORS: Record<string, string> = {
  '시간대': '#22D3EE',
  '요일': '#8B5CF6',
  '거리': '#10B981',
  '요금': '#FB923C',
  '콜유형': '#F43F5E',
  '상품': '#FBBF24',
};

// ── 콜카드 → 22차원 벡터 변환 ──────────────────────────
function callcardToVector(card: CallCard): Record<FactorKey, number> {
  const hour = card.hour;
  const vec: Record<string, number> = {};

  // 시간대
  vec.score_dawn    = hour >= 0  && hour <= 5  ? 1 : 0;
  vec.score_morning = hour >= 6  && hour <= 11 ? 1 : 0;
  vec.score_daytime = hour >= 12 && hour <= 17 ? 1 : 0;
  vec.score_night   = hour >= 18 && hour <= 23 ? 1 : 0;

  // 요일 (0=월)
  const days = ['score_mon','score_tue','score_wed','score_thu','score_fri','score_sat','score_sun'];
  days.forEach((d, i) => { vec[d] = card.weekday === i ? 1 : 0; });

  // 거리
  vec.score_short  = card.distance === 'short'  ? 1 : 0;
  vec.score_medium = card.distance === 'medium' ? 1 : 0;
  vec.score_long   = card.distance === 'long'   ? 1 : 0;

  // 요금
  vec.score_low_fare  = card.fare_tier === 'low'  ? 1 : 0;
  vec.score_mid_fare  = card.fare_tier === 'mid'  ? 1 : 0;
  vec.score_high_fare = card.fare_tier === 'high' ? 1 : 0;

  // 유료/무료
  vec.score_paid = card.is_paid ? 1 : 0;
  vec.score_free = card.is_paid ? 0 : 1;

  // 상품
  vec.score_normal    = card.product === 'normal'    ? 1 : 0;
  vec.score_surge     = card.product === 'surge'     ? 1 : 0;

  return vec as Record<FactorKey, number>;
}

// ── 코사인 유사도 계산 ──────────────────────────────────
function cosineSimilarity(
  callVec: Record<FactorKey, number>,
  driver: DriverMBTI
): number {
  const keys = FACTORS.map(f => f.key);
  let dot = 0, normA = 0, normB = 0;
  for (const k of keys) {
    const a = callVec[k] ?? 0;
    const b = (driver as unknown as Record<string, number>)[k] ?? 0;
    dot   += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── 레이더 차트 (SVG) ──────────────────────────────────
function RadarChart({
  data,
  color,
  size = 200,
}: {
  data: { label: string; value: number }[];
  color: string;
  size?: number;
}) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const n = data.length;
  const points = data.map((d, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + r * d.value * Math.cos(angle),
      y: cy + r * d.value * Math.sin(angle),
      lx: cx + (r + 22) * Math.cos(angle),
      ly: cy + (r + 22) * Math.sin(angle),
    };
  });
  const polyPts = points.map(p => `${p.x},${p.y}`).join(' ');

  // 배경 격자
  const grids = [0.25, 0.5, 0.75, 1.0];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {grids.map(g =>
        <polygon
          key={g}
          points={data.map((_, i) => {
            const a = (i / n) * 2 * Math.PI - Math.PI / 2;
            return `${cx + r * g * Math.cos(a)},${cy + r * g * Math.sin(a)}`;
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      )}
      {data.map((_, i) => {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2;
        return <line key={i}
          x1={cx} y1={cy}
          x2={cx + r * Math.cos(a)}
          y2={cy + r * Math.sin(a)}
          stroke="rgba(255,255,255,0.1)" strokeWidth="1"
        />;
      })}
      <polygon points={polyPts} fill={color + '44'} stroke={color} strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
      {points.map((p, i) => (
        <text key={i}
          x={p.lx} y={p.ly}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="8" fill="rgba(255,255,255,0.7)"
        >
          {data[i].label}
        </text>
      ))}
    </svg>
  );
}

// ── 팩터 바 ────────────────────────────────────────────
function FactorBar({
  label, value, color, emoji, desc, isActive,
}: {
  label: string; value: number; color: string; emoji: string; desc: string; isActive: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg transition-all"
      style={{ background: isActive ? color + '18' : 'transparent' }}>
      <span className="text-xl w-7 text-center">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-white">{label}</span>
          <span className="text-xs font-mono" style={{ color }}>{(value * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${value * 100}%`, background: isActive ? color : 'rgba(255,255,255,0.3)' }}
          />
        </div>
        <span className="text-xs text-white/40">{desc}</span>
      </div>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────
export default function SimulatorPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [card, setCard] = useState<CallCard>({
    hour: 8, weekday: 0, distance: 'medium', fare_tier: 'mid',
    is_paid: false, product: 'normal', asp_id: 147000000000,
  });
  const [callVec, setCallVec] = useState<Record<FactorKey, number> | null>(null);
  const [drivers, setDrivers] = useState<DriverMBTI[]>([]);
  const [topMatches, setTopMatches] = useState<{ driver: DriverMBTI; score: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [driverCount, setDriverCount] = useState(0);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // Step 2: 벡터 계산
  const handleGenVector = () => {
    const vec = callcardToVector(card);
    setCallVec(vec);
    setStep(2);
  };

  // Step 3: 매칭 계산
  const handleMatch = useCallback(async () => {
    if (!callVec) return;
    setLoading(true);
    try {
      // 해당 ASP 기사 MBTI 전체 로드 (reliability > 0.3 필터)
      const { data, error } = await supabase
        .from('driver_mbti')
        .select('*')
        .eq('asp_id', card.asp_id)
        .gte('reliability', 0.3)
        .gte('data_days', 3);

      if (error) throw error;
      const list = (data || []) as DriverMBTI[];
      setDrivers(list);
      setDriverCount(list.length);

      // 코사인 유사도 계산 후 Top 10
      const scored = list
        .map(d => ({ driver: d, score: cosineSimilarity(callVec, d) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      setTopMatches(scored);
      setStep(3);
    } finally {
      setLoading(false);
    }
  }, [callVec, card.asp_id]);

  const asp = ASP_MAP[card.asp_id];
  const factorGroups = Array.from(new Set(FACTORS.map(f => f.group)));

  // 레이더용 데이터
  const radarData = callVec ? [
    { label: '새벽', value: callVec.score_dawn },
    { label: '오전', value: callVec.score_morning },
    { label: '낮',   value: callVec.score_daytime },
    { label: '야간', value: callVec.score_night },
    { label: '단거리', value: callVec.score_short },
    { label: '중거리', value: callVec.score_medium },
    { label: '장거리', value: callVec.score_long },
    { label: '저요금', value: callVec.score_low_fare },
    { label: '중요금', value: callVec.score_mid_fare },
    { label: '고요금', value: callVec.score_high_fare },
    { label: '유료', value: callVec.score_paid },
    { label: '탄력', value: callVec.score_surge },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: '#080C18', color: 'white', fontFamily: 'Pretendard, sans-serif' }}>
      {/* 헤더 */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/dashboard" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 24, textDecoration: 'none' }}>←</a>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>PMO Agent</div>
            <div style={{ fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg, #22D3EE, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              MBTI 매칭 시뮬레이터
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: 40, height: 40, borderRadius: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700,
              background: step >= s ? (step === s ? '#22D3EE' : '#22D3EE44') : 'rgba(255,255,255,0.08)',
              color: step >= s ? '#000' : 'rgba(255,255,255,0.3)',
              border: step === s ? '2px solid #22D3EE' : '2px solid transparent',
            }}>
              {s}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 40px' }}>

        {/* ── STEP 1: 콜카드 입력 ── */}
        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>콜카드 정보 입력</div>
            <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>어떤 호출인지 설정하면, 어떤 기사와 잘 맞는지 찾아드립니다</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>

            {/* 플랫폼 */}
            <div style={{ background: '#0F1628', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.1em' }}>📍 플랫폼 선택</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.entries(ASP_MAP) as [string, { name: string; color: string }][]).map(([id, info]) => (
                  <button key={id}
                    onClick={() => setCard(c => ({ ...c, asp_id: Number(id) as AspId }))}
                    style={{
                      padding: '14px 18px', borderRadius: 10, border: `2px solid ${card.asp_id === Number(id) ? info.color : 'rgba(255,255,255,0.1)'}`,
                      background: card.asp_id === Number(id) ? info.color + '22' : 'transparent',
                      color: 'white', fontSize: 16, fontWeight: card.asp_id === Number(id) ? 700 : 400,
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                    }}>
                    <span style={{ color: info.color }}>●</span> {info.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 시간대 */}
            <div style={{ background: '#0F1628', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.1em' }}>🕐 호출 시각</div>
              <div style={{ marginBottom: 16 }}>
                <input type="range" min={0} max={23} value={card.hour}
                  onChange={e => setCard(c => ({ ...c, hour: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: '#22D3EE' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>0시</span>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#22D3EE' }}>{card.hour}시</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>23시</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  {card.hour < 6 ? '🌙 새벽' : card.hour < 12 ? '🌅 오전' : card.hour < 18 ? '☀️ 낮' : '🌆 야간'}
                </div>
              </div>

              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8, marginTop: 16, letterSpacing: '0.1em' }}>📅 요일</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {WEEKDAY_LABELS.map((d, i) => (
                  <button key={i}
                    onClick={() => setCard(c => ({ ...c, weekday: i }))}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8,
                      border: `2px solid ${card.weekday === i ? '#8B5CF6' : 'rgba(255,255,255,0.1)'}`,
                      background: card.weekday === i ? '#8B5CF622' : 'transparent',
                      color: card.weekday === i ? '#8B5CF6' : 'rgba(255,255,255,0.6)',
                      fontSize: 14, fontWeight: card.weekday === i ? 700 : 400,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* 거리/요금 */}
            <div style={{ background: '#0F1628', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.1em' }}>🗺️ 예상 거리</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { v: 'short',  label: '단거리', desc: '~3km',   emoji: '🚶' },
                  { v: 'medium', label: '중거리', desc: '3~10km', emoji: '🚗' },
                  { v: 'long',   label: '장거리', desc: '10km+',  emoji: '🛣️' },
                ].map(opt => (
                  <button key={opt.v}
                    onClick={() => setCard(c => ({ ...c, distance: opt.v as CallCard['distance'] }))}
                    style={{
                      flex: 1, padding: '14px 8px', borderRadius: 10,
                      border: `2px solid ${card.distance === opt.v ? '#10B981' : 'rgba(255,255,255,0.1)'}`,
                      background: card.distance === opt.v ? '#10B98122' : 'transparent',
                      color: 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                    }}>
                    <div style={{ fontSize: 22 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.1em' }}>💰 예상 요금</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { v: 'low',  label: '저요금', desc: '~5천원',  color: '#10B981' },
                  { v: 'mid',  label: '중요금', desc: '5~15천', color: '#FB923C' },
                  { v: 'high', label: '고요금', desc: '15천+',  color: '#F43F5E' },
                ].map(opt => (
                  <button key={opt.v}
                    onClick={() => setCard(c => ({ ...c, fare_tier: opt.v as CallCard['fare_tier'] }))}
                    style={{
                      flex: 1, padding: '14px 8px', borderRadius: 10,
                      border: `2px solid ${card.fare_tier === opt.v ? opt.color : 'rgba(255,255,255,0.1)'}`,
                      background: card.fare_tier === opt.v ? opt.color + '22' : 'transparent',
                      color: card.fare_tier === opt.v ? opt.color : 'rgba(255,255,255,0.6)',
                      cursor: 'pointer', textAlign: 'center', fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
                    }}>
                    <div style={{ fontSize: 14 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 콜 유형 / 상품 */}
            <div style={{ background: '#0F1628', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.1em' }}>📞 콜 유형</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { v: false, label: '무료콜', emoji: '🆓', desc: '일반 호출' },
                  { v: true,  label: '유료콜', emoji: '💳', desc: '콜카드 사용' },
                ].map(opt => (
                  <button key={String(opt.v)}
                    onClick={() => setCard(c => ({ ...c, is_paid: opt.v }))}
                    style={{
                      flex: 1, padding: '14px 8px', borderRadius: 10,
                      border: `2px solid ${card.is_paid === opt.v ? '#F43F5E' : 'rgba(255,255,255,0.1)'}`,
                      background: card.is_paid === opt.v ? '#F43F5E22' : 'transparent',
                      color: 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                    }}>
                    <div style={{ fontSize: 24 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.1em' }}>⚡ 요금 상품</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { v: 'normal',     label: '일반 요금',  emoji: '🟦', desc: '기본 미터 요금' },
                  { v: 'surge',      label: '탄력 요금',  emoji: '🔴', desc: '수요 급증 구간' },
                ].map(opt => (
                  <button key={opt.v}
                    onClick={() => setCard(c => ({ ...c, product: opt.v as CallCard['product'] }))}
                    style={{
                      padding: '12px 16px', borderRadius: 10,
                      border: `2px solid ${card.product === opt.v ? '#FBBF24' : 'rgba(255,255,255,0.1)'}`,
                      background: card.product === opt.v ? '#FBBF2422' : 'transparent',
                      color: 'white', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s',
                    }}>
                    <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</div>
                    </div>
                    {card.product === opt.v && <span style={{ marginLeft: 'auto', color: '#FBBF24', fontSize: 18 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={handleGenVector}
              style={{
                padding: '20px 60px', borderRadius: 14, fontSize: 22, fontWeight: 800,
                background: 'linear-gradient(135deg, #22D3EE, #8B5CF6)',
                color: 'white', border: 'none', cursor: 'pointer',
                boxShadow: '0 0 40px rgba(34,211,238,0.4)',
              }}>
              🔍 22차원 벡터 생성하기 →
            </button>
          </div>
        </div>

        {/* ── STEP 2: 22팩터 리스트업 ── */}
        {step >= 2 && callVec && (
          <div style={{ display: step === 2 ? 'block' : step === 3 ? 'grid' : 'none', gridTemplateColumns: '1fr 2fr', gap: 32 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                {step === 2 && <button onClick={() => setStep(1)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                  ← 다시 설정
                </button>}
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>STEP 2</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>22차원 콜카드 벡터</div>
                </div>
              </div>

              {/* 콜카드 요약 */}
              <div style={{ background: '#0F1628', borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${asp.color}44` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: asp.color, display: 'inline-block' }} />
                  <span style={{ fontWeight: 700, color: asp.color }}>{asp.name}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    `${card.hour}시`,
                    WEEKDAY_LABELS[card.weekday] + '요일',
                    card.distance === 'short' ? '단거리' : card.distance === 'medium' ? '중거리' : '장거리',
                    card.fare_tier === 'low' ? '저요금' : card.fare_tier === 'mid' ? '중요금' : '고요금',
                    card.is_paid ? '유료콜' : '무료콜',
                    card.product === 'normal' ? '일반요금' : '탄력요금',
                  ].map(tag => (
                    <span key={tag} style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 13,
                      background: 'rgba(255,255,255,0.08)', color: 'white',
                    }}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* 레이더 차트 */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <RadarChart data={radarData} color={asp.color} size={240} />
              </div>

              {/* 그룹 탭 */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={() => setActiveGroup(null)}
                  style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, border: `1px solid ${activeGroup === null ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`, background: 'transparent', color: activeGroup === null ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                  전체
                </button>
                {factorGroups.map(g => (
                  <button key={g} onClick={() => setActiveGroup(g === activeGroup ? null : g)}
                    style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, border: `1px solid ${activeGroup === g ? GROUP_COLORS[g] : 'rgba(255,255,255,0.2)'}`, background: activeGroup === g ? GROUP_COLORS[g] + '22' : 'transparent', color: activeGroup === g ? GROUP_COLORS[g] : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                    {g}
                  </button>
                ))}
              </div>

              {/* 팩터 리스트 */}
              <div style={{ background: '#0F1628', borderRadius: 16, padding: 12, maxHeight: 380, overflowY: 'auto' }}>
                {FACTORS
                  .filter(f => !activeGroup || f.group === activeGroup)
                  .map(f => (
                    <FactorBar
                      key={f.key}
                      label={f.label}
                      value={callVec[f.key]}
                      color={GROUP_COLORS[f.group]}
                      emoji={f.emoji}
                      desc={f.desc}
                      isActive={callVec[f.key] > 0}
                    />
                  ))}
              </div>

              {step === 2 && (
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <button onClick={handleMatch} disabled={loading}
                    style={{
                      padding: '18px 48px', borderRadius: 12, fontSize: 20, fontWeight: 800,
                      background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8B5CF6, #F43F5E)',
                      color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 0 40px rgba(139,92,246,0.4)',
                    }}>
                    {loading ? '⏳ 매칭 계산 중...' : '🎯 최적 기사 매칭 시작 →'}
                  </button>
                </div>
              )}
            </div>

            {/* ── STEP 3: 매칭 결과 ── */}
            {step === 3 && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>STEP 3</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>최적 기사 매칭 결과</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    {asp.name} · 분석 대상 {driverCount.toLocaleString()}명 · Top 10
                  </div>
                </div>

                {/* 분포 요약 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: '최고 유사도', value: topMatches[0] ? (topMatches[0].score * 100).toFixed(1) + '%' : '-', color: '#22D3EE' },
                    { label: '평균 유사도', value: topMatches.length ? (topMatches.reduce((a, b) => a + b.score, 0) / topMatches.length * 100).toFixed(1) + '%' : '-', color: '#8B5CF6' },
                    { label: '분석 기사 수', value: driverCount.toLocaleString() + '명', color: '#10B981' },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: '#0F1628', borderRadius: 12, padding: '16px 20px', border: `1px solid ${stat.color}33` }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{stat.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Top 10 기사 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topMatches.map(({ driver, score }, idx) => {
                    const pct = score * 100;
                    const rankColor = idx === 0 ? '#FBBF24' : idx === 1 ? '#94A3B8' : idx === 2 ? '#FB923C' : '#22D3EE';
                    // 기사 강점 요인 추출
                    const strengths = FACTORS
                      .filter(f => (driver as unknown as Record<string, number>)[f.key] > 0.5 && callVec[f.key] > 0)
                      .sort((a, b) => (driver as unknown as Record<string, number>)[b.key] - (driver as unknown as Record<string, number>)[a.key])
                      .slice(0, 3);

                    return (
                      <div key={driver.driver_id} style={{
                        background: '#0F1628', borderRadius: 14, padding: '16px 20px',
                        border: `1px solid ${idx === 0 ? '#FBBF2466' : 'rgba(255,255,255,0.06)'}`,
                        display: 'grid', gridTemplateColumns: '48px 1fr auto',
                        alignItems: 'center', gap: 16,
                      }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 24,
                          background: rankColor + '22', border: `2px solid ${rankColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 20, fontWeight: 900, color: rankColor,
                        }}>
                          {idx + 1}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{driver.driver_id}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>데이터 {driver.data_days}일</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>신뢰도 {(driver.reliability * 100).toFixed(0)}%</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {strengths.map(f => (
                              <span key={f.key} style={{
                                padding: '2px 8px', borderRadius: 10, fontSize: 11,
                                background: GROUP_COLORS[f.group] + '22',
                                color: GROUP_COLORS[f.group], border: `1px solid ${GROUP_COLORS[f.group]}44`,
                              }}>
                                {f.emoji} {f.label}
                              </span>
                            ))}
                          </div>
                          {/* 유사도 바 */}
                          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: rankColor, width: `${pct}%`, transition: 'width 1s ease' }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 30, fontWeight: 900, color: rankColor, fontVariantNumeric: 'tabular-nums' }}>
                            {pct.toFixed(1)}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>% 유사도</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 리셋 */}
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button onClick={() => { setStep(1); setCallVec(null); setTopMatches([]); }}
                    style={{ flex: 1, padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', cursor: 'pointer' }}>
                    🔄 처음부터 다시
                  </button>
                  <button onClick={() => setStep(2)}
                    style={{ flex: 1, padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 700, background: 'rgba(139,92,246,0.2)', border: '1px solid #8B5CF6', color: '#8B5CF6', cursor: 'pointer' }}>
                    ← 벡터 보기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

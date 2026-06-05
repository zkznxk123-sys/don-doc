'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Sparkles, Shield, BarChart3, AlertCircle, ArrowRight,
} from 'lucide-react'
import { CountUp } from './CountUp'

// ── 디자인 토큰 (다크 럭셔리, 라이브 모드 무관 고정) ──────────────────────────
const BG = '#0B0F0E'
const BG_2 = '#11171A'
const BG_3 = '#070A09'
const ACCENT = '#B49B3E'      // gold
const FOREST = '#2F5D4F'      // muted forest green
const CREAM = '#F1ECE3'
const CREAM_DIM = 'rgba(241,236,227,0.6)'
const CREAM_FAINT = 'rgba(241,236,227,0.12)'
const POSITIVE = '#7CC9A9'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 데모 에러 배너 (signup_error 등 쿼리 처리)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DemoErrorBanner() {
  const params = useSearchParams()
  const err = params.get('demo_error')
  if (!err) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-md bg-red-950/60 border border-destructive/40 text-sm text-red-200 shadow-2xl backdrop-blur">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {err === 'not_seeded'
        ? '데모 데이터가 준비되지 않았습니다. 관리자에게 문의하세요.'
        : '데모 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HERO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Hero() {
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.3 })
  const [t, setT] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      setT((now - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = heroRef.current?.getBoundingClientRect()
    if (!r) return
    setMouse({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }

  const float = (phase: number, amp = 6) => ({
    transform: `translateY(${Math.sin(t * 0.7 + phase) * amp}px)`,
  })

  return (
    <div
      ref={heroRef}
      onMouseMove={handleMove}
      className="relative px-6 md:px-14 pt-14 pb-20 lg:min-h-[640px] overflow-hidden"
    >
      {/* spotlight following cursor */}
      <div
        className="pointer-events-none absolute w-[1100px] h-[1100px] -translate-x-1/2 -translate-y-1/2 transition-[top,left] duration-500 ease-out"
        style={{
          top: `${mouse.y * 100}%`,
          left: `${mouse.x * 100}%`,
          background: `radial-gradient(circle, rgba(180,155,62,0.10) 0%, rgba(47,93,79,0.05) 35%, transparent 65%)`,
          filter: 'blur(40px)',
        }}
      />

      <div className="relative z-10 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center max-w-7xl mx-auto">
        {/* LEFT — copy */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <p
            className="text-[11px] tracking-[0.16em] uppercase font-semibold mb-6 inline-flex items-center gap-2"
            style={{ color: ACCENT }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: ACCENT,
                boxShadow: '0 0 12px rgba(180,155,62,0.9)',
                animation: 'cpDot 1.6s ease-in-out infinite',
              }}
            />
            한 사람의 자산 본부 · AI 자동 분류
          </p>

          <h1
            className="font-serif font-medium leading-[1.05] tracking-[-0.025em] text-[44px] sm:text-[56px] lg:text-[68px]"
            style={{ color: CREAM }}
          >
            흩어진 자산을
            <br />
            <span
              className="font-serif italic font-normal"
              style={{ color: ACCENT }}
            >
              한 화면에.
            </span>
            <br />
            시간은 최소로.
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
            className="text-base lg:text-[16px] leading-[1.65] mt-7 max-w-[520px]"
            style={{ color: CREAM_DIM }}
          >
            현금·금융·부동산·연금·부채와 거래 내역을 한 곳에 모으고, AI가 분류 → 분석 → 시나리오 → 실행까지 연결합니다. 혼자 써도 충분하고, 필요하면 가족·동업자와 선별적으로 공유합니다.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
            className="flex flex-wrap gap-2.5 mt-9"
          >
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[13px] font-semibold transition-all active:scale-[0.97] hover:opacity-90"
              style={{ background: CREAM, color: BG }}
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="/demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[13px] font-medium transition-all hover:bg-white/5 active:scale-[0.97]"
              style={{ color: CREAM, border: `1px solid ${CREAM_FAINT}` }}
            >
              데모 둘러보기
            </a>
          </motion.div>

          {/* 측정 가능한 결과 — 사용자 가치 정량 목표 */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.45, ease: 'easeOut' }}
            className="flex flex-wrap gap-x-12 gap-y-6 mt-12 pt-7"
            style={{ borderTop: `1px solid ${CREAM_FAINT}` }}
          >
            {[
              { l: 'AI 자동분류 정확도', v: <CountUp to={92} suffix="%" /> },
              { l: '월 거래 분류 시간', v: <><span style={{ fontVariantNumeric: 'tabular-nums' }}><CountUp to={3} /></span><span style={{ fontSize: '0.55em', color: CREAM_DIM, fontWeight: 400 }}> h → </span><span style={{ fontVariantNumeric: 'tabular-nums' }}><CountUp to={30} /></span><span style={{ fontSize: '0.55em', color: CREAM_DIM, fontWeight: 400 }}> 분</span></> },
              { l: '통합 자산', v: <><span style={{ fontVariantNumeric: 'tabular-nums' }}><CountUp to={5} /></span><span style={{ fontSize: '0.55em', color: CREAM_DIM, fontWeight: 400 }}> 종 · 현금·금융·부동산·연금·부채</span></> },
            ].map(s => (
              <div key={s.l}>
                <p
                  className="text-[10px] tracking-[0.16em] uppercase font-semibold m-0"
                  style={{ color: ACCENT }}
                >
                  {s.l}
                </p>
                <p
                  className="font-serif font-medium m-0 mt-1.5 tracking-[-0.02em] text-[32px] lg:text-[36px]"
                  style={{ color: CREAM }}
                >
                  {s.v}
                </p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* RIGHT — diverse product preview (3 service slices) */}
        <div className="relative h-[540px] sm:h-[600px]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 rounded-[20px] overflow-hidden flex flex-col"
            style={{
              background: 'linear-gradient(160deg, #1A2422 0%, #0E1413 100%)',
              border: `1px solid ${CREAM_FAINT}`,
              boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(241,236,227,0.06)',
            }}
          >
            {/* faux toolbar with section pills */}
            <div
              className="flex items-center justify-between px-[18px] py-[12px] flex-shrink-0"
              style={{ borderBottom: `1px solid ${CREAM_FAINT}`, background: 'rgba(0,0,0,0.3)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-[22px] h-[22px] rounded-md inline-flex items-center justify-center flex-shrink-0"
                  style={{ background: FOREST }}
                >
                  <Sparkles className="w-3 h-3" style={{ color: CREAM }} />
                </span>
                <span className="text-[10px] font-semibold" style={{ color: CREAM }}>
                  돈Doc 데모
                </span>
              </div>
              <div className="flex gap-1 text-[9px]">
                {['대시보드', '현금흐름', '자산', '시나리오'].map((p, i) => (
                  <span
                    key={p}
                    className="px-2 py-1 rounded-md font-medium"
                    style={
                      i === 0
                        ? { background: ACCENT, color: BG }
                        : { color: CREAM_DIM, background: 'rgba(241,236,227,0.04)' }
                    }
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* 3 stacked service slices */}
            <div className="p-[14px] flex flex-col gap-2.5 flex-1 overflow-hidden">

              {/* SLICE 1 — 통합 대시보드 (compact) */}
              <div
                className="rounded-[12px] p-[14px]"
                style={{ background: 'rgba(241,236,227,0.03)', border: `1px solid ${CREAM_FAINT}` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      className="text-[9px] tracking-[0.14em] uppercase font-semibold m-0 flex items-center gap-1.5"
                      style={{ color: ACCENT }}
                    >
                      <span
                        className="w-1 h-1 rounded-full"
                        style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }}
                      />
                      가족 순자산
                    </p>
                    <p
                      className="font-serif font-medium m-0 mt-1 tracking-[-0.02em] leading-none text-[28px]"
                      style={{ color: CREAM, fontVariantNumeric: 'tabular-nums' }}
                    >
                      <CountUp to={12.8} decimals={1} suffix="억" duration={2000} />
                    </p>
                    <p className="text-[10px] m-0 mt-1 font-medium" style={{ color: POSITIVE }}>
                      ↑ +1,840만 전월
                    </p>
                  </div>
                  <svg viewBox="0 0 160 50" className="w-[120px] h-[44px]">
                    <defs>
                      <linearGradient id="cpSpark" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 35 L 20 32 L 40 34 L 60 24 L 80 27 L 100 18 L 120 20 L 140 10 L 160 8 L 160 50 L 0 50 Z"
                      fill="url(#cpSpark)"
                    />
                    <path
                      d="M 0 35 L 20 32 L 40 34 L 60 24 L 80 27 L 100 18 L 120 20 L 140 10 L 160 8"
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth="1.5"
                      strokeDasharray="300"
                      style={{ animation: 'cpDraw 1.6s ease-out 0.6s both' }}
                    />
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                  {[
                    { l: '부동산', v: '14.5억' },
                    { l: '금융', v: '1.1억' },
                    { l: '부채', v: '-2.8억' },
                  ].map(c => (
                    <div key={c.l} className="text-center py-1.5 rounded-md" style={{ background: 'rgba(241,236,227,0.03)' }}>
                      <p className="text-[8px] m-0 tracking-[0.1em] uppercase" style={{ color: CREAM_DIM }}>
                        {c.l}
                      </p>
                      <p className="text-[11px] m-0 mt-0.5 font-semibold" style={{ color: CREAM, fontVariantNumeric: 'tabular-nums' }}>
                        {c.v}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SLICE 2 — AI 자동분류 거래 */}
              <div
                className="rounded-[12px] p-[14px]"
                style={{ background: 'rgba(241,236,227,0.03)', border: `1px solid ${CREAM_FAINT}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p
                    className="text-[9px] tracking-[0.14em] uppercase font-semibold m-0 flex items-center gap-1.5"
                    style={{ color: ACCENT }}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    AI 자동 분류 (HITL)
                  </p>
                  <span className="text-[9px] font-medium" style={{ color: POSITIVE }}>
                    92% 정확도
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { d: '스타벅스 강남R점', cat: '카페', tone: '#C28A4A', amt: '-6,800' },
                    { d: '카카오T 일반택시', cat: '교통', tone: FOREST, amt: '-12,400' },
                    { d: '쿠팡 정기배송', cat: '식비', tone: '#7CC9A9', amt: '-58,900' },
                  ].map(t => (
                    <div key={t.d} className="flex items-center gap-2">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                        style={{ background: `${t.tone}22`, color: t.tone, minWidth: 36, textAlign: 'center' }}
                      >
                        {t.cat}
                      </span>
                      <span className="text-[10px] flex-1 truncate" style={{ color: CREAM }}>
                        {t.d}
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: CREAM_DIM, fontVariantNumeric: 'tabular-nums' }}>
                        {t.amt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SLICE 3 — AI 시나리오 카드 */}
              <div
                className="rounded-[12px] p-[14px] flex-1 flex flex-col"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}14 0%, rgba(241,236,227,0.03) 100%)`,
                  border: `1px solid ${ACCENT}40`,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p
                    className="text-[9px] tracking-[0.14em] uppercase font-semibold m-0 flex items-center gap-1.5"
                    style={{ color: ACCENT }}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    AI 시나리오 추천
                  </p>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${ACCENT}26`, color: ACCENT }}>
                    부동산
                  </span>
                </div>
                <p className="font-serif font-medium text-[15px] m-0 mt-1 tracking-[-0.01em]" style={{ color: CREAM }}>
                  3년 내 강북 → 강남 갈아타기
                </p>
                <p className="text-[10px] m-0 mt-1.5 leading-[1.5]" style={{ color: CREAM_DIM }}>
                  현재 자산·부채·여유자금 기준 시뮬레이션. 5단계 액션 플랜 자동 생성.
                </p>
                <div className="mt-auto pt-2 flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px]" style={{ color: CREAM_DIM }}>실현 타당도</span>
                      <span className="text-[9px] font-semibold" style={{ color: ACCENT }}>78%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: CREAM_FAINT }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: '78%', background: ACCENT }}
                      />
                    </div>
                  </div>
                  <span className="text-[9px] font-medium px-2 py-1 rounded-md flex-shrink-0" style={{ background: CREAM, color: BG }}>
                    실행 →
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* floating chips */}
          {/* floating accents — 카드 영역과 겹치지 않도록 외곽에 배치 */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.85 }}
            className="absolute -right-3 top-[180px] rounded-full px-4 py-2 text-[11px] font-semibold inline-flex items-center gap-2 shadow-2xl"
            style={{ background: FOREST, color: CREAM, ...float(2.4, 6) }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: POSITIVE }}
            />
            가족 4명 데이터 통합
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="absolute -left-3 -bottom-3 rounded-full px-4 py-2 text-[11px] font-semibold inline-flex items-center gap-2 shadow-2xl"
            style={{
              background: BG_3,
              color: CREAM,
              border: `1px solid ${ACCENT}`,
              ...float(4, 5),
            }}
          >
            <span style={{ color: ACCENT }}>실행하는 AI</span>
            <span style={{ color: CREAM_DIM, fontWeight: 400 }}>· 다음 단계</span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION WRAPPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Section({
  kicker,
  title,
  body,
  children,
  bg,
}: {
  kicker: string
  title: React.ReactNode
  body?: string
  children?: React.ReactNode
  bg: string
}) {
  return (
    <section
      className="relative px-6 md:px-14 py-20 md:py-[100px]"
      style={{ background: bg }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-20 items-start">
          <div>
            <p
              className="text-[11px] tracking-[0.18em] uppercase font-semibold m-0 mb-5"
              style={{ color: ACCENT }}
            >
              {kicker}
            </p>
            <h2
              className="font-serif font-medium m-0 leading-[1.05] tracking-[-0.025em] text-[40px] sm:text-[48px] lg:text-[56px]"
              style={{ color: CREAM }}
            >
              {title}
            </h2>
          </div>
          {body && (
            <p
              className="text-base lg:text-[16px] leading-[1.7] m-0 pt-3 max-w-[540px]"
              style={{ color: CREAM_DIM }}
            >
              {body}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LANDING PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: BG, color: CREAM, fontFamily: 'var(--font-sans)' }}
    >
      {/* keyframes — global to this landing only */}
      <style jsx global>{`
        @keyframes cpDot { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes cpTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes cpDraw { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }
      `}</style>

      <Suspense><DemoErrorBanner /></Suspense>

      {/* ── ANNOUNCEMENT BAR ───────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-2.5 px-6 md:px-14 py-2.5 text-[12px] text-center"
        style={{ background: BG_3, color: CREAM, borderBottom: `1px solid ${CREAM_FAINT}` }}
      >
        <span
          className="text-[10px] tracking-[0.14em] uppercase font-semibold"
          style={{ color: ACCENT }}
        >
          데모
        </span>
        <span style={{ color: 'rgba(241,236,227,0.78)' }}>로그인 없이 데모 즉시 체험 가능</span>
        <a
          href="/demo"
          className="underline font-medium hover:opacity-80"
          style={{ color: CREAM }}
        >
          데모 열기 →
        </a>
      </div>

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-14 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/brand-mark-dark.svg"
              alt="돈Doc"
              width={32}
              height={32}
              priority
            />
            <span className="font-black text-[16px] tracking-[-0.02em]" style={{ color: CREAM }}>
              돈Doc
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/demo"
            className="hidden sm:inline-flex text-[12px] px-3 py-1.5 hover:opacity-80"
            style={{ color: CREAM_DIM }}
          >
            데모
          </a>
          <Link
            href="/sign-in"
            className="text-[12px] px-3 py-1.5 hover:opacity-80"
            style={{ color: CREAM_DIM }}
          >
            로그인
          </Link>
          <Link
            href="/sign-up"
            className="text-[12px] font-semibold px-[18px] py-2.5 rounded-full transition hover:opacity-90"
            style={{ background: CREAM, color: BG }}
          >
            무료 시작
          </Link>
        </div>
      </nav>

      <Hero />

      {/* ── TECH STACK STRIP ────────────────────────────────────────────────── */}
      <div
        className="relative py-8 md:py-10"
        style={{ borderTop: `1px solid ${CREAM_FAINT}`, borderBottom: `1px solid ${CREAM_FAINT}` }}
      >
        <p
          className="text-[11px] tracking-[0.18em] uppercase text-center m-0 mb-6"
          style={{ color: CREAM_DIM }}
        >
          엔드 투 엔드로 직접 설계 · 구현
        </p>
        <div className="overflow-hidden whitespace-nowrap">
          <div
            className="inline-flex gap-14 items-center"
            style={{ animation: 'cpTicker 24s linear infinite' }}
          >
            {[...Array(2)].flatMap((_, copy) =>
              ['Next.js 14', 'Prisma 5', 'PostgreSQL', 'Clerk', 'Vercel AI SDK', 'CLIProxyAPI', 'Tailwind', 'shadcn/ui', 'Zod', 'Recharts'].map((p, i) => (
                <span
                  key={`${copy}-${i}`}
                  className="font-serif font-medium tracking-[-0.02em] text-[20px] sm:text-[22px]"
                  style={{
                    color: 'rgba(241,236,227,0.4)',
                    fontStyle: i % 3 === 0 ? 'italic' : 'normal',
                  }}
                >
                  {p}
                </span>
              )),
            )}
          </div>
        </div>
      </div>

      {/* ── APPROACH — AI 4-STEP PIPELINE ─────────────────────────────────── */}
      <Section
        kicker="설계 철학"
        title={
          <>
            AI를 호출이 아닌,
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              4단계 파이프라인
            </span>
            으로
          </>
        }
        body="단순한 LLM 콜이 아니라 — 데이터 구조화 → 반복업무 자동화 → 분석·시나리오 → 실행 검증까지. 사용자 상황에 맞는 모델 선택과 결과 검증까지 포함한 의사결정 구조로 설계했습니다."
        bg={BG}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-12">
          {[
            { n: '01', t: '데이터 구조화', d: '엑셀·앱 등 비정형 데이터를 AI가 처리 가능한 구조로 변환', tone: ACCENT },
            { n: '02', t: '반복업무 자동화', d: '거래 분류·정리 등 반복 작업을 AI 자동화로 대체', tone: FOREST },
            { n: '03', t: '분석 → 실행 연결', d: '분석 결과를 실행 가능한 행동(시나리오·액션 플랜)으로 변환', tone: '#8B6E1E' },
            { n: '04', t: '실행 구조 검증', d: '모델 라우팅 + 비용 최적화 + HITL로 신뢰성 확보', tone: '#5A4830' },
          ].map(p => (
            <div
              key={p.n}
              className="rounded-[18px] p-[22px] flex flex-col justify-between min-h-[260px]"
              style={{
                background: `linear-gradient(180deg, ${p.tone}22 0%, ${BG_2} 100%)`,
                border: `1px solid ${CREAM_FAINT}`,
              }}
            >
              <div
                className="font-serif font-medium text-[36px] tracking-[-0.02em] mb-3.5"
                style={{ color: p.tone }}
              >
                {p.n}
              </div>
              <div>
                <p
                  className="font-serif font-medium text-[22px] m-0 tracking-[-0.02em]"
                  style={{ color: CREAM }}
                >
                  {p.t}
                </p>
                <p className="text-[12px] m-0 mt-2 leading-[1.6]" style={{ color: CREAM_DIM }}>
                  {p.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 4 CORE FEATURES (deck slide 10) ─────────────────────────────────── */}
      <Section
        kicker="구현된 4가지"
        title={
          <>
            모으기 → 정리하기 →
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              분석하기 → 실행하기
            </span>
          </>
        }
        body="흩어진 자산을 한곳에 모으고, AI가 정리·분석·실행까지 연결하는 웹 기반 자산 운영 시스템. 혼자 써도 충분하고, 필요하면 가족·동업자와 선별 공유."
        bg={BG_2}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-12">
          {[
            {
              Icon: BarChart3,
              t: '가족 자산 통합 대시보드',
              d: '가족 구성원의 자산·부채·현금흐름을 한 화면에서 통합 조회. 순자산·월간 흐름·자산구성을 즉시 파악.',
            },
            {
              Icon: Sparkles,
              t: '현금흐름 + AI 자동분류',
              d: '엑셀 업로드 → AI가 카테고리 자동 분류·구조화. 사용자 검증·수정 루프(HITL)로 정확도 지속 개선.',
            },
            {
              Icon: ArrowRight,
              t: 'AI 시나리오 허브',
              d: '관심 컨텐츠 + 자산 데이터를 결합해 가족 라이프 이벤트(주택·은퇴·교육)별 시뮬레이션과 액션 플랜 자동 생성.',
            },
            {
              Icon: Shield,
              t: '가족 커뮤니케이션 + AI 대화',
              d: '같은 데이터를 함께 보고, AI 채팅으로 시나리오를 구체화. 거래 카드 첨부·멘션·댓글로 의사결정 가속.',
            },
          ].map(s => (
            <div
              key={s.t}
              className="rounded-[18px] p-7 min-h-[200px] flex flex-col justify-between"
              style={{ background: BG, border: `1px solid ${CREAM_FAINT}` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${ACCENT}1A`, color: ACCENT }}
              >
                <s.Icon className="w-[18px] h-[18px]" />
              </div>
              <div>
                <p
                  className="font-serif font-medium text-[22px] m-0 tracking-[-0.02em]"
                  style={{ color: CREAM }}
                >
                  {s.t}
                </p>
                <p
                  className="text-[13px] m-0 mt-2 leading-[1.6]"
                  style={{ color: CREAM_DIM }}
                >
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── POWERFUL TECHNOLOGY — AI INFRASTRUCTURE ────────────────────────── */}
      <Section
        kicker="AI 인프라"
        title={
          <>
            아이디어가 아닌 —
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              운영 가능한 시스템
            </span>
          </>
        }
        body="3-tier 모델 라우팅 · 자동 폴백 · HITL 검증 루프 · CLIProxy 멀티 프로바이더. 단순 LLM 호출이 아니라 비용·성능·신뢰성을 균형있게 잡은 AI 시스템 아키텍처를 직접 설계했습니다."
        bg={BG}
      >
        <div className="grid lg:grid-cols-[1.4fr_1fr_1fr] gap-4 mt-12">
          {/* Big tile — 3-tier model routing */}
          <div
            className="rounded-[20px] p-6 min-h-[320px]"
            style={{ background: BG_2, border: `1px solid ${CREAM_FAINT}` }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p
                  className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
                  style={{ color: ACCENT }}
                >
                  3-tier 모델 라우팅
                </p>
                <p
                  className="font-serif font-medium m-0 mt-1.5 tracking-[-0.02em] text-[28px] sm:text-[32px] leading-[1.15]"
                  style={{ color: CREAM }}
                >
                  작업 난이도에 맞춰
                  <br />
                  <span style={{ color: ACCENT }}>비용·성능 자동 균형</span>
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {[
                { tier: 'FAST', use: '거래 자동분류 · 일괄 재분류', model: 'Haiku 4.5 / gpt-4o-mini / Gemini 2.0 Flash', tone: POSITIVE },
                { tier: 'BALANCED', use: 'AI 인사이트 · 시나리오 채팅', model: 'Sonnet 4.6 / gpt-4o / Gemini 2.5 Flash', tone: ACCENT },
                { tier: 'SMART', use: '시나리오 생성 · 실행계획 확장', model: 'Opus 4.7 / o4-mini / Gemini 2.5 Pro', tone: '#E59A6E' },
              ].map(r => (
                <div
                  key={r.tier}
                  className="rounded-[10px] p-3 flex items-center gap-3"
                  style={{ background: 'rgba(241,236,227,0.04)', border: `1px solid ${CREAM_FAINT}` }}
                >
                  <span
                    className="text-[10px] tracking-[0.14em] font-semibold px-2 py-0.5 rounded"
                    style={{ background: `${r.tone}1A`, color: r.tone, minWidth: 78, textAlign: 'center' }}
                  >
                    {r.tier}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium m-0" style={{ color: CREAM }}>
                      {r.use}
                    </p>
                    <p className="text-[10px] m-0 mt-0.5 truncate" style={{ color: CREAM_DIM }}>
                      {r.model}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] m-0 mt-3" style={{ color: CREAM_DIM }}>
              429 쿨다운 시 smart → balanced → fast 자동 폴백
            </p>
          </div>

          {/* Tile — HITL */}
          <div
            className="rounded-[20px] p-6 min-h-[320px] flex flex-col"
            style={{ background: BG_2, border: `1px solid ${CREAM_FAINT}` }}
          >
            <p
              className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
              style={{ color: ACCENT }}
            >
              Human-in-the-loop
            </p>
            <p
              className="font-serif font-medium text-[24px] m-0 mt-1.5 tracking-[-0.02em] leading-[1.2]"
              style={{ color: CREAM }}
            >
              AI 출력 →
              <br />
              사용자 검증 → <span style={{ color: ACCENT }}>반영</span>
            </p>
            <div className="mt-4 flex flex-col gap-2 flex-1">
              {[
                { l: '거래 재분류', d: 'Preview Modal · old → new 매핑 검증' },
                { l: '시나리오 추천', d: '관심/패스 비율 → 다음 생성 컨텍스트' },
                { l: '카테고리 학습', d: 'keyword → category 자동 누적' },
              ].map(r => (
                <div
                  key={r.l}
                  className="rounded-[8px] px-3 py-2"
                  style={{ background: 'rgba(241,236,227,0.04)' }}
                >
                  <p className="text-[12px] font-semibold m-0" style={{ color: CREAM }}>
                    {r.l}
                  </p>
                  <p className="text-[10px] m-0 mt-0.5" style={{ color: CREAM_DIM }}>
                    {r.d}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] m-0 mt-2" style={{ color: CREAM_DIM }}>
              사용자 행동 = 학습 신호
            </p>
          </div>

          {/* Tile — CLIProxy multi-provider */}
          <div
            className="rounded-[20px] p-6 min-h-[320px] flex flex-col"
            style={{ background: BG_2, border: `1px solid ${CREAM_FAINT}` }}
          >
            <p
              className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
              style={{ color: ACCENT }}
            >
              CLIProxy 추상화
            </p>
            <p
              className="font-serif font-medium text-[24px] m-0 mt-1.5 tracking-[-0.02em] leading-[1.2]"
              style={{ color: CREAM }}
            >
              본인 구독 계정으로
              <br />
              <span style={{ color: ACCENT }}>직접 연결</span>
            </p>
            <div className="mt-4 flex flex-col gap-1.5 flex-1">
              {[
                { l: 'Claude', d: 'Anthropic Pro/Max' },
                { l: 'ChatGPT', d: 'OpenAI Plus/Pro' },
                { l: 'Gemini', d: 'Google Advanced' },
                { l: 'API 키', d: 'OpenAI 직접 호출 fallback' },
              ].map((r, i) => (
                <div
                  key={r.l}
                  className="flex justify-between items-center py-2"
                  style={i ? { borderTop: `1px solid ${CREAM_FAINT}` } : {}}
                >
                  <span className="text-[12px] font-medium" style={{ color: CREAM }}>
                    {r.l}
                  </span>
                  <span className="text-[10px]" style={{ color: CREAM_DIM }}>
                    {r.d}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-2 px-3 py-2.5 rounded-[10px] flex items-center gap-2"
              style={{ background: `${ACCENT}1A`, border: `1px solid ${ACCENT}40` }}
            >
              <Sparkles className="w-3 h-3" style={{ color: ACCENT }} />
              <span className="text-[11px] font-medium" style={{ color: ACCENT }}>
                가족별 OAuth 라우팅 지원
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── COMPARISON ─────────────────────────────────────────────────────── */}
      <Section
        kicker="비교"
        title={
          <>
            개인 가계부와
            <br />
            엑셀 수작업{' '}
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              사이의 공백
            </span>
          </>
        }
        body="가계부 앱은 카드 내역 정도만, 엑셀 수작업은 시간이 너무 든다 — 그 사이 한 사람이 5종 자산을 통합 운영하는 도구는 비어 있었습니다. 돈Doc은 이 공백을 채웁니다."
        bg={BG_2}
      >
        <div
          className="mt-10 rounded-[20px] overflow-hidden overflow-x-auto"
          style={{ border: `1px solid ${CREAM_FAINT}`, background: BG }}
        >
          <div className="min-w-[640px]">
            {/* header */}
            <div
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr]"
              style={{ background: BG_3, borderBottom: `1px solid ${CREAM_FAINT}` }}
            >
              <div className="px-6 py-5">
                <p
                  className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
                  style={{ color: CREAM_DIM }}
                >
                  기능
                </p>
              </div>
              {[
                { l: '돈Doc', highlight: true },
                { l: '개인 가계부 앱', highlight: false },
                { l: '엑셀 수작업', highlight: false },
              ].map(c => (
                <div
                  key={c.l}
                  className="px-6 py-5 text-center"
                  style={{
                    borderLeft: `1px solid ${CREAM_FAINT}`,
                    background: c.highlight ? `${ACCENT}1A` : 'transparent',
                  }}
                >
                  <p
                    className="font-serif font-medium text-[18px] m-0 tracking-[-0.02em]"
                    style={{ color: c.highlight ? ACCENT : CREAM }}
                  >
                    {c.l}
                  </p>
                </div>
              ))}
            </div>

            {/* rows — deck slide 6 페인포인트 + 실제 구현 기능만 */}
            {[
              { f: '엑셀 업로드 → AI 자동 분류 (HITL)', a: true, b: 'half' as const, c: false },
              { f: '가족 단위 자산·부채·현금흐름 통합', a: true, b: false, c: 'half' as const },
              { f: '3-Layer 가족 권한 분리 (Role/Share/Visibility)', a: true, b: false, c: false },
              { f: 'AI 시나리오 생성 + 실행 액션', a: true, b: false, c: false },
              { f: '본인 구독 계정 직접 연결 (Claude/ChatGPT/Gemini)', a: true, b: false, c: false },
              { f: '월 정리 시간', a: '30분' as const, b: '수시' as const, c: '3~4h' as const },
            ].map((r, i) => (
              <div
                key={r.f}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr]"
                style={i ? { borderTop: `1px solid ${CREAM_FAINT}` } : {}}
              >
                <div className="px-6 py-[18px] text-[13px]" style={{ color: CREAM }}>
                  {r.f}
                </div>
                {[r.a, r.b, r.c].map((v, j) => (
                  <div
                    key={j}
                    className="px-6 py-[18px] text-center"
                    style={{
                      borderLeft: `1px solid ${CREAM_FAINT}`,
                      background: j === 0 ? `${ACCENT}0D` : 'transparent',
                    }}
                  >
                    {v === true && (
                      <span
                        className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                        style={{ background: j === 0 ? ACCENT : POSITIVE, color: BG }}
                      >
                        ✓
                      </span>
                    )}
                    {v === false && (
                      <span
                        className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-[12px]"
                        style={{ background: CREAM_FAINT, color: CREAM_DIM }}
                      >
                        —
                      </span>
                    )}
                    {v === 'half' && (
                      <span className="text-[11px] italic" style={{ color: CREAM_DIM }}>
                        일부
                      </span>
                    )}
                    {typeof v === 'string' && v !== 'half' && (
                      <span
                        className="text-[12px]"
                        style={{
                          color: j === 0 ? ACCENT : CREAM_DIM,
                          fontWeight: j === 0 ? 600 : 400,
                        }}
                      >
                        {v}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── CLOSING ────────────────────────────────────────────────────────── */}
      <div
        className="relative px-6 md:px-14 py-24 md:py-[120px]"
        style={{
          background: `linear-gradient(180deg, ${BG} 0%, #050706 100%)`,
          borderTop: `1px solid ${CREAM_FAINT}`,
        }}
      >
        <div className="max-w-5xl mx-auto">
          <p
            className="text-[11px] tracking-[0.18em] uppercase font-semibold text-center m-0 mb-6"
            style={{ color: ACCENT }}
          >
            다음 단계
          </p>

          <h2
            className="font-serif font-medium leading-[1.05] tracking-[-0.03em] text-center text-[36px] sm:text-[52px] lg:text-[72px] m-0"
            style={{ color: CREAM }}
          >
            지금은{' '}
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              분석하는 AI
            </span>
            ,
            <br />
            다음은{' '}
            <span className="inline-block relative mx-2">
              <span
                className="font-serif italic font-normal"
                style={{ color: ACCENT }}
              >
                실행하는 AI
              </span>
              <svg
                viewBox="0 0 200 14"
                preserveAspectRatio="none"
                className="absolute left-0 right-0 -bottom-2 w-full h-3"
              >
                <path
                  d="M 4 9 Q 50 2 100 7 T 196 6"
                  stroke={ACCENT}
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="600"
                  style={{ animation: 'cpDraw 1.6s ease-out 0.2s both' }}
                />
              </svg>
            </span>
            .
          </h2>

          <p
            className="text-[15px] sm:text-[16px] leading-[1.7] text-center max-w-[700px] mx-auto m-0 mt-10"
            style={{ color: CREAM_DIM }}
          >
            지금 돈Doc은 가족 자산을 구조화하고 시나리오까지 제안합니다.
            <br />
            <br />
            다음 단계는 — 예산 관리, 리마인드, 실행 체크, 후속 액션까지{' '}
            <em style={{ color: ACCENT }}>AI 에이전트가 직접 실행</em>하는 플랫폼.
            <br />
            가족의 재무 데이터를 실제 금융 행동까지 연결하는 의사결정 파트너로 진화합니다.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mt-14">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-[14px] font-semibold transition active:scale-[0.97] hover:opacity-90"
              style={{ background: CREAM, color: BG }}
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="/demo"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-[14px] font-medium transition hover:bg-white/5 active:scale-[0.97]"
              style={{ color: CREAM, border: `1px solid ${CREAM_FAINT}` }}
            >
              데모 둘러보기
            </a>
          </div>

          <div
            className="mt-20 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px]"
            style={{ borderTop: `1px solid ${CREAM_FAINT}`, color: CREAM_DIM }}
          >
            <span>© 2026 돈Doc · 한 사람의 자산 본부</span>
            <span className="flex gap-6">
              <a href="/demo" className="hover:opacity-80">데모</a>
              <Link href="/sign-in" className="hover:opacity-80">로그인</Link>
              <Link href="/sign-up" className="hover:opacity-80">시작하기</Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

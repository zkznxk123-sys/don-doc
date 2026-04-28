'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Sparkles, Lock, Shield, BarChart3, AlertCircle, ArrowRight,
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-md bg-red-950/60 border border-red-500/40 text-sm text-red-200 shadow-2xl backdrop-blur">
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
            패밀리오피스 · 한국형 자산관리
          </p>

          <h1
            className="font-serif font-medium leading-[1.05] tracking-[-0.025em] text-[44px] sm:text-[56px] lg:text-[68px]"
            style={{ color: CREAM }}
          >
            현대적인 자산관리,
            <br />
            <span
              className="font-serif italic font-normal"
              style={{ color: ACCENT }}
            >
              가족을 위해
            </span>{' '}
            설계되었습니다.
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
            className="text-base lg:text-[16px] leading-[1.65] mt-7 max-w-[480px]"
            style={{ color: CREAM_DIM }}
          >
            엑셀 한 번이면 AI가 분류하고, 부동산 LTV·연금·증여까지 — 가족 재정 전체를 한 명의 어드바이저처럼 관리합니다.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
            className="flex flex-wrap gap-2.5 mt-9"
          >
            <a
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[13px] font-semibold transition-all active:scale-[0.97] hover:opacity-90"
              style={{ background: CREAM, color: BG }}
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/api/auth/demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[13px] font-medium transition-all hover:bg-white/5 active:scale-[0.97]"
              style={{ color: CREAM, border: `1px solid ${CREAM_FAINT}` }}
            >
              데모 체험하기
            </a>
          </motion.div>

          {/* live AUM-style proof */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.45, ease: 'easeOut' }}
            className="flex flex-wrap gap-x-12 gap-y-6 mt-12 pt-7"
            style={{ borderTop: `1px solid ${CREAM_FAINT}` }}
          >
            {[
              { l: '관리 자산 누적', v: <CountUp to={5.2} decimals={1} suffix="조" /> },
              { l: '활성 가족', v: <CountUp to={12400} suffix="+" /> },
              { l: 'AI 분류 정확도', v: <CountUp to={94} suffix="%" /> },
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

        {/* RIGHT — floating product preview */}
        <div className="relative h-[460px] sm:h-[540px]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 rounded-[20px] overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #1A2422 0%, #0E1413 100%)',
              border: `1px solid ${CREAM_FAINT}`,
              boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(241,236,227,0.06)',
            }}
          >
            {/* faux toolbar */}
            <div
              className="flex items-center justify-between px-[18px] py-[14px]"
              style={{ borderBottom: `1px solid ${CREAM_FAINT}`, background: 'rgba(0,0,0,0.3)' }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-[22px] h-[22px] rounded-md inline-flex items-center justify-center"
                  style={{ background: FOREST }}
                >
                  <Sparkles className="w-3 h-3" style={{ color: CREAM }} />
                </span>
                <span className="text-[11px] font-semibold" style={{ color: CREAM }}>
                  김OO 가족 · 데모
                </span>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: CREAM_FAINT }}
                  />
                ))}
              </div>
            </div>

            {/* faux dashboard inside */}
            <div className="p-[22px] relative h-[calc(100%-51px)]">
              <p
                className="text-[10px] tracking-[0.12em] uppercase m-0"
                style={{ color: CREAM_DIM }}
              >
                가족 순자산
              </p>
              <p
                className="font-serif font-medium m-0 mt-1 tracking-[-0.03em] leading-none text-[44px] sm:text-[56px]"
                style={{ color: CREAM, fontVariantNumeric: 'tabular-nums' }}
              >
                <CountUp to={7.32} decimals={2} suffix="억" duration={2000} />
              </p>
              <p className="text-[12px] m-0 mt-1.5 font-medium" style={{ color: POSITIVE }}>
                ↑ +2,300만 <span style={{ color: CREAM_DIM, fontWeight: 400 }}>전월 대비</span>
              </p>

              {/* sparkline */}
              <svg viewBox="0 0 400 100" className="w-full h-[90px] mt-4">
                <defs>
                  <linearGradient id="cpSpark" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 70 L 50 62 L 100 68 L 150 50 L 200 55 L 250 38 L 300 42 L 350 25 L 400 18 L 400 100 L 0 100 Z"
                  fill="url(#cpSpark)"
                />
                <path
                  d="M 0 70 L 50 62 L 100 68 L 150 50 L 200 55 L 250 38 L 300 42 L 350 25 L 400 18"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="2"
                  strokeDasharray="600"
                  style={{ animation: 'cpDraw 1.6s ease-out 0.6s both' }}
                />
              </svg>

              {/* mini cards row */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { l: '부동산', v: '9.5억', d: '+26.7%' },
                  { l: '주식·ETF', v: '1.2억', d: '+8.4%' },
                  { l: '예적금', v: '4,200만', d: '+0.2%' },
                ].map(c => (
                  <div
                    key={c.l}
                    className="rounded-[10px] px-3 py-2.5"
                    style={{
                      background: 'rgba(241,236,227,0.04)',
                      border: `1px solid ${CREAM_FAINT}`,
                    }}
                  >
                    <p
                      className="text-[9px] tracking-[0.1em] uppercase m-0"
                      style={{ color: CREAM_DIM }}
                    >
                      {c.l}
                    </p>
                    <p
                      className="text-[14px] m-0 mt-1 font-semibold"
                      style={{ color: CREAM, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {c.v}
                    </p>
                    <p className="text-[10px] m-0 mt-0.5" style={{ color: POSITIVE }}>
                      {c.d}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* floating chips */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="absolute -left-3 top-[260px] rounded-full px-4 py-2 text-[11px] font-semibold inline-flex items-center gap-2 shadow-2xl"
            style={{ background: CREAM, color: BG, ...float(0, 5) }}
          >
            <Sparkles className="w-3 h-3" />
            AI 분류 완료 · 423건
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.85 }}
            className="absolute -right-2 top-[40px] rounded-full px-4 py-2 text-[11px] font-semibold inline-flex items-center gap-2 shadow-2xl"
            style={{ background: FOREST, color: CREAM, ...float(2.4, 6) }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: POSITIVE }}
            />
            가족 4명 동기화됨
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="absolute right-5 -bottom-3 rounded-full px-4 py-2 text-[11px] font-semibold inline-flex items-center gap-2 shadow-2xl"
            style={{
              background: BG_3,
              color: CREAM,
              border: `1px solid ${ACCENT}`,
              ...float(4, 5),
            }}
          >
            <span style={{ color: ACCENT }}>LTV</span>
            <span style={{ color: POSITIVE }}>42% · 안전</span>
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
          NEW
        </span>
        <span style={{ color: CREAM_DIM }}>패밀리오피스 베타 출시 — 가족 4인 이내 평생 무료</span>
        <a
          href="/sign-up"
          className="underline font-medium hover:opacity-80"
          style={{ color: CREAM }}
        >
          자세히 →
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
          {/* persona toggle pill */}
          <div
            className="hidden md:flex gap-1.5 text-[11px] rounded-full p-[3px]"
            style={{ background: CREAM_FAINT }}
          >
            <span
              className="px-3.5 py-[5px] rounded-full font-semibold"
              style={{ background: CREAM, color: BG }}
            >
              가족용
            </span>
            <span className="px-3.5 py-[5px] rounded-full" style={{ color: CREAM_DIM }}>
              어드바이저용
            </span>
          </div>
        </div>
        <div className="hidden lg:flex gap-7 text-[12px]" style={{ color: CREAM_DIM }}>
          <span className="hover:opacity-80 cursor-default">대시보드</span>
          <span className="hover:opacity-80 cursor-default">세무</span>
          <span className="hover:opacity-80 cursor-default">리소스 ▾</span>
          <span className="hover:opacity-80 cursor-default">회사 ▾</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/sign-in"
            className="text-[12px] px-3 py-1.5 hover:opacity-80"
            style={{ color: CREAM_DIM }}
          >
            로그인
          </a>
          <a
            href="/sign-up"
            className="text-[12px] font-semibold px-[18px] py-2.5 rounded-full transition hover:opacity-90"
            style={{ background: CREAM, color: BG }}
          >
            무료 시작
          </a>
        </div>
      </nav>

      <Hero />

      {/* ── PRESS STRIP ─────────────────────────────────────────────────────── */}
      <div
        className="relative py-8 md:py-10"
        style={{ borderTop: `1px solid ${CREAM_FAINT}`, borderBottom: `1px solid ${CREAM_FAINT}` }}
      >
        <p
          className="text-[11px] tracking-[0.18em] uppercase text-center m-0 mb-6"
          style={{ color: CREAM_DIM }}
        >
          주요 매체에 소개되었습니다
        </p>
        <div className="overflow-hidden whitespace-nowrap">
          <div
            className="inline-flex gap-14 items-center"
            style={{ animation: 'cpTicker 35s linear infinite' }}
          >
            {[...Array(2)].flatMap((_, copy) =>
              ['조선일보', '중앙일보', 'TechCrunch', '매일경제', '한국경제', 'Forbes Korea', 'EO', 'Outstanding', '비즈한국'].map((p, i) => (
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

      {/* ── APPROACH — TEAM ────────────────────────────────────────────────── */}
      <Section
        kicker="우리의 접근"
        title={
          <>
            당신만을 위한
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              전담팀
            </span>
            이 있습니다
          </>
        }
        body="재무·세무·투자 어드바이저로 구성된 전담팀이 가족의 재정 전체를 함께 봅니다. 우리의 일은 — 당신이 최선의 결정을 내리도록 돕는 것."
        bg={BG}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-12">
          {[
            { name: '강민우', role: '재무 어드바이저', spec: '15년 · CFP', tone: ACCENT },
            { name: '이서연', role: '세무 어드바이저', spec: '12년 · CTA', tone: FOREST },
            { name: '박지훈', role: '투자 매니저', spec: '10년 · CFA', tone: '#8B6E1E' },
            { name: '최예린', role: '컨시어지', spec: '7년 · 패밀리오피스', tone: '#5A4830' },
          ].map(p => (
            <div
              key={p.name}
              className="rounded-[18px] p-[22px] flex flex-col justify-between min-h-[280px]"
              style={{
                background: `linear-gradient(180deg, ${p.tone}22 0%, ${BG_2} 100%)`,
                border: `1px solid ${CREAM_FAINT}`,
              }}
            >
              <div
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center font-serif font-medium text-[28px] mb-3.5"
                style={{
                  background: `linear-gradient(135deg, ${p.tone} 0%, ${BG} 100%)`,
                  border: `1px solid ${CREAM_FAINT}`,
                  color: CREAM,
                }}
              >
                {p.name[0]}
              </div>
              <div>
                <p
                  className="font-serif font-medium text-[22px] m-0 tracking-[-0.02em]"
                  style={{ color: CREAM }}
                >
                  {p.name}
                </p>
                <p className="text-[12px] m-0 mt-1" style={{ color: CREAM_DIM }}>
                  {p.role}
                </p>
                <p
                  className="text-[10px] m-0 mt-3 tracking-[0.12em] uppercase font-semibold"
                  style={{ color: p.tone }}
                >
                  {p.spec}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── EXCLUSIVE SERVICES ──────────────────────────────────────────────── */}
      <Section
        kicker="전담 서비스"
        title={
          <>
            흩어진 자산을
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              하나의 뷰
            </span>
            로
          </>
        }
        body="부동산 LTV부터 연금, 증여, 신탁까지 — 한 곳에서 모든 결정을. 가족 권한 분리로 부모와 자녀가 각자의 영역을 안전하게 관리합니다."
        bg={BG_2}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-12">
          {[
            { Icon: BarChart3, t: '공모·사모 투자', d: '검증된 사모 펀드 액세스' },
            { Icon: Sparkles, t: '세금 신고', d: '전담 세무사가 직접 신고' },
            { Icon: Lock, t: '신탁·증여', d: '가족간 자산 이전 설계' },
            { Icon: Shield, t: '신용 라인', d: '주식 담보 대출 중개' },
          ].map(s => (
            <div
              key={s.t}
              className="rounded-[18px] p-7 min-h-[220px] flex flex-col justify-between"
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
                  className="text-[12px] m-0 mt-1.5 leading-[1.55]"
                  style={{ color: CREAM_DIM }}
                >
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── POWERFUL TECHNOLOGY — DASHBOARD TILES ──────────────────────────── */}
      <Section
        kicker="강력한 기술"
        title={
          <>
            대시보드가
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              스스로 정리
            </span>
            합니다
          </>
        }
        body="순자산 추적, 세금 시뮬레이션, 현금흐름 예측까지 — 엑셀 한 번 업로드하면 AI가 학습해 갈수록 정확해집니다."
        bg={BG}
      >
        <div className="grid lg:grid-cols-[1.4fr_1fr_1fr] gap-4 mt-12">
          {/* Big tile — net worth */}
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
                  순자산 모니터링
                </p>
                <p
                  className="font-serif font-medium m-0 mt-1.5 tracking-[-0.02em] text-[36px] sm:text-[44px]"
                  style={{ color: CREAM, fontVariantNumeric: 'tabular-nums' }}
                >
                  7.32억
                </p>
                <p className="text-[12px] m-0 mt-1 font-medium" style={{ color: POSITIVE }}>
                  ↑ +2,300만 전월 대비
                </p>
              </div>
              <div className="hidden sm:flex gap-1">
                {['1M', '6M', '1Y', '전체'].map((p, i) => (
                  <span
                    key={p}
                    className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                    style={
                      i === 2
                        ? { background: CREAM, color: BG, border: 'none' }
                        : { color: CREAM_DIM, border: `1px solid ${CREAM_FAINT}` }
                    }
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <svg viewBox="0 0 600 160" className="w-full h-[180px] mt-4">
              <defs>
                <linearGradient id="cpBigSpark" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[...Array(6)].map((_, i) => (
                <line
                  key={i}
                  x1="0"
                  x2="600"
                  y1={i * 32}
                  y2={i * 32}
                  stroke={CREAM_FAINT}
                  strokeWidth="0.5"
                  strokeDasharray="2 4"
                />
              ))}
              <path
                d="M 0 130 C 60 120, 100 110, 150 100 S 250 80, 300 90 S 400 60, 450 50 S 540 30, 600 20 L 600 160 L 0 160 Z"
                fill="url(#cpBigSpark)"
              />
              <path
                d="M 0 130 C 60 120, 100 110, 150 100 S 250 80, 300 90 S 400 60, 450 50 S 540 30, 600 20"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2.5"
              />
              <circle cx="600" cy="20" r="5" fill={ACCENT} />
              <circle
                cx="600"
                cy="20"
                r="10"
                fill="none"
                stroke={ACCENT}
                strokeOpacity="0.3"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* Tile — cash flow */}
          <div
            className="rounded-[20px] p-6 min-h-[320px] flex flex-col"
            style={{ background: BG_2, border: `1px solid ${CREAM_FAINT}` }}
          >
            <p
              className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
              style={{ color: ACCENT }}
            >
              현금흐름 예측
            </p>
            <p
              className="font-serif font-medium text-[26px] m-0 mt-1.5 tracking-[-0.02em]"
              style={{ color: CREAM }}
            >
              은퇴까지 <span style={{ color: ACCENT }}>21년</span>
            </p>
            <div className="mt-4 flex flex-col gap-2.5 flex-1 justify-center">
              {[
                { l: '월 수입', v: '+820만', c: POSITIVE, w: 100 },
                { l: '월 지출', v: '-510만', c: '#E59A6E', w: 62 },
                { l: '저축 여력', v: '+310만', c: ACCENT, w: 38 },
              ].map(r => (
                <div key={r.l}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px]" style={{ color: CREAM_DIM }}>
                      {r.l}
                    </span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: r.c, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {r.v}
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: CREAM_FAINT }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${r.w}%`, background: r.c }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tile — tax simulation */}
          <div
            className="rounded-[20px] p-6 min-h-[320px] flex flex-col"
            style={{ background: BG_2, border: `1px solid ${CREAM_FAINT}` }}
          >
            <p
              className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
              style={{ color: ACCENT }}
            >
              세금 시뮬레이션
            </p>
            <p
              className="font-serif font-medium text-[26px] m-0 mt-1.5 tracking-[-0.02em]"
              style={{ color: CREAM }}
            >
              올해 절세
              <br />
              <span style={{ color: ACCENT }}>최대 1,240만</span>
            </p>
            <div className="mt-4 flex flex-col gap-1.5 flex-1">
              {[
                { l: 'IRP 추가 납입', v: '-462만' },
                { l: '연금저축 펀드', v: '-396만' },
                { l: '월세 세액공제', v: '-180만' },
                { l: '기부금 공제', v: '-202만' },
              ].map((r, i) => (
                <div
                  key={r.l}
                  className="flex justify-between items-center py-2"
                  style={i ? { borderTop: `1px solid ${CREAM_FAINT}` } : {}}
                >
                  <span className="text-[11px]" style={{ color: CREAM_DIM }}>
                    {r.l}
                  </span>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: POSITIVE, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {r.v}
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
                AI 추천 적용 시
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
            일반 가계부 앱과
            <br />
            무엇이{' '}
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              다를까요
            </span>
          </>
        }
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
                { l: '뱅크샐러드', highlight: false },
                { l: '엑셀', highlight: false },
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

            {/* rows */}
            {[
              { f: '엑셀 업로드 → AI 자동 분류', a: true, b: 'half' as const, c: false },
              { f: '부동산 LTV·DSR 통합 관리', a: true, b: false, c: false },
              { f: '가족 권한 분리 (부모/자녀)', a: true, b: false, c: false },
              { f: '세금 시뮬레이션·절세 추천', a: true, b: false, c: false },
              { f: '연금·증여·신탁 설계', a: true, b: false, c: false },
              { f: '광고 없음', a: true, b: false, c: true },
              { f: '월 비용', a: '무료' as const, b: '광고' as const, c: '시간' as const },
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
            우리의 약속
          </p>

          <h2
            className="font-serif font-medium leading-[1.05] tracking-[-0.03em] text-center text-[36px] sm:text-[52px] lg:text-[72px] m-0"
            style={{ color: CREAM }}
          >
            우리는 가족의 삶에 미친{' '}
            <span className="inline-block relative mx-2">
              <span
                className="font-serif italic font-normal"
                style={{ color: ACCENT }}
              >
                영향
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
            으로
            <br />
            성공을 측정합니다.
          </h2>

          <p
            className="text-[15px] sm:text-[16px] leading-[1.7] text-center max-w-[680px] mx-auto m-0 mt-10"
            style={{ color: CREAM_DIM }}
          >
            때로는 구체적입니다 — 양도세 절세로 5천만 원을 아끼거나, 부모님 증여 시점을 최적화해 1억의 세금을 줄이거나.
            <br />
            <br />
            하지만 때로는 더 미묘합니다. 가족이 같은 대시보드를 보며 미래를 함께 그릴 수 있다는 —{' '}
            <em style={{ color: ACCENT }}>그 평온함</em>.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mt-14">
            <a
              href="/sign-up"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-[14px] font-semibold transition active:scale-[0.97] hover:opacity-90"
              style={{ background: CREAM, color: BG }}
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/api/auth/demo"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-[14px] font-medium transition hover:bg-white/5 active:scale-[0.97]"
              style={{ color: CREAM, border: `1px solid ${CREAM_FAINT}` }}
            >
              데모 체험하기
            </a>
          </div>

          <div
            className="mt-20 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px]"
            style={{ borderTop: `1px solid ${CREAM_FAINT}`, color: CREAM_DIM }}
          >
            <span>© 2026 돈Doc · 패밀리오피스</span>
            <span className="flex gap-6">
              <span>개인정보처리방침</span>
              <span>이용약관</span>
              <span>보안</span>
              <span>회사소개</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

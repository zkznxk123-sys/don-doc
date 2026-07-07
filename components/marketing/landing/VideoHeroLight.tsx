'use client'

/**
 * VideoHeroLight — Solid Modern 다크 히어로 (2026-07-07 랜딩 다크 마이그레이션).
 * BRAND_GUIDE.md 기준. 합성 정체성:
 * 딥 포레스트 다크 + 강한 골드 + 숫자 히어로 + 골드 오빗 아크 + 글래스 대시보드 프리뷰.
 * 2컬럼: 좌측 카피(북극성 H1) / 우측 대시보드 프리뷰 카드. blueprint 그리드 바탕.
 * (구 라이트 full-bleed 영상은 파킹 — 데일리/라이트 표면용. 다크 히어로 영상은 추후 재제작 슬롯.)
 */

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRightCircle, ArrowUpRight } from 'lucide-react'
import {
  SM_SURFACE, SM_PANEL, SM_RAISED, SM_INK, SM_INK_DIM, SM_HAIRLINE,
  GOLD, GOLD_SOFT,
} from './tokens'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

const tnum = { fontVariantNumeric: 'tabular-nums' } as const

function Logo() {
  // 다크 배경용 워드마크(밝은/골드 코인 버전).
  return <Image src="/logo-wordmark-dark.svg" alt="돈Doc" width={72} height={20} priority />
}

// 골드 오빗 아크 — "꾸준한 축적의 궤도". CSS(.hero-orbit)로 dash 흐름·reduced-motion 가드.
function OrbitArc() {
  return (
    <svg aria-hidden className="hero-orbit absolute inset-0 w-full h-full z-[1] pointer-events-none"
      viewBox="0 0 1440 720" fill="none" preserveAspectRatio="xMidYMin slice">
      <defs>
        <filter id="orbitGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <path d="M -120 520 Q 760 -160 1620 300" stroke={GOLD} strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="3 13" filter="url(#orbitGlow)" />
      <path d="M -120 520 Q 760 -160 1620 300" stroke={GOLD} strokeOpacity="0.85" strokeWidth="1.1" strokeDasharray="3 13" />
    </svg>
  )
}

// 골드 우상향 스파크라인 — 숫자 히어로 보조. 축적의 곡선.
function Sparkline() {
  return (
    <svg viewBox="0 0 320 84" fill="none" className="w-full h-[84px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 66 C40 60 60 58 90 50 C120 42 140 52 170 44 C205 35 225 22 260 20 C290 18 305 12 320 8"
        stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M0 66 C40 60 60 58 90 50 C120 42 140 52 170 44 C205 35 225 22 260 20 C290 18 305 12 320 8 L320 84 L0 84 Z"
        fill="url(#spkFill)" />
    </svg>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-[10px] px-3.5 py-3" style={{ background: SM_RAISED, border: `1px solid ${SM_HAIRLINE}` }}>
      <p className="text-[11px] mb-1" style={{ color: SM_INK_DIM }}>{label}</p>
      <p className="text-[15px] font-semibold" style={{ color: SM_INK, ...tnum }}>{value}</p>
    </div>
  )
}

// 글래스 대시보드 프리뷰 — 숫자가 히어로. 반투명 패널 + 골드 hairline.
function DashboardPreview() {
  return (
    <div className="relative">
      {/* 부유 글래스 코인 — 깊이감(Montera 차용) */}
      <div aria-hidden className="absolute -top-5 -left-5 w-14 h-14 rounded-2xl backdrop-blur-md hidden sm:flex items-center justify-center z-10"
        style={{ background: GOLD_SOFT, border: `1px solid ${SM_HAIRLINE}`, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
        <span className="text-[22px] font-bold" style={{ color: GOLD }}>₩</span>
      </div>

      <div className="relative rounded-2xl p-6 sm:p-7 backdrop-blur-xl"
        style={{ background: 'rgba(31,46,40,0.72)', border: `1px solid ${SM_HAIRLINE}`, boxShadow: '0 24px 70px rgba(0,0,0,0.45)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px]" style={{ color: SM_INK_DIM }}>총 순자산</span>
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[13px] font-bold"
            style={{ background: GOLD_SOFT, color: GOLD }}>₩</span>
        </div>

        <div className="flex items-end gap-3 mb-1">
          <span className="text-[34px] sm:text-[40px] font-black leading-none" style={{ color: SM_INK, ...tnum }}>₩732,000,000</span>
        </div>
        <div className="inline-flex items-center gap-1 mb-5 text-[13px] font-semibold" style={{ color: GOLD }}>
          <ArrowUpRight className="w-4 h-4" /> <span style={tnum}>2.4%</span>
          <span style={{ color: SM_INK_DIM, fontWeight: 400 }}>이번 달</span>
        </div>

        <div className="mb-5"><Sparkline /></div>

        <div className="flex gap-3">
          <StatChip label="주식·ETF" value="₩410,000,000" />
          <StatChip label="현금성 자산" value="₩322,000,000" />
        </div>
      </div>
    </div>
  )
}

export function VideoHeroLight() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden" style={{ background: SM_SURFACE, color: SM_INK }}>
      {/* blueprint 그리드 바탕 + 골드 오빗 아크 */}
      <div aria-hidden className="hero-blueprint absolute inset-0 z-0" />
      <OrbitArc />
      {/* 하단 비네트 — 깊이 */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 z-[1] pointer-events-none"
        style={{ background: `linear-gradient(180deg, transparent, ${SM_SURFACE})` }} />

      {/* ── navbar ── */}
      <nav className="relative z-10 max-w-[1280px] mx-auto flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <a href="/sign-in" className="inline-flex items-center px-2.5 sm:px-4 py-2.5 text-sm font-medium" style={{ color: SM_INK_DIM }}>로그인</a>
          <a href="/sign-up" className="rounded-full px-4 sm:px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03]"
            style={{ background: GOLD, color: SM_SURFACE }}>무료로 시작</a>
        </div>
      </nav>

      {/* ── hero — 2컬럼 (좌 카피 / 우 대시보드 프리뷰) ── */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center"
        style={{ paddingTop: 'clamp(40px, 7vw, 88px)', paddingBottom: 'clamp(48px, 8vw, 96px)' }}>
        {/* 좌 */}
        <div style={{ maxWidth: 560 }}>
          <motion.p custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="inline-flex items-center gap-2"
            style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.16em', color: GOLD, marginBottom: 20 }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            THE SIMPLEST WAY TO MANAGE MONEY
          </motion.p>

          <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="font-black"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(2.4rem, 6.6vw, 4.4rem)', lineHeight: 1.05, letterSpacing: '-0.03em', color: SM_INK, marginBottom: 22 }}>
            복잡한 투자,<br />
            <span style={{ color: GOLD, borderBottom: `3px solid ${GOLD}`, paddingBottom: 2 }}>단순하게.</span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="text-[15px] sm:text-base leading-relaxed" style={{ color: SM_INK_DIM, maxWidth: 460, marginBottom: 32 }}>
            흩어진 여유자금을 단단한 자산으로. 오직 축적에 집중하는, 가장 단순한 자산 관리.
          </motion.p>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-4">
            <Link href="/sign-up"
              className="inline-flex items-center justify-between font-semibold transition-transform hover:scale-[1.04]"
              style={{ background: GOLD, color: SM_SURFACE, borderRadius: 50, padding: '15px 22px', minWidth: 200, gap: 24, boxShadow: '0 6px 28px rgba(201,165,74,0.32)' }}>
              무료로 시작하기 <ArrowRightCircle className="w-5 h-5" />
            </Link>
            <span className="text-[13px]" style={{ color: SM_INK_DIM }}>1분이면 충분합니다</span>
          </motion.div>
        </div>

        {/* 우 — 대시보드 프리뷰 */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="w-full max-w-[440px] mx-auto lg:ml-auto">
          <DashboardPreview />
        </motion.div>
      </div>
    </section>
  )
}

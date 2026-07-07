'use client'

/**
 * VideoHeroLight — Solid Modern 다크 히어로 (2026-07-08, 이미지 배경형).
 * BRAND_GUIDE.md 기준. 자체 제작 다크+골드 비주얼(Gemini): 딥 포레스트 배경에
 * 투명 저장고로 골드 코인이 슈트를 타고 흘러 쌓임 = 북극성 "여유자금을 단단한 자산으로 꾸준히".
 * full-bleed 이미지 배경(좌측 어두운 여백=텍스트) + 좌측 카피 단일 컬럼.
 * (모션 원하면 hero-bg를 Higgsfield i2v로 → hero.mp4 스왑, 같은 슬롯.)
 */

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRightCircle } from 'lucide-react'
import { SM_SURFACE, SM_INK, SM_INK_DIM, GOLD } from './tokens'

const HERO_BG = '/landing/hero-bg.jpg'
const HERO_BG_MOBILE = '/landing/hero-bg-mobile.jpg'  // 세로 crop — 저장고 중심

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

function Logo() {
  return <Image src="/logo-wordmark-dark.svg" alt="돈Doc" width={72} height={20} priority />
}

export function VideoHeroLight() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden" style={{ background: SM_SURFACE, color: SM_INK }}>
      {/* 배경 — 자체 제작 다크+골드 비주얼. 데스크톱=가로 full / 모바일=저장고 중심 세로 crop */}
      <Image src={HERO_BG} alt="" aria-hidden fill priority sizes="100vw"
        className="hidden sm:block object-cover object-center z-0" />
      <Image src={HERO_BG_MOBILE} alt="" aria-hidden fill priority sizes="100vw"
        className="sm:hidden object-cover object-center z-0" />

      {/* 가독성 워시 — 데스크톱: 좌측 forest 그라디언트 / 모바일: 상단 강한 스크림(텍스트) */}
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none hidden sm:block"
        style={{ background: `linear-gradient(90deg, ${SM_SURFACE} 0%, rgba(24,42,36,0.86) 28%, rgba(24,42,36,0.25) 58%, transparent 74%)` }} />
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none sm:hidden"
        style={{ background: `linear-gradient(180deg, rgba(24,42,36,0.55) 0%, rgba(24,42,36,0.12) 24%, rgba(24,42,36,0.30) 52%, rgba(24,42,36,0.82) 78%, rgba(24,42,36,0.97) 100%)` }} />

      {/* ── navbar ── */}
      <nav className="relative z-10 max-w-[1280px] mx-auto flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <a href="/sign-in" className="inline-flex items-center px-2.5 sm:px-4 py-2.5 text-sm font-medium" style={{ color: SM_INK_DIM }}>로그인</a>
          <a href="/sign-up" className="rounded-full px-4 sm:px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03]"
            style={{ background: GOLD, color: SM_SURFACE }}>무료로 시작</a>
        </div>
      </nav>

      {/* ── hero content — 좌측 단일 컬럼 ── */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-8 flex items-end sm:items-center"
        style={{ minHeight: 'calc(100vh - 88px)', paddingTop: 'clamp(16px, 4vw, 40px)', paddingBottom: 'clamp(40px, 8vw, 96px)' }}>
        <div style={{ maxWidth: 560 }}>
          <motion.p custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="inline-flex items-center gap-2"
            style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.16em', color: GOLD, marginBottom: 20 }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            THE SIMPLEST WAY TO MANAGE MONEY
          </motion.p>

          <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="font-black"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(2.5rem, 7vw, 4.6rem)', lineHeight: 1.04, letterSpacing: '-0.03em', color: SM_INK, marginBottom: 24 }}>
            복잡한 투자,<br />
            <span style={{ color: GOLD, borderBottom: `3px solid ${GOLD}`, paddingBottom: 2 }}>단순하게.</span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="text-[15px] sm:text-base leading-relaxed" style={{ color: SM_INK_DIM, maxWidth: 440, marginBottom: 34 }}>
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
      </div>
    </section>
  )
}

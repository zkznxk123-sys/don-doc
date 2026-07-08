'use client'

/**
 * VideoHeroLight — Solid Modern 다크 히어로 (2026-07-08).
 * BRAND_GUIDE.md 기준. 자체 제작 다크+골드 비주얼(Gemini→Higgsfield i2v):
 * 딥 포레스트에 투명 저장고로 골드 코인이 슈트를 타고 흘러 축적 = 북극성 시각화.
 * 데스크톱=영상 배경 + 좌측 카피 / 모바일=A안 분리형(위 카피 · 아래 저장고 이미지).
 * 로고=골드 ₩ 코인 심볼 + "돈독" 텍스트. reduced-motion 가드.
 */

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowRightCircle } from 'lucide-react'
import { SM_SURFACE, SM_INK, SM_INK_DIM, GOLD } from './tokens'

const VIDEO_SRC = '/landing/hero.mp4'
const HERO_POSTER = '/landing/hero-poster.jpg'
const HERO_BG_MOBILE = '/landing/hero-bg-mobile.jpg'  // 모바일 정지 — 저장고 중심 세로 crop

// 북극성 3-step (본다→남긴다→옮긴다). 영문.
const STEPS = [
  { n: '01', t: 'See your cashflow' },
  { n: '02', t: 'Keep the surplus' },
  { n: '03', t: 'Build solid assets' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

// 워드마크 "don D●c" — don(가늘게, 흘러듦) + Doc(볼드, 커짐, o=골드 코인). Space Grotesk.
// 심볼(브래킷+골드 코인)은 favicon/앱아이콘 전용(brand-mark.svg). 코인은 한 곳에만.
function Logo() {
  return (
    <span className="inline-flex items-baseline" style={{ fontFamily: 'var(--font-grotesk)', lineHeight: 1 }}>
      <span style={{ fontWeight: 300, fontSize: 17, color: SM_INK_DIM, letterSpacing: '0.01em' }}>don</span>
      <span style={{ fontWeight: 700, fontSize: 25, color: SM_INK, letterSpacing: '-0.02em', marginLeft: 3 }}>
        D<span aria-hidden style={{ display: 'inline-block', width: '0.58em', height: '0.58em', borderRadius: '50%', background: GOLD, verticalAlign: '0.0em', margin: '0 0.035em' }} />c
      </span>
    </span>
  )
}

// 히어로 카피 — 데스크톱/모바일 공용. 3-step은 반응형(가로/세로).
function HeroCopy() {
  return (
    <div style={{ maxWidth: 560 }}>
      <motion.p custom={0} variants={fadeUp} initial="hidden" animate="visible"
        className="inline-flex items-center gap-2"
        style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.16em', color: GOLD, marginBottom: 20 }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
        THE SIMPLEST WAY TO MANAGE MONEY
      </motion.p>

      <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible"
        className="font-black"
        style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(2.5rem, 7vw, 4.6rem)', lineHeight: 1.04, letterSpacing: '-0.03em', color: SM_INK, marginBottom: 26 }}>
        복잡한 투자,<br />
        <span style={{ color: GOLD, borderBottom: `3px solid ${GOLD}`, paddingBottom: 2 }}>단순하게.</span>
      </motion.h1>

      {/* 북극성 3-step (영문) — 모바일 세로 스택 / 데스크톱 가로 */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible"
        className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-2.5 sm:gap-x-4 mb-9"
        style={{ fontSize: 13 }}>
        {STEPS.map((s, i) => (
          <span key={s.n} className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>{s.n}</span>
              <span style={{ color: SM_INK, fontWeight: 500 }}>{s.t}</span>
            </span>
            {i < STEPS.length - 1 && <span aria-hidden className="hidden sm:inline" style={{ color: SM_INK, opacity: 0.3 }}>→</span>}
          </span>
        ))}
      </motion.div>

      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
        <Link href="/sign-up"
          className="inline-flex items-center justify-between font-semibold transition-transform hover:scale-[1.04]"
          style={{ background: GOLD, color: SM_SURFACE, borderRadius: 50, padding: '15px 22px', minWidth: 200, gap: 24, boxShadow: '0 6px 28px rgba(201,165,74,0.32)' }}>
          무료로 시작하기 <ArrowRightCircle className="w-5 h-5" />
        </Link>
      </motion.div>
    </div>
  )
}

export function VideoHeroLight() {
  const videoRef = useRef<HTMLVideoElement>(null)

  // WCAG 2.2.2 — reduced-motion 시 데스크톱 영상 pause, poster 유지.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      const v = videoRef.current
      if (!v) return
      if (mq.matches) v.pause()
      else v.play().catch(() => {})
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <section className="relative w-full min-h-screen overflow-hidden" style={{ background: SM_SURFACE, color: SM_INK }}>
      {/* 데스크톱 배경 — 영상 모션 */}
      <video ref={videoRef} autoPlay muted loop playsInline preload="auto" aria-hidden poster={HERO_POSTER}
        className="hidden sm:block absolute inset-0 w-full h-full object-cover object-center z-0">
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none hidden sm:block"
        style={{ background: `linear-gradient(90deg, ${SM_SURFACE} 0%, rgba(24,42,36,0.86) 28%, rgba(24,42,36,0.25) 58%, transparent 74%)` }} />

      {/* ── navbar ── */}
      <nav className="relative z-10 max-w-[1280px] mx-auto flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <a href="/sign-in" className="inline-flex items-center px-2.5 sm:px-4 py-2.5 text-sm font-medium" style={{ color: SM_INK_DIM }}>로그인</a>
          <a href="/sign-up" className="rounded-full px-4 sm:px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03]"
            style={{ background: GOLD, color: SM_SURFACE }}>무료로 시작</a>
        </div>
      </nav>

      {/* ── 데스크톱: 영상 위 좌측 카피 ── */}
      <div className="hidden sm:flex relative z-10 max-w-[1280px] mx-auto px-8 items-center"
        style={{ minHeight: 'calc(100vh - 88px)', paddingBottom: 'clamp(48px, 8vw, 96px)' }}>
        <HeroCopy />
      </div>

      {/* ── 모바일 A안: 위 카피(포레스트 단색) · 아래 저장고 이미지 ── */}
      <div className="sm:hidden relative z-10 flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div className="px-5 pt-6 pb-8">
          <HeroCopy />
        </div>
        <div className="relative flex-1 min-h-[44vh]">
          <Image src={HERO_BG_MOBILE} alt="" aria-hidden fill sizes="100vw" className="object-cover object-center" />
          {/* 상단 페이드 — 이미지가 위 카피 존으로 자연스럽게 녹아듦 */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-20 pointer-events-none"
            style={{ background: `linear-gradient(180deg, ${SM_SURFACE} 0%, transparent 100%)` }} />
        </div>
      </div>
    </section>
  )
}

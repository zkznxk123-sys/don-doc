'use client'

/**
 * VideoHeroLight — 라이트 시네마틱 비디오 히어로 (2026-07-07 미니멀).
 * full-bleed 자체제작 영상(투명 저장고 축적) + 로고 + eyebrow + H1(북극성) + CTA.
 * 사용자 결정(2026-07-07): 서브카피·nav 메뉴·햄버거·하위 섹션 전부 제거 → 히어로 단일 화면.
 */

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowRightCircle } from 'lucide-react'
import { BrandMark } from '@/components/ui/brand-mark'
import { ACCENT, INK, BG } from './tokens'

// 자체 제작 히어로 (Gemini 이미지 → Higgsfield). 워터마크 제거.
// 데스크톱 = 영상(가로, Kling i2v, 2560 샤픈) / 모바일 = 정지 이미지(세로 9:16) + 은은한 ken-burns.
// AI i2v가 "동전 진입·스택 성장" 모션을 못 살려서 모바일은 razor-sharp 정지 이미지로 결정(2026-07-07).
// 색상은 tokens.ts 단일 출처(§7). 로고는 골드 코인 wordmark(§6).
const VIDEO_SRC = '/landing/hero.mp4'
const IMG_POSTER = '/landing/hero-poster.jpg'
const IMG_MOBILE = '/landing/hero-mobile.jpg'
const VIDEO_FILTER = ''

// 북극성 흐름 3-step (본다→남긴다→옮긴다). 영문, 공모주 미노출·컴플라이언스 안전.
const STEPS = [
  { n: '01', t: 'See your cashflow' },
  { n: '02', t: 'Keep the surplus' },
  { n: '03', t: 'Build solid assets' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

function Logo() {
  // 골드 코인 wordmark — 라이트 랜딩에서 골드가 남는 유일한 자리(§6·§7-191).
  return <BrandMark variant="wordmark" size={20} />
}

export function VideoHeroLight() {
  const videoRef = useRef<HTMLVideoElement>(null)

  // WCAG 2.2.2 — reduced-motion 사용자는 자동재생 영상을 멈추고 poster(첫 프레임)만 노출.
  // framer 모션은 MotionConfig가 처리하지만 네이티브 video는 별도 가드가 필요.
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
    <section className="relative w-full min-h-screen overflow-hidden" style={{ color: INK, background: BG }}>
      {/* 배경 — 데스크톱: 영상 full-bleed / 모바일: 정지 이미지 + 은은한 ken-burns */}
      <video ref={videoRef} autoPlay muted loop playsInline preload="auto" aria-hidden poster={IMG_POSTER}
        style={{ filter: VIDEO_FILTER }}
        className="hidden sm:block absolute inset-0 w-full h-full object-cover object-center z-0">
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div aria-hidden
        className="sm:hidden absolute inset-0 z-0 hero-kenburns"
        style={{ backgroundImage: `url(${IMG_MOBILE})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      {/* 가독성 워시 — 텍스트(좌상단) 밝게. 모바일=상단 세로, 데스크톱=좌측 대각 */}
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none sm:hidden"
        style={{ background: 'linear-gradient(180deg, rgba(250,248,243,0.95) 0%, rgba(250,248,243,0.72) 32%, rgba(250,248,243,0.22) 60%, rgba(250,248,243,0) 80%)' }} />
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none hidden sm:block"
        style={{ background: 'linear-gradient(105deg, rgba(250,248,243,0.95) 0%, rgba(250,248,243,0.76) 32%, rgba(250,248,243,0.28) 56%, rgba(250,248,243,0) 74%)' }} />

      {/* ── navbar — 로고 + CTA만 (메뉴·햄버거 제거) ── */}
      <nav className="relative z-10 max-w-[1280px] mx-auto flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <a href="/sign-in" className="inline-flex items-center px-2.5 sm:px-5 py-2.5 text-sm font-medium sm:rounded-full sm:bg-[#F2EFE7]" style={{ color: INK }}>로그인</a>
          <a href="/sign-up" className="rounded-full px-4 sm:px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]" style={{ background: ACCENT }}>무료로 시작</a>
        </div>
      </nav>

      {/* ── hero content — eyebrow + H1 + CTA (서브카피 제거) ── */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-8" style={{ paddingTop: 'clamp(48px, 9vw, 96px)' }}>
        <div style={{ maxWidth: 620 }}>
          <motion.p
            custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="inline-flex items-center gap-2"
            style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.16em', color: ACCENT, marginBottom: 18 }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
            THE SIMPLEST WAY TO MANAGE MONEY
          </motion.p>

          {/* H1 = 북극성. "단순하게"만 포레스트 accent */}
          <motion.h1
            custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="font-black"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(2.3rem, 6.4vw, 4.2rem)', lineHeight: 1.06, letterSpacing: '-0.03em', color: INK, marginBottom: 26 }}
          >
            복잡한 투자,<br />
            <span style={{ color: ACCENT }}>단순하게.</span>
          </motion.h1>

          {/* 북극성 3-step — 모바일: 세로 스택(화살표 제거) / 데스크톱: 가로 + 화살표 */}
          <motion.div
            custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-2.5 sm:gap-x-3 mb-9"
            style={{ fontSize: 13 }}
          >
            {STEPS.map((s, i) => (
              <span key={s.n} className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span style={{ color: ACCENT, fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>{s.n}</span>
                  <span style={{ color: INK, fontWeight: 500 }}>{s.t}</span>
                </span>
                {i < STEPS.length - 1 && <span aria-hidden className="hidden sm:inline" style={{ color: INK, opacity: 0.28 }}>→</span>}
              </span>
            ))}
          </motion.div>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-between font-semibold text-white transition-transform hover:scale-[1.04]"
              style={{ background: ACCENT, borderRadius: 50, padding: '16px 24px', minWidth: 210, gap: 32, boxShadow: '0 4px 24px rgba(47,93,79,0.28)' }}
            >
              무료로 시작하기 <ArrowRightCircle className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

'use client'

/**
 * VideoHeroLight — 라이트 시네마틱 비디오 히어로 (2026-07-06).
 * motionsites VaultShield 프롬프트 참고: 풀스크린 비디오 + 아이콘 임베드 볼드 헤딩 +
 * framer fadeUp + 모바일 슬라이드 시트.
 *
 * 돈Doc 브랜드 적용 조정:
 * - 액센트 보라(#7342E2) → 포레스트 그린(#2F5D4F, 브랜드 primary).
 * - 헤딩 폰트 Helvetica Now Display(한글 글리프 없음·불안정 CDN) → Pretendard ExtraBold.
 * - 배경 라이트(#F2F2EE) → 돈Doc BG(#FAF8F3) 계열.
 * - 카피는 돈Doc 정본 태그라인. 비디오는 VIDEO_SRC 슬롯(자체 호스팅).
 */

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, Layers, Sparkles, ArrowRightCircle, Menu, X } from 'lucide-react'

const VIDEO_SRC = '/landing/hero2.mp4'          // 데스크톱(가로 16:9)
// 모바일 세로(9:16) 영상 — 있으면 폰에서 자동 사용(가로 crop 해소). Spline/Higgsfield에서 세로로 export 후
// public/landing/hero2-portrait.mp4 로 넣고 아래를 '/landing/hero2-portrait.mp4' 로 바꾸면 끝.
const VIDEO_SRC_MOBILE: string | null = null
const ACCENT = '#2F5D4F'
const INK = '#1A1F1E'
const BG = '#FAF8F3'

const NAV = ['소개', '요금', '설치', '소식', '도움말']

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

function Logo() {
  return (
    <span className="text-[19px] font-black tracking-[-0.02em]" style={{ color: INK }}>
      돈Doc
    </span>
  )
}

export function VideoHeroLight() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <section className="relative w-full min-h-screen overflow-hidden" style={{ color: INK, background: BG }}>
      {/* 풀스크린 배경 비디오 — 세로 영상이 있으면 폰에서 그걸, 없으면 가로 영상을 초점 오른쪽으로 당겨 crop 완화 */}
      {VIDEO_SRC_MOBILE ? (
        <>
          <video autoPlay muted loop playsInline preload="auto" aria-hidden
            className="hidden sm:block absolute inset-0 w-full h-full object-cover z-0">
            <source src={VIDEO_SRC} type="video/mp4" />
          </video>
          <video autoPlay muted loop playsInline preload="auto" aria-hidden
            className="sm:hidden absolute inset-0 w-full h-full object-cover z-0">
            <source src={VIDEO_SRC_MOBILE} type="video/mp4" />
          </video>
        </>
      ) : (
        <video autoPlay muted loop playsInline preload="auto" aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-[72%_42%] sm:object-center z-0">
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      )}
      {/* 라이트 가독성 워시 — 텍스트 영역(좌상단) 밝게. 모바일은 상단 세로 워시, 데스크톱은 좌측 대각 워시 */}
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none sm:hidden"
        style={{ background: 'linear-gradient(180deg, rgba(250,248,243,0.94) 0%, rgba(250,248,243,0.82) 30%, rgba(250,248,243,0.35) 52%, rgba(250,248,243,0.15) 78%, rgba(250,248,243,0.9) 100%)' }} />
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none hidden sm:block"
        style={{ background: 'linear-gradient(105deg, rgba(250,248,243,0.92) 0%, rgba(250,248,243,0.72) 34%, rgba(250,248,243,0.25) 60%, rgba(250,248,243,0) 100%)' }} />

      {/* ── navbar ── */}
      <nav className="relative z-10 max-w-[1280px] mx-auto flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
        <Link href="/"><Logo /></Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV.map((t) => (
            <a key={t} href="#" className="opacity-70 hover:opacity-100 transition-opacity" style={{ color: INK }}>{t}</a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <a href="/sign-up" className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]" style={{ background: ACCENT }}>무료로 시작</a>
          <a href="/sign-in" className="rounded-full px-5 py-2.5 text-sm font-medium" style={{ background: '#F2EFE7', color: INK }}>로그인</a>
        </div>
        <button className="md:hidden p-2" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기"><Menu className="w-6 h-6" style={{ color: INK }} /></button>
      </nav>

      {/* ── hero content ── */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-8" style={{ paddingTop: 'clamp(40px, 8vw, 72px)' }}>
        <div style={{ maxWidth: 620 }}>
          <motion.h1
            custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="font-black"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(1.9rem, 5.4vw, 3.4rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: INK, marginBottom: 24 }}
          >
            <IconInline><Wallet /></IconInline> 흩어진 자산을{' '}
            <IconInline><Layers /></IconInline> 한 화면에{' '}
            <IconInline><Sparkles /></IconInline>
          </motion.h1>

          <motion.p
            custom={1} variants={fadeUp} initial="hidden" animate="visible"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', lineHeight: 1.65, opacity: 0.82, maxWidth: 560, color: INK }}
          >
            현금·금융·부동산·연금·부채를 한 곳에. 분류와 분석은 AI가 —
            매달 정리는 10분이면 끝납니다.
          </motion.p>

          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="mt-9">
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

      {/* ── 모바일 슬라이드 시트 ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)}
              style={{ background: 'rgba(26,31,30,0.35)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            />
            <motion.div
              className="fixed right-0 top-0 z-50 md:hidden flex flex-col"
              style={{ width: 'min(88vw, 360px)', height: '100dvh', background: '#EFEBE3', boxShadow: '-12px 0 48px rgba(26,31,30,0.18)' }}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
            >
              <div className="flex items-center justify-between px-6 py-5">
                <Logo />
                <button onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기"><X className="w-6 h-6" style={{ color: INK }} /></button>
              </div>
              <div className="h-px mx-6" style={{ background: 'rgba(26,31,30,0.12)' }} />
              <div className="flex flex-col px-6 py-6 gap-1">
                {NAV.map((t, i) => (
                  <motion.a
                    key={t} href="#" className="py-3 text-lg font-medium" style={{ color: INK }}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.07 }}
                  >{t}</motion.a>
                ))}
              </div>
              <div className="mt-auto px-6 pb-8 flex flex-col gap-2">
                <a href="/sign-up" className="rounded-full px-5 py-3 text-center text-sm font-semibold text-white" style={{ background: ACCENT }}>무료로 시작</a>
                <a href="/sign-in" className="rounded-full px-5 py-3 text-center text-sm font-medium" style={{ background: '#F2EFE7', color: INK }}>로그인</a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}

/** 헤딩 인라인 아이콘 — 텍스트 baseline에 맞춰 살짝 올림 */
function IconInline({ children }: { children: React.ReactElement }) {
  return (
    <span className="inline-flex align-middle relative" style={{ top: -2, color: ACCENT }}>
      {/* 24px, accent */}
      <span className="[&>svg]:w-6 [&>svg]:h-6">{children}</span>
    </span>
  )
}

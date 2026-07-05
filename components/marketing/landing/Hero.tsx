'use client'

/**
 * Hero — v5 라이브 프로덕트 스테이지 (2026-07-05).
 * 사용자 결정: 히어로 3안 실렌더 비교 → "안 1 라이브 프로덕트" 선택.
 *
 * v4 → v5 변경:
 * - 세로 중앙 정렬 → 좌우 분할: 좌 카피(기존 문구 유지) / 우 LiveBoard(살아있는 미니 대시보드)
 * - 정적 ScreenshotMockup 하단 배치 폐기 — 제품 증명은 LiveBoard가 첫 화면에서 수행
 * - 모바일: 카피 센터 정렬 → 보드 아래 스택
 *
 * v4 유지 요소: floating orb 2개, eyebrow dot pulse, 카피 stagger, 이탤릭 단어 SVG draw, grid dot ambient.
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { ACCENT, BG, INK, INK_DIM, INK_FAINT } from './tokens'
import { LiveBoard } from './LiveBoard'

export function Hero() {
  return (
    <div className="relative px-6 md:px-14 pt-20 pb-28 lg:pt-28 lg:pb-36 overflow-hidden">
      {/* 두 개의 floating gradient orb — 천천히 부드럽게 motion. mouse 영향 없음 (정적이지만 살아있는 느낌) */}
      <motion.div
        className="pointer-events-none absolute -top-32 left-1/4 w-[900px] h-[900px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(47,93,79,0.10) 0%, rgba(47,93,79,0.03) 40%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, 60, -40, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 24, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 right-1/4 w-[700px] h-[700px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(180,155,62,0.08) 0%, rgba(180,155,62,0.02) 40%, transparent 70%)`,
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, -50, 30, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* 미세 grid dot — ambient noise. 정적. 라이트 BG에서는 dark ink dot이 살짝 보임 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `radial-gradient(circle, ${INK} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
        {/* ── 좌: 카피 (모바일 센터, 데스크톱 좌측 정렬) ── */}
        <div className="text-center lg:text-left">
          {/* 짧은 라벨 — accent dot pulse */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-[11px] tracking-[0.22em] uppercase font-semibold mb-8 inline-flex items-center gap-2"
            style={{ color: ACCENT }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{
                background: ACCENT,
                boxShadow: '0 0 10px rgba(47,93,79,0.55)',
                animation: 'cpDot 1.6s ease-in-out infinite',
              }}
            />
            가장 쉬운 자산 관리
          </motion.p>

          {/* 큰 카피 — 단어 단위 stagger. "한 화면에"는 별도 wrapping (밑줄 draw 위) */}
          <h1
            className="font-serif font-medium leading-[1.05] tracking-[-0.03em] text-[48px] sm:text-[64px] lg:text-[72px]"
            style={{ color: INK }}
          >
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
              className="block"
            >
              흩어진 자산을
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              className="font-serif italic font-normal inline-block relative mt-2"
              style={{ color: ACCENT }}
            >
              한 화면에.
              <svg
                viewBox="0 0 320 16"
                preserveAspectRatio="none"
                className="absolute left-0 right-0 -bottom-3 w-full h-3"
                aria-hidden
              >
                <path
                  d="M 4 11 Q 80 3 160 8 T 316 7"
                  stroke={ACCENT}
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="600"
                  style={{ animation: 'cpDraw 1.6s ease-out 0.9s both' }}
                />
              </svg>
            </motion.span>
          </h1>

          {/* 짧은 sub */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
            className="text-base lg:text-[17px] leading-[1.6] mt-10 max-w-[480px] mx-auto lg:mx-0"
            style={{ color: INK_DIM }}
          >
            현금·금융·부동산·연금·부채를 한 곳에. 분류와 분석은 AI가
            <br />— 매달 정리는 10분이면 끝납니다.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.65, ease: 'easeOut' }}
            className="flex flex-wrap gap-2.5 justify-center lg:justify-start mt-10"
          >
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[13px] font-semibold transition-all active:scale-[0.97] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--landing-bg)]"
              style={{ background: INK, color: BG }}
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[13px] font-medium transition-all hover:bg-black/5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--landing-bg)]"
              style={{ color: INK, border: `1px solid ${INK_FAINT}` }}
            >
              데모 둘러보기
            </a>
          </motion.div>
        </div>

        {/* ── 우: 라이브 보드 — 제품이 직접 증명 ── */}
        <LiveBoard />
      </div>
    </div>
  )
}

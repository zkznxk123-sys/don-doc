'use client'

/**
 * Hero — 미니멀 v3 (2026-06-11 동적 인터랙션 추가).
 * 사용자 6/11 input: "동적 인터랙션도 추가되면 시선을 확 끌수 있지 않을까"
 *
 * 변경 (v2 → v3):
 * - 정적 단일 ambient → 두 개의 floating gradient orb (천천히 회전·이동, mouse 영향 없음)
 * - 큰 카피 단순 fade → 글자 단위 stagger 입장
 * - "한 화면에" 이탤릭 단어 아래 ACCENT 라인이 SVG path로 천천히 그려짐
 * - hero 위쪽에 미세한 grid dot 패턴 (정적, ambient noise)
 * Antigravity 참조 — 추상 flow + 부드러운 모션 + 광활한 여백.
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { ACCENT, BG, CREAM, CREAM_DIM, CREAM_FAINT } from './tokens'

export function Hero() {
  return (
    <div className="relative px-6 md:px-14 pt-20 pb-32 lg:pt-28 lg:pb-40 overflow-hidden">
      {/* 두 개의 floating gradient orb — 천천히 부드럽게 motion. mouse 영향 없음 (정적이지만 살아있는 느낌) */}
      <motion.div
        className="pointer-events-none absolute -top-32 left-1/4 w-[900px] h-[900px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(180,155,62,0.12) 0%, rgba(180,155,62,0.04) 40%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, 60, -40, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 24, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 right-1/4 w-[700px] h-[700px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(47,93,79,0.10) 0%, rgba(47,93,79,0.03) 40%, transparent 70%)`,
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, -50, 30, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* 미세 grid dot — ambient noise. 정적 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle, ${CREAM} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
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
              boxShadow: '0 0 12px rgba(180,155,62,0.9)',
              animation: 'cpDot 1.6s ease-in-out infinite',
            }}
          />
          한 사람의 자산 본부
        </motion.p>

        {/* 큰 카피 — 단어 단위 stagger. "한 화면에"는 별도 wrapping (밑줄 draw 위) */}
        <h1
          className="font-serif font-medium leading-[1.0] tracking-[-0.03em] text-[56px] sm:text-[80px] lg:text-[112px]"
          style={{ color: CREAM }}
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
          className="text-base lg:text-[17px] leading-[1.6] mt-12 max-w-[480px] mx-auto"
          style={{ color: CREAM_DIM }}
        >
          현금·금융·부동산·연금·부채를 한 곳에 모으고, AI가 분류·분석까지 연결합니다.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.65, ease: 'easeOut' }}
          className="flex flex-wrap gap-2.5 justify-center mt-12"
        >
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[13px] font-semibold transition-all active:scale-[0.97] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49B3E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F0E]"
            style={{ background: CREAM, color: BG }}
          >
            무료로 시작하기
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="/demo"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[13px] font-medium transition-all hover:bg-white/5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49B3E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F0E]"
            style={{ color: CREAM, border: `1px solid ${CREAM_FAINT}` }}
          >
            데모 둘러보기
          </a>
        </motion.div>
      </div>
    </div>
  )
}

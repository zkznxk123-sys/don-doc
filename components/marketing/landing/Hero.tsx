'use client'

/**
 * Hero — 미니멀 v2 (2026-06-11 재설계).
 * 디렉션: Antigravity 스타일 — 단일 큰 카피·미니멀 모션·광활한 여백.
 * 사용자 6/11 input: "첫 인상이 너무 복잡하다. 심플한데 눈에 확 띄는 형태였으면 좋겠음."
 * 이전 버전: spotlight + 마우스 트래킹 + 3-slice 카드 데모 (392줄)
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { ACCENT, BG, CREAM, CREAM_DIM, CREAM_FAINT } from './tokens'

export function Hero() {
  return (
    <div className="relative px-6 md:px-14 pt-20 pb-32 lg:pt-28 lg:pb-40 overflow-hidden">
      {/* 미니멀 ambient — 정적 단일 라인 (이전: 마우스 트래킹 spotlight 제거) */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 w-[1200px] h-[1200px]"
        style={{
          background: `radial-gradient(circle, rgba(180,155,62,0.08) 0%, rgba(180,155,62,0.02) 40%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* 짧은 라벨 — accent */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-[11px] tracking-[0.22em] uppercase font-semibold mb-8"
          style={{ color: ACCENT }}
        >
          한 사람의 자산 본부
        </motion.p>

        {/* 큰 카피 — Antigravity 스타일. 사용자 6/11: "카피는 나쁘지 않은듯" → 유지 */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          className="font-serif font-medium leading-[1.0] tracking-[-0.03em] text-[56px] sm:text-[80px] lg:text-[112px]"
          style={{ color: CREAM }}
        >
          흩어진 자산을
          <br />
          <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
            한 화면에.
          </span>
        </motion.h1>

        {/* 짧은 sub — 보조 문구 */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: 'easeOut' }}
          className="text-base lg:text-[17px] leading-[1.6] mt-10 max-w-[480px] mx-auto"
          style={{ color: CREAM_DIM }}
        >
          현금·금융·부동산·연금·부채를 한 곳에 모으고, AI가 분류·분석까지 연결합니다.
        </motion.p>

        {/* CTA — 단일 primary + ghost. 후순위라 작게 */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }}
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

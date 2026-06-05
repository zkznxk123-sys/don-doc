'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'
import { CountUp } from '../CountUp'
import { ACCENT, BG, BG_3, CREAM, CREAM_DIM, CREAM_FAINT, FOREST, POSITIVE } from './tokens'

export function Hero() {
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
            className="font-serif font-medium leading-[1.05] tracking-tight text-[44px] sm:text-[56px] lg:text-[68px]"
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
              className="flex items-center justify-between px-[18px] py-[12px] shrink-0"
              style={{ borderBottom: `1px solid ${CREAM_FAINT}`, background: 'rgba(0,0,0,0.3)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-[22px] h-[22px] rounded-md inline-flex items-center justify-center shrink-0"
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
                      <p className="text-[8px] m-0 tracking-widest uppercase" style={{ color: CREAM_DIM }}>
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
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0"
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
                <p className="text-[10px] m-0 mt-1.5 leading-normal" style={{ color: CREAM_DIM }}>
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
                  <span className="text-[9px] font-medium px-2 py-1 rounded-md shrink-0" style={{ background: CREAM, color: BG }}>
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

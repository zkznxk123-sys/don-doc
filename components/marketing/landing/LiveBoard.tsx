'use client'

/**
 * Hero 우측 라이브 보드 — "제품이 직접 증명하는" 미니 대시보드.
 * 정적 스크린샷 대신 실동작: 순자산 serif 카운트업 → 차트 draw-on → 자산 행 stagger.
 * 3D 틸트 + 마우스 패럴랙스 (reduced-motion이면 정지).
 *
 * 금액은 가상의 예시 가족 데이터 (실사용자 아님·종목 없음).
 */

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, PiggyBank, Banknote } from 'lucide-react'
import { CountUp } from '../CountUp'
import { ACCENT, INK, INK_DIM, INK_FAINT } from './tokens'

const ROWS = [
  { name: '금융자산', amount: '1.8억', dot: ACCENT },
  { name: '부동산', amount: '6.5억', dot: '#B49B3E' },
  { name: '연금', amount: '9,400만', dot: 'rgba(47,93,79,0.45)' },
  { name: '부채', amount: '−1.2억', dot: '#b0533e', tone: '#b0533e' },
]

const CHIPS = [
  { label: '부동산 6.5억', icon: Home, style: { left: -14, top: -18 }, delay: '0s' },
  { label: '연금 9,400만', icon: PiggyBank, style: { right: 18, top: 26 }, delay: '1.4s' },
  { label: '현금 3,200만', icon: Banknote, style: { left: -34, bottom: -16 }, delay: '2.3s' },
] as const

export function LiveBoard() {
  const boardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 5, y: -10 })
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const onMove = (ev: React.MouseEvent) => {
    if (reduced.current || !boardRef.current) return
    const r = boardRef.current.getBoundingClientRect()
    setTilt({
      x: 5 - (ev.clientY - (r.top + r.height / 2)) / 60,
      y: -10 + (ev.clientX - (r.left + r.width / 2)) / 60,
    })
  }
  const onLeave = () => setTilt({ x: 5, y: -10 })

  return (
    <div className="relative" style={{ perspective: 1400 }} onMouseMove={onMove} onMouseLeave={onLeave}>
      {/* 떠다니는 자산 칩 — 보드 밖에서 살아있는 느낌 */}
      {CHIPS.map(({ label, icon: Icon, style, delay }) => (
        <span
          key={label}
          aria-hidden
          className="absolute z-10 hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold"
          style={{
            ...style,
            background: '#fff',
            color: INK_DIM,
            border: `1px solid ${INK_FAINT}`,
            boxShadow: '0 10px 24px -10px rgba(26,31,30,0.2)',
            animation: `lbBob 5s ease-in-out ${delay} infinite`,
          }}
        >
          <Icon className="w-3 h-3" style={{ color: ACCENT }} />
          {label}
        </span>
      ))}

      <motion.div
        ref={boardRef}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="rounded-[20px] p-6 sm:p-7 bg-white"
        style={{
          border: `1px solid ${INK_FAINT}`,
          boxShadow: '-30px 40px 80px -30px rgba(26,31,30,0.25), 0 10px 30px -10px rgba(26,31,30,0.10)',
          // 틸트는 framer 스타일 채널로 — 수동 transform은 framer 애니메이션이 덮어씀
          rotateX: tilt.x,
          rotateY: tilt.y,
          transformPerspective: 1400,
          transformStyle: 'preserve-3d',
        }}
      >
        <p className="text-xs font-medium" style={{ color: INK_DIM }}>가족 순자산</p>
        <p
          className="font-serif font-bold tabular-nums tracking-[-0.02em] text-[38px] sm:text-[44px] leading-tight mt-1"
          style={{ color: INK }}
        >
          <CountUp to={8.4} decimals={1} duration={1600} suffix="억" />
        </p>
        <p className="text-xs tabular-nums mt-0.5" style={{ color: INK_DIM }}>
          ₩842,180,000 · 총자산 9.6억
        </p>

        {/* 12개월 추이 스파크라인 — 선이 실시간으로 그려짐 */}
        <svg viewBox="0 0 560 120" className="w-full h-[84px] mt-4 mb-1" aria-hidden>
          <defs>
            <linearGradient id="lbFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(47,93,79,0.18)" />
              <stop offset="100%" stopColor="rgba(47,93,79,0)" />
            </linearGradient>
          </defs>
          <motion.path
            d="M0 95 C60 90 100 82 160 78 C220 74 260 64 320 52 C380 40 420 38 480 26 C510 20 540 16 560 12 L560 120 L0 120 Z"
            fill="url(#lbFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 2.6 }}
          />
          <motion.path
            d="M0 95 C60 90 100 82 160 78 C220 74 260 64 320 52 C380 40 420 38 480 26 C510 20 540 16 560 12"
            stroke={ACCENT}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.9, ease: 'easeOut' }}
          />
        </svg>

        {ROWS.map(({ name, amount, dot, tone }, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 + i * 0.25, ease: 'easeOut' }}
            className="flex items-center justify-between py-2.5 text-[13.5px] border-t"
            style={{ borderColor: 'rgba(26,31,30,0.07)' }}
          >
            <span className="flex items-center gap-2" style={{ color: INK }}>
              <span className="w-2 h-2 rounded-[3px]" style={{ background: dot }} />
              {name}
            </span>
            <span className="tabular-nums font-semibold" style={{ color: tone ?? INK }}>{amount}</span>
          </motion.div>
        ))}
      </motion.div>

      <style jsx global>{`
        @keyframes lbBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @media (prefers-reduced-motion: reduce) { [style*='lbBob'] { animation: none !important; } }
      `}</style>
    </div>
  )
}

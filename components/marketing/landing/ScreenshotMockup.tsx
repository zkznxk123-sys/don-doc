'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ACCENT, BG_2, BG_3, INK, INK_DIM, INK_FAINT } from './tokens'

/**
 * Hero 아래 들어가는 macOS-window chrome mockup.
 * PODO·Linear·Stripe 동일 패턴 — chrome은 코드, 콘텐츠만 PNG.
 *
 * 사용자가 /demo 1440×900에서 2x retina로 캡처 후
 * public/landing/hero-screenshot.png 넣으면 hasImage=true로 toggle.
 *
 * 비율 16:10 (PODO·Stripe 표준), 2x retina 해상도 가정.
 */
export function ScreenshotMockup() {
  const hasImage = true // public/landing/hero-screenshot.png (2880×1800, /demo lite 캡처)

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.85, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative max-w-[1200px] mx-auto mt-20 px-4"
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: BG_2,
          border: `1px solid ${INK_FAINT}`,
          boxShadow: '0 30px 80px -20px rgba(26,31,30,0.15), 0 10px 30px -10px rgba(26,31,30,0.08)',
        }}
      >
        {/* macOS chrome bar */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ background: BG_3, borderColor: INK_FAINT }}
        >
          <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          <span
            className="ml-4 px-3 py-1 rounded-md text-[11px] font-medium tabular-nums"
            style={{
              background: 'rgba(26,31,30,0.05)',
              color: INK_DIM,
              border: `1px solid ${INK_FAINT}`,
            }}
          >
            dondoc.app/demo
          </span>
        </div>

        {/* content */}
        {hasImage ? (
          <Image
            src="/landing/hero-screenshot.png"
            alt="돈독 대시보드 — 12개월 순자산 추이, 자산 5종 카드, 카테고리 분석"
            width={2880}
            height={1800}
            priority
            className="w-full h-auto block"
          />
        ) : (
          <Placeholder />
        )}
      </div>
    </motion.div>
  )
}

/**
 * 스크린샷 파일 추가 전 placeholder.
 * 라이트 BG에 어울리는 무빙 그라데이션 + 자산 일러스트 아이콘.
 */
function Placeholder() {
  return (
    <div
      className="relative w-full"
      style={{ paddingTop: '62.5%', background: BG_2 }} // 16:10 비율
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        {/* 미세 grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle, ${INK} 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
        {/* 부드러운 forest tint glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(47,93,79,0.10) 0%, transparent 70%)`,
            filter: 'blur(60px)',
          }}
        />
        <div className="relative">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] tracking-[0.2em] uppercase font-semibold"
            style={{ color: ACCENT, background: `${ACCENT}14`, border: `1px solid ${ACCENT}33` }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: ACCENT, boxShadow: '0 0 8px rgba(47,93,79,0.5)' }}
            />
            데모 미리보기
          </div>
          <p
            className="font-serif font-medium tracking-[-0.02em] mt-5 text-[24px] sm:text-[32px]"
            style={{ color: INK }}
          >
            5종 자산 통합 대시보드
          </p>
          <p className="mt-3 text-[13px] leading-[1.6] max-w-[420px] mx-auto" style={{ color: INK_DIM }}>
            12개월 순자산 추이 · 자산 구성 · 카테고리별 현금흐름. <br />
            바로 위 “데모 둘러보기”에서 실제 데이터로 체험할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  )
}

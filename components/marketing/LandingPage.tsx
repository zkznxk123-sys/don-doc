'use client'

import { Suspense } from 'react'
import { MotionConfig } from 'framer-motion'
import { DemoErrorBanner } from './landing/DemoErrorBanner'
import { AnnouncementBar } from './landing/AnnouncementBar'
import { Nav } from './landing/Nav'
import { Hero } from './landing/Hero'
import { CoreFeatures } from './landing/CoreFeatures'
import { ComparisonSection } from './landing/ComparisonSection'
import { ClosingSection } from './landing/ClosingSection'
import { ACCENT, BG, INK } from './landing/tokens'
import { isFull } from '@/lib/feature-flags'

/**
 * 2026-06-11 라이트 단일 전환 + designer v2 권고 반영:
 * - dark-luxury 폐기, ACCENT gold → forest green(#2F5D4F), BG → warm off-white(#FAF8F3).
 * - WCAG 2.3.3: Hero orb framer-motion JS 모션은 CSS prefers-reduced-motion 가드가 못
 *   막아서 <MotionConfig reducedMotion="user">로 트리 전체 감쌈. transform 기반(orb
 *   x/y)은 멈추고 opacity 입장은 fade로 살아남는 가장 싼 해법.
 * - Closing은 lite에도 노출 (가족·시나리오 언급 0, lite 실물과 일치 + 마감 CTA 보강).
 *   Comparison은 full 전용 유지(가족 기능 행 노출 우려).
 */
export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="min-h-screen"
        style={{
          background: BG,
          color: INK,
          fontFamily: 'var(--font-sans)',
          // focus ring 등 클래스에서 참조하는 단일 출처 — tokens.ts와 동기
          '--landing-accent': ACCENT,
          '--landing-bg': BG,
        } as React.CSSProperties}
      >
        {/* keyframes — landing 전용. CSS 가드는 cpDot/cpDraw 한정 (orb는 framer가 MotionConfig로 처리). */}
        <style jsx global>{`
          @keyframes cpDot { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
          @keyframes cpDraw { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }

          @media (prefers-reduced-motion: reduce) {
            [style*="cpDot"], [style*="cpDraw"] { animation: none !important; }
            * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
          }
        `}</style>

        <Suspense><DemoErrorBanner /></Suspense>

        <AnnouncementBar />
        <Nav />
        <Hero />
        <CoreFeatures />
        {isFull() && <ComparisonSection />}
        <ClosingSection />
      </div>
    </MotionConfig>
  )
}

'use client'

import { Suspense } from 'react'
import { DemoErrorBanner } from './landing/DemoErrorBanner'
import { AnnouncementBar } from './landing/AnnouncementBar'
import { Nav } from './landing/Nav'
import { Hero } from './landing/Hero'
import { CoreFeatures } from './landing/CoreFeatures'
import { ComparisonSection } from './landing/ComparisonSection'
import { ClosingSection } from './landing/ClosingSection'
import { BG, CREAM } from './landing/tokens'
import { isFull } from '@/lib/feature-flags'

/**
 * 2026-06-11 라이트 단일 전환:
 * - 사용자 input: "다크가 부담스러워서" → dark-luxury 폐기.
 * - tokens.ts 값만 라이트 팔레트로 교체 (이름은 호환 유지, 추후 rename PR).
 * - ACCENT gold → forest green (#2F5D4F), BG dark canvas → warm off-white(#FAF8F3).
 *
 * 흐름 (기능 중심): Hero → CoreFeatures → Comparison(full) → Closing(full).
 * lite는 진입 마찰 ↓ 위해 Hero+CoreFeatures만.
 */
export function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: BG, color: CREAM, fontFamily: 'var(--font-sans)' }}
    >
      {/* keyframes — landing 전용. WCAG 2.3.3 reduced-motion 가드 포함. */}
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
      {isFull() && <ClosingSection />}
    </div>
  )
}

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
 * 2026-06-11 재구성:
 * - 제거: TechStackStrip · ApproachSection (4-step AI 파이프라인) · PowerfulTechnology (3-tier 라우팅·CLIProxy)
 *   사용자 input: "경진대회용 기술적인 것들 다 빼고 기능적으로 재구성"
 * - Hero 미니멀 v2 (Antigravity 스타일)
 * - 흐름: Hero → CoreFeatures(기능 4가지) → Comparison(뱅샐 대비) → Closing
 *   full만 Comparison·Closing 노출 (lite는 진입 마찰 ↓ 위해 Hero+CoreFeatures만)
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

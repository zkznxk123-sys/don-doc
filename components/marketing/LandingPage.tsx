'use client'

import { Suspense } from 'react'
import { DemoErrorBanner } from './landing/DemoErrorBanner'
import { AnnouncementBar } from './landing/AnnouncementBar'
import { Nav } from './landing/Nav'
import { Hero } from './landing/Hero'
import { TechStackStrip } from './landing/TechStackStrip'
import { ApproachSection } from './landing/ApproachSection'
import { CoreFeatures } from './landing/CoreFeatures'
import { PowerfulTechnology } from './landing/PowerfulTechnology'
import { ComparisonSection } from './landing/ComparisonSection'
import { ClosingSection } from './landing/ClosingSection'
import { BG, CREAM } from './landing/tokens'
import { isFull } from '@/lib/feature-flags'

export function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: BG, color: CREAM, fontFamily: 'var(--font-sans)' }}
    >
      {/* keyframes — global to this landing only.
          WCAG 2.3.3: prefers-reduced-motion 사용자는 모든 데코 모션 정지. */}
      <style jsx global>{`
        @keyframes cpDot { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes cpTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes cpDraw { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }

        @media (prefers-reduced-motion: reduce) {
          [style*="cpDot"], [style*="cpDraw"] { animation: none !important; }
          .inline-flex[style*="cpTicker"], div[style*="cpTicker"] { animation: none !important; }
          * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
        }
      `}</style>

      <Suspense><DemoErrorBanner /></Suspense>

      <AnnouncementBar />
      <Nav />
      <Hero />
      <TechStackStrip />
      {/* full 전용 섹션 — lite에는 가족·시나리오 등이 없으므로 광고-실물 불일치 차단.
          designer-2026-06-10-v2 권고. 본격 lite 전용 랜딩 재작성은 별도 스프린트. */}
      {isFull() && <ApproachSection />}
      <CoreFeatures />
      {isFull() && <PowerfulTechnology />}
      {isFull() && <ComparisonSection />}
      {isFull() && <ClosingSection />}
    </div>
  )
}

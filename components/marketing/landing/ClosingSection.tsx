import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ACCENT, BG, CREAM, CREAM_DIM, CREAM_FAINT } from './tokens'

/**
 * 2026-06-11 v2: 추상 "분석하는 AI / 실행하는 AI" 카피 제거.
 * 사용자 디렉션: "경진대회 흔적 제거, 기능적으로 재구성"
 * 단순 마감 — 한 줄 카피 + CTA + footer.
 */
export function ClosingSection() {
  return (
    <div
      className="relative px-6 md:px-14 py-24 md:py-[120px]"
      style={{
        background: `linear-gradient(180deg, ${BG} 0%, #050706 100%)`,
        borderTop: `1px solid ${CREAM_FAINT}`,
      }}
    >
      <div className="max-w-5xl mx-auto">
        <h2
          className="font-serif font-medium leading-[1.05] tracking-[-0.03em] text-center text-[40px] sm:text-[56px] lg:text-[72px] m-0"
          style={{ color: CREAM }}
        >
          이번 달 정리,{' '}
          <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
            지금 시작하세요
          </span>
          .
        </h2>

        <p
          className="text-[15px] sm:text-[16px] leading-[1.7] text-center max-w-[560px] mx-auto m-0 mt-10"
          style={{ color: CREAM_DIM }}
        >
          엑셀을 한 번 올리면, AI가 분류하고 분석합니다. 매달 같은 흐름.
        </p>

        <div className="flex flex-wrap gap-3 justify-center mt-14">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-[14px] font-semibold transition active:scale-[0.97] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49B3E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F0E]"
            style={{ background: CREAM, color: BG }}
          >
            무료로 시작하기
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="/demo"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-[14px] font-medium transition hover:bg-white/5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49B3E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F0E]"
            style={{ color: CREAM, border: `1px solid ${CREAM_FAINT}` }}
          >
            데모 둘러보기
          </a>
        </div>

        <div
          className="mt-20 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px]"
          style={{ borderTop: `1px solid ${CREAM_FAINT}`, color: CREAM_DIM }}
        >
          <span>© 2026 돈Doc · 한 사람의 자산 본부</span>
          <span className="flex gap-6">
            <a href="/demo" className="hover:opacity-80">데모</a>
            <Link href="/sign-in" className="hover:opacity-80">로그인</Link>
            <Link href="/sign-up" className="hover:opacity-80">시작하기</Link>
          </span>
        </div>
      </div>
    </div>
  )
}

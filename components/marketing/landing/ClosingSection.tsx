import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ACCENT, BG, CREAM, CREAM_DIM, CREAM_FAINT } from './tokens'

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
        <p
          className="text-[11px] tracking-[0.18em] uppercase font-semibold text-center m-0 mb-6"
          style={{ color: ACCENT }}
        >
          다음 단계
        </p>

        <h2
          className="font-serif font-medium leading-[1.05] tracking-[-0.03em] text-center text-[36px] sm:text-[52px] lg:text-[72px] m-0"
          style={{ color: CREAM }}
        >
          지금은{' '}
          <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
            분석하는 AI
          </span>
          ,
          <br />
          다음은{' '}
          <span className="inline-block relative mx-2">
            <span
              className="font-serif italic font-normal"
              style={{ color: ACCENT }}
            >
              실행하는 AI
            </span>
            <svg
              viewBox="0 0 200 14"
              preserveAspectRatio="none"
              className="absolute left-0 right-0 -bottom-2 w-full h-3"
            >
              <path
                d="M 4 9 Q 50 2 100 7 T 196 6"
                stroke={ACCENT}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="600"
                style={{ animation: 'cpDraw 1.6s ease-out 0.2s both' }}
              />
            </svg>
          </span>
          .
        </h2>

        <p
          className="text-[15px] sm:text-[16px] leading-[1.7] text-center max-w-[700px] mx-auto m-0 mt-10"
          style={{ color: CREAM_DIM }}
        >
          지금 돈Doc은 가족 자산을 구조화하고 시나리오까지 제안합니다.
          <br />
          <br />
          다음 단계는 — 예산 관리, 리마인드, 실행 체크, 후속 액션까지{' '}
          <em style={{ color: ACCENT }}>AI 에이전트가 직접 실행</em>하는 플랫폼.
          <br />
          가족의 재무 데이터를 실제 금융 행동까지 연결하는 의사결정 파트너로 진화합니다.
        </p>

        <div className="flex flex-wrap gap-3 justify-center mt-14">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-[14px] font-semibold transition active:scale-[0.97] hover:opacity-90"
            style={{ background: CREAM, color: BG }}
          >
            무료로 시작하기
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="/demo"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-[14px] font-medium transition hover:bg-white/5 active:scale-[0.97]"
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

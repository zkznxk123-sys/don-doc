'use client'

/**
 * /about — 소개 페이지(서비스 철학·북극성 중심). Solid Modern 다크.
 * 콘텐츠 근거: BRAND_GUIDE §2(북극성·투자 재정의·미션)·§3(3-Layer)·§5(보이스).
 * ⚠️ 컴플라이언스: "투자=단단한 자산 축적" 정의를 카피로 가르친다. 추천·타이밍 표현 금지.
 */

import { MotionConfig } from 'framer-motion'
import { Users, Coins, FileText } from 'lucide-react'
import {
  MarketingNav, PageHero, SectionHead, Reveal, Gold, ClosingCta, MarketingFooter,
} from './marketing-chrome'
import {
  SM_SURFACE, SM_PANEL, SM_INK, SM_INK_DIM, SM_HAIRLINE, GOLD, GOLD_SOFT,
} from './landing/tokens'

// 북극성 리듬(본다→남긴다→옮긴다) — 히어로 영문 3-step과 연결.
const RHYTHM = [
  { n: '01', en: 'See your cashflow', ko: '흐름을 본다', d: '버는 흐름과 나가는 흐름을 먼저 본다. 판단은 그다음이다.' },
  { n: '02', en: 'Keep the surplus', ko: '여유를 남긴다', d: '쓰고 남는 돈을 만든다. 여유가 있어야 옮길 것이 생긴다.' },
  { n: '03', en: 'Build solid assets', ko: '자산으로 옮긴다', d: '남긴 돈을 단단한 자산으로 꾸준히 옮긴다. 그게 축적이다.' },
]

// 이름 풀이(돈 + Doc = 돈독) — 로고 해설(글리프·앵커)이 아니라 사용자 언어로 (2026-07-10 재검토).
const MEANING = [
  { Icon: Coins, t: '돈 — 숫자가 주인공', d: '이름의 앞은 돈. 이번 달 얼마가 들어오고, 남고, 쌓였는지 — 숫자를 가장 또렷하게 보여줍니다.' },
  { Icon: FileText, t: 'Doc — 기록이 쌓임', d: '이름의 뒤는 Doc, 기록입니다. 매달 10분씩 같은 흐름으로 쌓인 기록이 다음 판단의 근거가 됩니다.' },
  { Icon: Users, t: '그래서, 돈독', d: '돈 얘기는 어색하기 쉽습니다. 자산이 한 화면에 모이면 가족과 나누는 돈 얘기가 짧고 편해집니다.' },
]

export function AboutPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen" style={{ background: SM_SURFACE, color: SM_INK, fontFamily: 'var(--font-sans)' }}>
        <MarketingNav active="/about" />

        <PageHero
          eyebrow="소개"
          title={<>복잡한 투자,<br /><Gold>단순하게.</Gold></>}
          sub={<>현금흐름으로 만든 여유자금을 단단한 자산으로 꾸준히 옮기는 것<br />— 그게 우리가 말하는 투자입니다.</>}
          primary={{ href: '/product', label: '제품 보기' }}
          secondary={{ href: '/demo', label: '데모 체험' }}
        />

        {/* 1. 투자의 재정의 (컴플라이언스 정합 프레이밍) */}
        <section className="px-6 md:px-14 py-20 md:py-28" style={{ background: SM_PANEL, borderTop: `1px solid ${SM_HAIRLINE}` }}>
          <div className="max-w-[1280px] mx-auto grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-20 items-start">
            <Reveal><SectionHead kicker="우리가 말하는 투자" title={<>종목 고르기가<br /><Gold>아닙니다.</Gold></>} /></Reveal>
            <Reveal delay={0.1}>
              <p className="text-lg lg:text-[20px] leading-[1.65]" style={{ color: SM_INK }}>
                여기서 투자는 매매도, 타이밍도 아닙니다.<br /><span style={{ color: GOLD }}>여유자금을 단단한 자산으로 꾸준히 옮기는 습관</span>입니다.
              </p>
              <p className="text-base leading-[1.75] mt-6" style={{ color: SM_INK_DIM }}>
                추천이 아니라 축적, 타이밍이 아니라 이동입니다. 돈독은 "무엇을 사라"고 말하지 않습니다.<br />흩어진 자산을 한 화면에 모아, 스스로 더 나은 판단을 하도록 복잡함을 걷어낼 뿐입니다.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 2. 북극성 리듬 (본다→남긴다→옮긴다) */}
        <section className="px-6 md:px-14 py-20 md:py-28" style={{ background: SM_SURFACE }}>
          <div className="max-w-[1280px] mx-auto">
            <Reveal><SectionHead kicker="북극성" title={<>본다 · 남긴다 · <Gold>옮긴다.</Gold></>}
              body="복잡한 걸 외울 필요 없이, 세 걸음의 리듬만 기억하면 됩니다." /></Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-12">
              {RHYTHM.map((r, i) => (
                <Reveal key={r.n} delay={i * 0.08}>
                  <div className="rounded-[18px] p-7 h-full" style={{ background: SM_PANEL, border: `1px solid ${SM_HAIRLINE}` }}>
                    <span className="font-black text-[13px] tracking-[0.06em]" style={{ color: GOLD }}>{r.n}</span>
                    <p className="text-[13px] tracking-[0.02em] mt-3" style={{ color: SM_INK_DIM }}>{r.en}</p>
                    <h3 className="font-bold text-[24px] tracking-[-0.02em] mt-1" style={{ color: SM_INK }}>{r.ko}</h3>
                    <p className="text-[13.5px] leading-[1.65] mt-3" style={{ color: SM_INK_DIM }}>{r.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 3. 미션 (왜 만들었나) — serif 풀인용 */}
        <section className="px-6 md:px-14 py-24 md:py-32" style={{ background: SM_PANEL, borderTop: `1px solid ${SM_HAIRLINE}` }}>
          <div className="max-w-3xl mx-auto text-center">
            <Reveal>
              <p className="text-[11px] tracking-[0.18em] uppercase font-semibold mb-6" style={{ color: GOLD }}>우리가 만든 이유</p>
              <p className="font-serif italic text-[28px] sm:text-[36px] leading-[1.4]" style={{ color: SM_INK }}>
                “복잡하게 흩어진 자산을 가장 쉽게<br />한 화면으로 통합하는 도구.”
              </p>
              <p className="text-base leading-[1.75] mt-8 max-w-xl mx-auto" style={{ color: SM_INK_DIM }}>
                금융은 어렵게 굴수록 사람을 멀어지게 합니다. 돈독은 그 반대로 갑니다.<br />혼자 써도 충분하고, 필요하면 가족·동업자와 선별적으로 공유합니다.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 4. 이름 이야기 (돈독) */}
        <section className="px-6 md:px-14 py-20 md:py-28" style={{ background: SM_SURFACE }}>
          <div className="max-w-[1280px] mx-auto">
            <Reveal><SectionHead kicker="이름" title={<>돈 관리는 똑똑하게,<br />관계는 더 <Gold>돈독하게.</Gold></>} /></Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-12">
              {MEANING.map((m, i) => (
                <Reveal key={m.t} delay={i * 0.07}>
                  <div className="rounded-[18px] p-7 h-full" style={{ background: SM_PANEL, border: `1px solid ${SM_HAIRLINE}` }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: GOLD_SOFT, color: GOLD }}>
                      <m.Icon className="w-[18px] h-[18px]" />
                    </div>
                    <h3 className="font-bold text-[20px] tracking-[-0.02em] mt-5" style={{ color: SM_INK }}>{m.t}</h3>
                    <p className="text-[13.5px] leading-[1.65] mt-2" style={{ color: SM_INK_DIM }}>{m.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <ClosingCta title={<>흩어진 자산을, <Gold>한 화면에.</Gold></>} />
        <MarketingFooter />
      </div>
    </MotionConfig>
  )
}

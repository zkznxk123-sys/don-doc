'use client'

/**
 * /product — 제품 페이지(기능·사용법 중심). Solid Modern 다크.
 * 히어로에서 뺀 "제품이 뭘 하는지" 설명을 여기서 전개(2026-07-09 결정: 히어로 영문 유지).
 * 콘텐츠 근거: BRAND_GUIDE §2(북극성 4단계)·CoreFeatures·공모주 모듈.
 * ⚠️ 컴플라이언스: 사실 기록·정렬만. 종목 추천·비례 유불리 예측 금지.
 */

import { Upload, Tags, TrendingUp, CalendarCheck, Wallet, PiggyBank, Landmark, Repeat } from 'lucide-react'
import { MotionConfig } from 'framer-motion'
import {
  MarketingNav, PageHero, SectionHead, Reveal, Gold, ClosingCta, MarketingFooter,
} from './marketing-chrome'
import {
  SM_SURFACE, SM_PANEL, SM_INK, SM_INK_DIM, SM_HAIRLINE, GOLD, GOLD_SOFT,
} from './landing/tokens'

// 북극성 정의 = 제품 4단계 (BRAND_GUIDE §2 표).
const STEPS = [
  { n: '01', Icon: Wallet, t: '흐름을 본다', tag: '현금흐름 관리', d: '버는 흐름과 나가는 흐름을 한 화면에서 봅니다. 어디서 새는지 먼저 보입니다.' },
  { n: '02', Icon: PiggyBank, t: '여유를 남긴다', tag: '예산·저축률', d: '쓰고 남는 돈을 매달 만듭니다. 저축률이 스스로 목표가 됩니다.' },
  { n: '03', Icon: Landmark, t: '단단한 자산으로', tag: '자산 관리', d: '남긴 돈을 질 좋은 자산으로 옮깁니다. 흩어진 자산도 한 화면으로 모읍니다.' },
  { n: '04', Icon: Repeat, t: '꾸준히 옮긴다', tag: '매달 10분 정리', d: '한 번 세팅하면 다음부터는 습관입니다. 매달 같은 흐름으로 마감합니다.' },
]

// 핵심 기능 4카드 (CoreFeatures 정합 — 다크 톤).
const FEATURES = [
  { Icon: Upload, t: '엑셀 한 번 업로드', d: '뱅크샐러드·증권사 엑셀을 그대로 올리면 5종 자산(현금·금융·부동산·연금·부채)으로 자동 분리합니다.' },
  { Icon: Tags, t: 'AI 자동 분류', d: '거래·계좌·종목을 AI가 카테고리에 매핑합니다. 한 번 확정한 매핑은 다음부터 자동 적용됩니다.' },
  { Icon: TrendingUp, t: '순자산 한 화면', d: '12개월 추이·자산 구성·전월 대비 변동을 한 차트에. 어디서 늘고 줄었는지 즉시 파악합니다.' },
  { Icon: CalendarCheck, t: '월 결산 자동화', d: '내역·카테고리·예산·저축률까지 매달 같은 흐름으로. 한 번 세팅하면 매달 10분에 마감합니다.' },
]

// 시작 흐름 3스텝.
const HOW = [
  { n: '1', t: '엑셀을 올린다', d: '가진 계좌·증권사 엑셀을 그대로 업로드.' },
  { n: '2', t: 'AI가 분류한다', d: '5종 자산으로 자동 분리 — 확인만 하면 끝.' },
  { n: '3', t: '매달 확인한다', d: '다음부터는 변동만 한눈에. 매달 10분.' },
]

export function ProductPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen" style={{ background: SM_SURFACE, color: SM_INK, fontFamily: 'var(--font-sans)' }}>
        <MarketingNav active="/product" />

        <PageHero
          eyebrow="제품"
          title={<>흩어진 자산을,<br /><Gold>한 화면에.</Gold></>}
          sub="현금·금융·부동산·연금·부채를 한 곳에. 분류와 분석은 AI가 — 매달 정리는 10분이면 끝납니다."
          primary={{ href: '/sign-up', label: '무료로 시작하기' }}
          secondary={{ href: '/demo', label: '데모 체험' }}
        />

        {/* 1. 북극성 4단계 */}
        <section className="px-6 md:px-14 py-20 md:py-28" style={{ background: SM_PANEL, borderTop: `1px solid ${SM_HAIRLINE}` }}>
          <div className="max-w-[1280px] mx-auto">
            <Reveal>
              <SectionHead kicker="어떻게 단단해지나" title={<>복잡한 투자를<br /><Gold>네 걸음</Gold>으로.</>}
                body="투자를 종목 고르기로 보지 않습니다. 흐름을 보고, 여유를 남기고, 단단한 자산으로 꾸준히 옮기는 것 — 그 습관을 네 걸음으로 나눴습니다." />
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-12">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.06}>
                  <div className="rounded-[18px] p-7 h-full flex flex-col gap-5" style={{ background: SM_SURFACE, border: `1px solid ${SM_HAIRLINE}` }}>
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: GOLD_SOFT, color: GOLD }}>
                        <s.Icon className="w-[18px] h-[18px]" />
                      </div>
                      <span className="font-black text-[26px] tracking-tight" style={{ color: GOLD, opacity: 0.5 }}>{s.n}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[21px] tracking-[-0.02em]" style={{ color: SM_INK }}>{s.t}</h3>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: GOLD_SOFT, color: GOLD }}>{s.tag}</span>
                      </div>
                      <p className="text-[13.5px] leading-[1.65] mt-2.5" style={{ color: SM_INK_DIM }}>{s.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 2. 핵심 기능 4카드 */}
        <section className="px-6 md:px-14 py-20 md:py-28" style={{ background: SM_SURFACE }}>
          <div className="max-w-[1280px] mx-auto">
            <Reveal>
              <SectionHead kicker="핵심 기능" title={<>엑셀 한 번으로<br /><Gold>월 정리 10분.</Gold></>}
                body="매달 엑셀·시트 사이를 옮겨 다니는 시간을 줄입니다. 모으는 건 한 번, 이후엔 변동만 봅니다." />
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-12">
              {FEATURES.map((f, i) => (
                <Reveal key={f.t} delay={i * 0.06}>
                  <div className="rounded-[18px] p-7 min-h-[190px] h-full flex flex-col justify-between" style={{ background: SM_PANEL, border: `1px solid ${SM_HAIRLINE}` }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: GOLD_SOFT, color: GOLD }}>
                      <f.Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[21px] tracking-[-0.02em]" style={{ color: SM_INK }}>{f.t}</h3>
                      <p className="text-[13.5px] leading-[1.65] mt-2" style={{ color: SM_INK_DIM }}>{f.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 공모주 모듈은 공개 제품 페이지에 미노출 — 초대제 웨지(특정 접근 URL)로만 안내. (2026-07-09) */}

        {/* 시작 흐름 3스텝 */}
        <section className="px-6 md:px-14 py-20 md:py-28" style={{ background: SM_SURFACE }}>
          <div className="max-w-[1280px] mx-auto">
            <Reveal><SectionHead center kicker="시작은 3분" title={<>세팅은 한 번,<br /><Gold>이후엔 습관.</Gold></>} /></Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-12">
              {HOW.map((h, i) => (
                <Reveal key={h.n} delay={i * 0.08}>
                  <div className="rounded-[18px] p-7 h-full text-center" style={{ background: SM_PANEL, border: `1px solid ${SM_HAIRLINE}` }}>
                    <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center font-black text-[17px]" style={{ background: GOLD, color: SM_SURFACE }}>{h.n}</div>
                    <h3 className="font-bold text-[19px] tracking-[-0.02em] mt-5" style={{ color: SM_INK }}>{h.t}</h3>
                    <p className="text-[13.5px] leading-[1.6] mt-2" style={{ color: SM_INK_DIM }}>{h.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <ClosingCta title={<>복잡한 투자, <Gold underline={false}>단순하게.</Gold></>} />
        <MarketingFooter />
      </div>
    </MotionConfig>
  )
}

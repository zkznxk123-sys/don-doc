'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import {
  Sparkles, Shield, BarChart3, ArrowRight,
} from 'lucide-react'
import { DemoErrorBanner } from './landing/DemoErrorBanner'
import { Hero } from './landing/Hero'
import { Section } from './landing/Section'
import {
  ACCENT, BG, BG_2, BG_3, CREAM, CREAM_DIM, CREAM_FAINT, FOREST, POSITIVE,
} from './landing/tokens'

export function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: BG, color: CREAM, fontFamily: 'var(--font-sans)' }}
    >
      {/* keyframes — global to this landing only */}
      <style jsx global>{`
        @keyframes cpDot { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes cpTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes cpDraw { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }
      `}</style>

      <Suspense><DemoErrorBanner /></Suspense>

      {/* ── ANNOUNCEMENT BAR ───────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-2.5 px-6 md:px-14 py-2.5 text-[12px] text-center"
        style={{ background: BG_3, color: CREAM, borderBottom: `1px solid ${CREAM_FAINT}` }}
      >
        <span
          className="text-[10px] tracking-[0.14em] uppercase font-semibold"
          style={{ color: ACCENT }}
        >
          데모
        </span>
        <span style={{ color: 'rgba(241,236,227,0.78)' }}>로그인 없이 데모 즉시 체험 가능</span>
        <a
          href="/demo"
          className="underline font-medium hover:opacity-80"
          style={{ color: CREAM }}
        >
          데모 열기 →
        </a>
      </div>

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-14 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/brand-mark-dark.svg"
              alt="돈Doc"
              width={32}
              height={32}
              priority
            />
            <span className="font-black text-[16px] tracking-[-0.02em]" style={{ color: CREAM }}>
              돈Doc
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/demo"
            className="hidden sm:inline-flex text-[12px] px-3 py-1.5 hover:opacity-80"
            style={{ color: CREAM_DIM }}
          >
            데모
          </a>
          <Link
            href="/sign-in"
            className="text-[12px] px-3 py-1.5 hover:opacity-80"
            style={{ color: CREAM_DIM }}
          >
            로그인
          </Link>
          <Link
            href="/sign-up"
            className="text-[12px] font-semibold px-[18px] py-2.5 rounded-full transition hover:opacity-90"
            style={{ background: CREAM, color: BG }}
          >
            무료 시작
          </Link>
        </div>
      </nav>

      <Hero />

      {/* ── TECH STACK STRIP ────────────────────────────────────────────────── */}
      <div
        className="relative py-8 md:py-10"
        style={{ borderTop: `1px solid ${CREAM_FAINT}`, borderBottom: `1px solid ${CREAM_FAINT}` }}
      >
        <p
          className="text-[11px] tracking-[0.18em] uppercase text-center m-0 mb-6"
          style={{ color: CREAM_DIM }}
        >
          엔드 투 엔드로 직접 설계 · 구현
        </p>
        <div className="overflow-hidden whitespace-nowrap">
          <div
            className="inline-flex gap-14 items-center"
            style={{ animation: 'cpTicker 24s linear infinite' }}
          >
            {[...Array(2)].flatMap((_, copy) =>
              ['Next.js 14', 'Prisma 5', 'PostgreSQL', 'Clerk', 'Vercel AI SDK', 'CLIProxyAPI', 'Tailwind', 'shadcn/ui', 'Zod', 'Recharts'].map((p, i) => (
                <span
                  key={`${copy}-${i}`}
                  className="font-serif font-medium tracking-[-0.02em] text-[20px] sm:text-[22px]"
                  style={{
                    color: 'rgba(241,236,227,0.4)',
                    fontStyle: i % 3 === 0 ? 'italic' : 'normal',
                  }}
                >
                  {p}
                </span>
              )),
            )}
          </div>
        </div>
      </div>

      {/* ── APPROACH — AI 4-STEP PIPELINE ─────────────────────────────────── */}
      <Section
        kicker="설계 철학"
        title={
          <>
            AI를 호출이 아닌,
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              4단계 파이프라인
            </span>
            으로
          </>
        }
        body="단순한 LLM 콜이 아니라 — 데이터 구조화 → 반복업무 자동화 → 분석·시나리오 → 실행 검증까지. 사용자 상황에 맞는 모델 선택과 결과 검증까지 포함한 의사결정 구조로 설계했습니다."
        bg={BG}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-12">
          {[
            { n: '01', t: '데이터 구조화', d: '엑셀·앱 등 비정형 데이터를 AI가 처리 가능한 구조로 변환', tone: ACCENT },
            { n: '02', t: '반복업무 자동화', d: '거래 분류·정리 등 반복 작업을 AI 자동화로 대체', tone: FOREST },
            { n: '03', t: '분석 → 실행 연결', d: '분석 결과를 실행 가능한 행동(시나리오·액션 플랜)으로 변환', tone: '#8B6E1E' },
            { n: '04', t: '실행 구조 검증', d: '모델 라우팅 + 비용 최적화 + HITL로 신뢰성 확보', tone: '#5A4830' },
          ].map(p => (
            <div
              key={p.n}
              className="rounded-[18px] p-[22px] flex flex-col justify-between min-h-[260px]"
              style={{
                background: `linear-gradient(180deg, ${p.tone}22 0%, ${BG_2} 100%)`,
                border: `1px solid ${CREAM_FAINT}`,
              }}
            >
              <div
                className="font-serif font-medium text-[36px] tracking-[-0.02em] mb-3.5"
                style={{ color: p.tone }}
              >
                {p.n}
              </div>
              <div>
                <p
                  className="font-serif font-medium text-[22px] m-0 tracking-[-0.02em]"
                  style={{ color: CREAM }}
                >
                  {p.t}
                </p>
                <p className="text-[12px] m-0 mt-2 leading-[1.6]" style={{ color: CREAM_DIM }}>
                  {p.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 4 CORE FEATURES (deck slide 10) ─────────────────────────────────── */}
      <Section
        kicker="구현된 4가지"
        title={
          <>
            모으기 → 정리하기 →
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              분석하기 → 실행하기
            </span>
          </>
        }
        body="흩어진 자산을 한곳에 모으고, AI가 정리·분석·실행까지 연결하는 웹 기반 자산 운영 시스템. 혼자 써도 충분하고, 필요하면 가족·동업자와 선별 공유."
        bg={BG_2}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-12">
          {[
            {
              Icon: BarChart3,
              t: '가족 자산 통합 대시보드',
              d: '가족 구성원의 자산·부채·현금흐름을 한 화면에서 통합 조회. 순자산·월간 흐름·자산구성을 즉시 파악.',
            },
            {
              Icon: Sparkles,
              t: '현금흐름 + AI 자동분류',
              d: '엑셀 업로드 → AI가 카테고리 자동 분류·구조화. 사용자 검증·수정 루프(HITL)로 정확도 지속 개선.',
            },
            {
              Icon: ArrowRight,
              t: 'AI 시나리오 허브',
              d: '관심 컨텐츠 + 자산 데이터를 결합해 가족 라이프 이벤트(주택·은퇴·교육)별 시뮬레이션과 액션 플랜 자동 생성.',
            },
            {
              Icon: Shield,
              t: '가족 커뮤니케이션 + AI 대화',
              d: '같은 데이터를 함께 보고, AI 채팅으로 시나리오를 구체화. 거래 카드 첨부·멘션·댓글로 의사결정 가속.',
            },
          ].map(s => (
            <div
              key={s.t}
              className="rounded-[18px] p-7 min-h-[200px] flex flex-col justify-between"
              style={{ background: BG, border: `1px solid ${CREAM_FAINT}` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${ACCENT}1A`, color: ACCENT }}
              >
                <s.Icon className="w-[18px] h-[18px]" />
              </div>
              <div>
                <p
                  className="font-serif font-medium text-[22px] m-0 tracking-[-0.02em]"
                  style={{ color: CREAM }}
                >
                  {s.t}
                </p>
                <p
                  className="text-[13px] m-0 mt-2 leading-[1.6]"
                  style={{ color: CREAM_DIM }}
                >
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── POWERFUL TECHNOLOGY — AI INFRASTRUCTURE ────────────────────────── */}
      <Section
        kicker="AI 인프라"
        title={
          <>
            아이디어가 아닌 —
            <br />
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              운영 가능한 시스템
            </span>
          </>
        }
        body="3-tier 모델 라우팅 · 자동 폴백 · HITL 검증 루프 · CLIProxy 멀티 프로바이더. 단순 LLM 호출이 아니라 비용·성능·신뢰성을 균형있게 잡은 AI 시스템 아키텍처를 직접 설계했습니다."
        bg={BG}
      >
        <div className="grid lg:grid-cols-[1.4fr_1fr_1fr] gap-4 mt-12">
          {/* Big tile — 3-tier model routing */}
          <div
            className="rounded-[20px] p-6 min-h-[320px]"
            style={{ background: BG_2, border: `1px solid ${CREAM_FAINT}` }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p
                  className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
                  style={{ color: ACCENT }}
                >
                  3-tier 모델 라우팅
                </p>
                <p
                  className="font-serif font-medium m-0 mt-1.5 tracking-[-0.02em] text-[28px] sm:text-[32px] leading-[1.15]"
                  style={{ color: CREAM }}
                >
                  작업 난이도에 맞춰
                  <br />
                  <span style={{ color: ACCENT }}>비용·성능 자동 균형</span>
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {[
                { tier: 'FAST', use: '거래 자동분류 · 일괄 재분류', model: 'Haiku 4.5 / gpt-4o-mini / Gemini 2.0 Flash', tone: POSITIVE },
                { tier: 'BALANCED', use: 'AI 인사이트 · 시나리오 채팅', model: 'Sonnet 4.6 / gpt-4o / Gemini 2.5 Flash', tone: ACCENT },
                { tier: 'SMART', use: '시나리오 생성 · 실행계획 확장', model: 'Opus 4.7 / o4-mini / Gemini 2.5 Pro', tone: '#E59A6E' },
              ].map(r => (
                <div
                  key={r.tier}
                  className="rounded-[10px] p-3 flex items-center gap-3"
                  style={{ background: 'rgba(241,236,227,0.04)', border: `1px solid ${CREAM_FAINT}` }}
                >
                  <span
                    className="text-[10px] tracking-[0.14em] font-semibold px-2 py-0.5 rounded"
                    style={{ background: `${r.tone}1A`, color: r.tone, minWidth: 78, textAlign: 'center' }}
                  >
                    {r.tier}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium m-0" style={{ color: CREAM }}>
                      {r.use}
                    </p>
                    <p className="text-[10px] m-0 mt-0.5 truncate" style={{ color: CREAM_DIM }}>
                      {r.model}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] m-0 mt-3" style={{ color: CREAM_DIM }}>
              429 쿨다운 시 smart → balanced → fast 자동 폴백
            </p>
          </div>

          {/* Tile — HITL */}
          <div
            className="rounded-[20px] p-6 min-h-[320px] flex flex-col"
            style={{ background: BG_2, border: `1px solid ${CREAM_FAINT}` }}
          >
            <p
              className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
              style={{ color: ACCENT }}
            >
              Human-in-the-loop
            </p>
            <p
              className="font-serif font-medium text-[24px] m-0 mt-1.5 tracking-[-0.02em] leading-[1.2]"
              style={{ color: CREAM }}
            >
              AI 출력 →
              <br />
              사용자 검증 → <span style={{ color: ACCENT }}>반영</span>
            </p>
            <div className="mt-4 flex flex-col gap-2 flex-1">
              {[
                { l: '거래 재분류', d: 'Preview Modal · old → new 매핑 검증' },
                { l: '시나리오 추천', d: '관심/패스 비율 → 다음 생성 컨텍스트' },
                { l: '카테고리 학습', d: 'keyword → category 자동 누적' },
              ].map(r => (
                <div
                  key={r.l}
                  className="rounded-[8px] px-3 py-2"
                  style={{ background: 'rgba(241,236,227,0.04)' }}
                >
                  <p className="text-[12px] font-semibold m-0" style={{ color: CREAM }}>
                    {r.l}
                  </p>
                  <p className="text-[10px] m-0 mt-0.5" style={{ color: CREAM_DIM }}>
                    {r.d}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] m-0 mt-2" style={{ color: CREAM_DIM }}>
              사용자 행동 = 학습 신호
            </p>
          </div>

          {/* Tile — CLIProxy multi-provider */}
          <div
            className="rounded-[20px] p-6 min-h-[320px] flex flex-col"
            style={{ background: BG_2, border: `1px solid ${CREAM_FAINT}` }}
          >
            <p
              className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
              style={{ color: ACCENT }}
            >
              CLIProxy 추상화
            </p>
            <p
              className="font-serif font-medium text-[24px] m-0 mt-1.5 tracking-[-0.02em] leading-[1.2]"
              style={{ color: CREAM }}
            >
              본인 구독 계정으로
              <br />
              <span style={{ color: ACCENT }}>직접 연결</span>
            </p>
            <div className="mt-4 flex flex-col gap-1.5 flex-1">
              {[
                { l: 'Claude', d: 'Anthropic Pro/Max' },
                { l: 'ChatGPT', d: 'OpenAI Plus/Pro' },
                { l: 'Gemini', d: 'Google Advanced' },
                { l: 'API 키', d: 'OpenAI 직접 호출 fallback' },
              ].map((r, i) => (
                <div
                  key={r.l}
                  className="flex justify-between items-center py-2"
                  style={i ? { borderTop: `1px solid ${CREAM_FAINT}` } : {}}
                >
                  <span className="text-[12px] font-medium" style={{ color: CREAM }}>
                    {r.l}
                  </span>
                  <span className="text-[10px]" style={{ color: CREAM_DIM }}>
                    {r.d}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-2 px-3 py-2.5 rounded-[10px] flex items-center gap-2"
              style={{ background: `${ACCENT}1A`, border: `1px solid ${ACCENT}40` }}
            >
              <Sparkles className="w-3 h-3" style={{ color: ACCENT }} />
              <span className="text-[11px] font-medium" style={{ color: ACCENT }}>
                가족별 OAuth 라우팅 지원
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── COMPARISON ─────────────────────────────────────────────────────── */}
      <Section
        kicker="비교"
        title={
          <>
            개인 가계부와
            <br />
            엑셀 수작업{' '}
            <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
              사이의 공백
            </span>
          </>
        }
        body="가계부 앱은 카드 내역 정도만, 엑셀 수작업은 시간이 너무 든다 — 그 사이 한 사람이 5종 자산을 통합 운영하는 도구는 비어 있었습니다. 돈Doc은 이 공백을 채웁니다."
        bg={BG_2}
      >
        <div
          className="mt-10 rounded-[20px] overflow-hidden overflow-x-auto"
          style={{ border: `1px solid ${CREAM_FAINT}`, background: BG }}
        >
          <div className="min-w-[640px]">
            {/* header */}
            <div
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr]"
              style={{ background: BG_3, borderBottom: `1px solid ${CREAM_FAINT}` }}
            >
              <div className="px-6 py-5">
                <p
                  className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
                  style={{ color: CREAM_DIM }}
                >
                  기능
                </p>
              </div>
              {[
                { l: '돈Doc', highlight: true },
                { l: '개인 가계부 앱', highlight: false },
                { l: '엑셀 수작업', highlight: false },
              ].map(c => (
                <div
                  key={c.l}
                  className="px-6 py-5 text-center"
                  style={{
                    borderLeft: `1px solid ${CREAM_FAINT}`,
                    background: c.highlight ? `${ACCENT}1A` : 'transparent',
                  }}
                >
                  <p
                    className="font-serif font-medium text-[18px] m-0 tracking-[-0.02em]"
                    style={{ color: c.highlight ? ACCENT : CREAM }}
                  >
                    {c.l}
                  </p>
                </div>
              ))}
            </div>

            {/* rows — deck slide 6 페인포인트 + 실제 구현 기능만 */}
            {[
              { f: '엑셀 업로드 → AI 자동 분류 (HITL)', a: true, b: 'half' as const, c: false },
              { f: '가족 단위 자산·부채·현금흐름 통합', a: true, b: false, c: 'half' as const },
              { f: '3-Layer 가족 권한 분리 (Role/Share/Visibility)', a: true, b: false, c: false },
              { f: 'AI 시나리오 생성 + 실행 액션', a: true, b: false, c: false },
              { f: '본인 구독 계정 직접 연결 (Claude/ChatGPT/Gemini)', a: true, b: false, c: false },
              { f: '월 정리 시간', a: '30분' as const, b: '수시' as const, c: '3~4h' as const },
            ].map((r, i) => (
              <div
                key={r.f}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr]"
                style={i ? { borderTop: `1px solid ${CREAM_FAINT}` } : {}}
              >
                <div className="px-6 py-[18px] text-[13px]" style={{ color: CREAM }}>
                  {r.f}
                </div>
                {[r.a, r.b, r.c].map((v, j) => (
                  <div
                    key={j}
                    className="px-6 py-[18px] text-center"
                    style={{
                      borderLeft: `1px solid ${CREAM_FAINT}`,
                      background: j === 0 ? `${ACCENT}0D` : 'transparent',
                    }}
                  >
                    {v === true && (
                      <span
                        className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                        style={{ background: j === 0 ? ACCENT : POSITIVE, color: BG }}
                      >
                        ✓
                      </span>
                    )}
                    {v === false && (
                      <span
                        className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-[12px]"
                        style={{ background: CREAM_FAINT, color: CREAM_DIM }}
                      >
                        —
                      </span>
                    )}
                    {v === 'half' && (
                      <span className="text-[11px] italic" style={{ color: CREAM_DIM }}>
                        일부
                      </span>
                    )}
                    {typeof v === 'string' && v !== 'half' && (
                      <span
                        className="text-[12px]"
                        style={{
                          color: j === 0 ? ACCENT : CREAM_DIM,
                          fontWeight: j === 0 ? 600 : 400,
                        }}
                      >
                        {v}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── CLOSING ────────────────────────────────────────────────────────── */}
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
    </div>
  )
}

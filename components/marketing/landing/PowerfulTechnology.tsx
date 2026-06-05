import { Sparkles } from 'lucide-react'
import { Section } from './Section'
import { ACCENT, BG, BG_2, CREAM, CREAM_DIM, CREAM_FAINT, POSITIVE } from './tokens'

export function PowerfulTechnology() {
  return (
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
  )
}

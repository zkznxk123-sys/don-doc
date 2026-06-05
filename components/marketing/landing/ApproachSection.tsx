import { Section } from './Section'
import { ACCENT, BG, BG_2, CREAM, CREAM_DIM, CREAM_FAINT, FOREST } from './tokens'

export function ApproachSection() {
  return (
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
  )
}

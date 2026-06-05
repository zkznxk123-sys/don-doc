import { Sparkles, Shield, BarChart3, ArrowRight } from 'lucide-react'
import { Section } from './Section'
import { ACCENT, BG, BG_2, CREAM, CREAM_DIM, CREAM_FAINT } from './tokens'

export function CoreFeatures() {
  return (
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
  )
}

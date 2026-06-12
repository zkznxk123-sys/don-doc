import { Upload, Sparkles, TrendingUp, Calendar } from 'lucide-react'
import { Section } from './Section'
import { ACCENT, BG, BG_2, INK, INK_DIM, INK_FAINT } from './tokens'

/**
 * 2026-06-11 v2: 기능 중심 4 카드 — 양쪽 라인 공통 본질 가치.
 * 이전: 가족 강조·HITL·시나리오 허브 (경진대회 잔재 + lite 광고-실물 불일치 우려)
 * 사용자 디렉션: "기능적으로 재구성, 경진대회 흔적 제거"
 */
export function CoreFeatures() {
  return (
    <Section
      kicker="핵심 기능"
      title={
        <>
          엑셀 한 번으로
          <br />
          <span className="font-serif italic font-normal" style={{ color: ACCENT }}>
            월 정리 30분
          </span>
        </>
      }
      body="현금·금융·부동산·연금·부채를 한 곳에 모으고, AI가 분류·정리·분석까지 연결합니다. 매달 엑셀·시트 사이를 옮겨 다니는 시간을 줄입니다."
      bg={BG_2}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-12">
        {[
          {
            Icon: Upload,
            t: '엑셀 한 번 업로드',
            d: '뱅크샐러드·증권사 엑셀을 그대로 올리면 5종 자산(현금·금융·부동산·연금·부채)으로 자동 분리.',
          },
          {
            Icon: Sparkles,
            t: 'AI 자동 분류',
            d: '거래·계좌·종목을 AI가 카테고리에 매핑. 한 번 확정한 매핑은 다음부터 자동 적용.',
          },
          {
            Icon: TrendingUp,
            t: '순자산 한 화면',
            d: '12개월 추이·자산 구성·전월 대비 변동을 한 차트에. 어디서 늘었고 줄었는지 즉시 파악.',
          },
          {
            Icon: Calendar,
            t: '월 결산 자동화',
            d: '거래 내역·카테고리·예산·저축률까지 매달 같은 흐름으로. 한 번 세팅 → 매달 30분 안에 마감.',
          },
        ].map(s => (
          <div
            key={s.t}
            className="rounded-[18px] p-7 min-h-[200px] flex flex-col justify-between"
            style={{ background: BG, border: `1px solid ${INK_FAINT}` }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: `${ACCENT}1A`, color: ACCENT }}
            >
              <s.Icon className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h3
                className="font-serif font-medium text-[22px] m-0 tracking-[-0.02em]"
                style={{ color: INK }}
              >
                {s.t}
              </h3>
              <p
                className="text-[13px] m-0 mt-2 leading-[1.6]"
                style={{ color: INK_DIM }}
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

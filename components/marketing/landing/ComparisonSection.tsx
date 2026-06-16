import { Section } from './Section'
import { ACCENT, BG, BG_2, BG_3, INK, INK_DIM, INK_FAINT, POSITIVE } from './tokens'

export function ComparisonSection() {
  return (
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
      body="가계부 앱은 카드 내역 정도만, 엑셀 수작업은 시간이 너무 든다 — 그 사이 5종 자산을 한 곳에서 통합 운영하는 도구는 비어 있었습니다. 돈Doc은 이 공백을 채웁니다."
      bg={BG_2}
    >
      <div
        className="mt-10 rounded-[20px] overflow-hidden overflow-x-auto"
        style={{ border: `1px solid ${INK_FAINT}`, background: BG }}
      >
        <div className="min-w-[640px]">
          {/* header */}
          <div
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr]"
            style={{ background: BG_3, borderBottom: `1px solid ${INK_FAINT}` }}
          >
            <div className="px-6 py-5">
              <p
                className="text-[10px] tracking-[0.14em] uppercase font-semibold m-0"
                style={{ color: INK_DIM }}
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
                  borderLeft: `1px solid ${INK_FAINT}`,
                  background: c.highlight ? `${ACCENT}1A` : 'transparent',
                }}
              >
                <p
                  className="font-serif font-medium text-[18px] m-0 tracking-[-0.02em]"
                  style={{ color: c.highlight ? ACCENT : INK }}
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
            { f: '월 정리 시간', a: '10분' as const, b: '수시' as const, c: '3~4h' as const },
          ].map((r, i) => (
            <div
              key={r.f}
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr]"
              style={i ? { borderTop: `1px solid ${INK_FAINT}` } : {}}
            >
              <div className="px-6 py-[18px] text-[13px]" style={{ color: INK }}>
                {r.f}
              </div>
              {[r.a, r.b, r.c].map((v, j) => (
                <div
                  key={j}
                  className="px-6 py-[18px] text-center"
                  style={{
                    borderLeft: `1px solid ${INK_FAINT}`,
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
                      style={{ background: INK_FAINT, color: INK_DIM }}
                    >
                      —
                    </span>
                  )}
                  {v === 'half' && (
                    <span className="text-[11px] italic" style={{ color: INK_DIM }}>
                      일부
                    </span>
                  )}
                  {typeof v === 'string' && v !== 'half' && (
                    <span
                      className="text-[12px]"
                      style={{
                        color: j === 0 ? ACCENT : INK_DIM,
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
  )
}

import { SM_RAISED, SM_INK, SM_INK_DIM, SM_HAIRLINE, GOLD } from './tokens'

export function AnnouncementBar() {
  // Solid Modern 다크 — 히어로와 정합(brand-guide-2.0).
  return (
    <div
      className="flex items-center justify-center gap-2.5 px-6 md:px-14 py-2.5 text-[12px] text-center"
      style={{ background: SM_RAISED, color: SM_INK, borderBottom: `1px solid ${SM_HAIRLINE}` }}
    >
      <span
        className="text-[10px] tracking-[0.14em] uppercase font-semibold"
        style={{ color: GOLD }}
      >
        데모
      </span>
      <span style={{ color: SM_INK_DIM }}>로그인 없이 데모 즉시 체험 가능</span>
      <a
        href="/demo"
        className="underline font-medium hover:opacity-80"
        style={{ color: SM_INK }}
      >
        데모 열기 →
      </a>
    </div>
  )
}

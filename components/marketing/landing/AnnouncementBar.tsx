import { ACCENT, BG_3, INK, INK_DIM, INK_FAINT } from './tokens'

export function AnnouncementBar() {
  return (
    <div
      className="flex items-center justify-center gap-2.5 px-6 md:px-14 py-2.5 text-[12px] text-center"
      style={{ background: BG_3, color: INK, borderBottom: `1px solid ${INK_FAINT}` }}
    >
      <span
        className="text-[10px] tracking-[0.14em] uppercase font-semibold"
        style={{ color: ACCENT }}
      >
        데모
      </span>
      <span style={{ color: INK_DIM }}>로그인 없이 데모 즉시 체험 가능</span>
      <a
        href="/demo"
        className="underline font-medium hover:opacity-80"
        style={{ color: INK }}
      >
        데모 열기 →
      </a>
    </div>
  )
}

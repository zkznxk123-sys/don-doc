import { FileSpreadsheet } from 'lucide-react'

/**
 * 거래 빈 상태 — 신규 가입자 첫 화면 funnel 누수 방지 (designer 2026-06-15 A-3).
 * onUpload가 있으면 CTA(엑셀 업로드), 없으면(필터로 인한 빈 상태 등) 메시지만.
 */
export function EmptyTransactions({
  onUpload,
  message = '거래 내역이 없습니다',
  className = 'py-12',
}: {
  onUpload?: () => void
  message?: string
  className?: string
}) {
  if (!onUpload) {
    return <p className={`text-center ${className} text-sm text-muted-foreground/60`}>{message}</p>
  }
  return (
    <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
      <p className="text-sm text-muted-foreground">아직 거래가 없어요. 엑셀 한 번이면 시작돼요.</p>
      <button
        onClick={onUpload}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold bg-foreground text-background hover:opacity-90 active:scale-[0.97] transition"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        엑셀 업로드
      </button>
    </div>
  )
}

import { Sparkles } from 'lucide-react'

export function RecategorizeModeModal({
  onClose,
  onRun,
}: {
  onClose: () => void
  onRun: (forceMode: boolean) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">AI 재분류</h2>
            <p className="text-[11px] text-muted-foreground">분류 방식을 선택하세요</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onRun(false)}
            className="w-full flex flex-col items-start gap-1 px-4 py-3 rounded-xl bg-muted hover:bg-muted/80 border border-border text-left transition-colors"
          >
            <span className="text-sm font-semibold text-foreground">미분류 항목만</span>
            <span className="text-[11px] text-muted-foreground">카테고리가 없는 항목만 개인화 규칙 + AI로 분류</span>
          </button>
          <button
            onClick={() => onRun(true)}
            className="w-full flex flex-col items-start gap-1 px-4 py-3 rounded-xl bg-warning-soft hover:opacity-80 text-left transition-colors"
          >
            <span className="text-sm font-semibold text-warning">전체 강제 재분류</span>
            <span className="text-[11px] text-muted-foreground">기존 분류 포함 전체 항목을 개인화 규칙 + AI로 재분류</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  )
}

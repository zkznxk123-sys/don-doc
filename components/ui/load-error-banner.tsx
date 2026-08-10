'use client'

/**
 * 로드 실패 배너 (2026-08-10). 조회 실패 시 조용히 0/빈값을 보여주지 말고 이 배너로 알린다.
 * 데이터 유실 오인 방지 — "데이터는 안전하다"를 명시하고 재시도 액션 제공.
 */
export function LoadErrorBanner({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
    >
      <span className="text-foreground">
        {message ?? '데이터를 불러오지 못했어요. 데이터는 안전하니 다시 시도해 주세요.'}
      </span>
      <button
        onClick={onRetry}
        className="shrink-0 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-medium transition-colors"
      >
        다시 불러오기
      </button>
    </div>
  )
}

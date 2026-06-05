import { Sparkles, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProgressModalState {
  progress: number
  steps: { label: string; done: boolean; active: boolean }[]
  updated: number
  done: boolean
  cancelled?: boolean
  error: string | null
  forceMode?: boolean
}

export function RecategorizeProgressModal({
  state,
  onCancel,
  onClose,
}: {
  state: ProgressModalState
  onCancel: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-8 flex flex-col items-center gap-6 shadow-2xl">
        {/* 아이콘 */}
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Sparkles className={cn('w-7 h-7', state.done && !state.error ? 'text-income' : 'text-foreground', !state.done && 'animate-pulse')} />
        </div>

        {/* 타이틀 */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold italic text-foreground">
            {state.done
              ? state.error ? '재분류 실패' : state.cancelled ? '재분류 중지됨' : 'AI 재분류 완료'
              : 'AI 미분류 항목 재분류 중...'}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {state.done && !state.error
              ? `${state.updated > 0 ? `${state.updated}건이 새로 분류됐습니다.` : '모든 항목이 이미 분류되어 있습니다.'}`
              : state.error
              ? state.error
              : '거래 내역 패턴을 분석하여 카테고리를 자동 매핑합니다.'}
          </p>
        </div>

        {/* 프로그레스 바 */}
        {!state.done && (
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                STATUS: PROCESSING
              </span>
              <span className="text-xs tabular-nums text-foreground">{state.progress}%</span>
            </div>
            <div className="h-0.5 w-full bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-700"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 스텝 리스트 */}
        <div className="w-full rounded-xl bg-muted/50 border border-border/50 divide-y divide-border/40">
          {state.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              {step.done ? (
                <Check className="w-3.5 h-3.5 text-income shrink-0" />
              ) : step.active ? (
                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                </div>
              ) : (
                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-border" />
                </div>
              )}
              <span className={cn(
                'text-[11px] font-medium uppercase tracking-wider',
                step.active ? 'text-foreground' : step.done ? 'text-muted-foreground' : 'text-muted-foreground/40',
              )}>
                {step.active ? `${step.label}...` : step.label}
              </span>
            </div>
          ))}
        </div>

        {/* 완료 버튼 또는 중지 버튼 */}
        {state.done ? (
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
          >
            확인
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              onClick={onCancel}
              className="px-4 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
            >
              중지
            </button>
            <p className="text-[10px] text-muted-foreground/40 italic">Powered by GPT-4o-mini</p>
          </div>
        )}
      </div>
    </div>
  )
}

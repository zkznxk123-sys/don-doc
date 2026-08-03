"use client"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
        문제가 생겼어요. 잠시 후 다시 시도해 주세요.
      </h1>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-medium transition-opacity"
      >
        다시 시도하기
      </button>
    </div>
  )
}

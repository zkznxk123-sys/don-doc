'use client'

import { Skeleton } from '@/components/ui/skeleton'

/** Tier 1 — KPI 카드 스켈레톤 */
export function KpiCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <Skeleton className="w-3.5 h-3.5 rounded-full" />
        <Skeleton className="w-16 h-3" />
      </div>
      <Skeleton className="w-28 h-6 mt-0.5" />
      <Skeleton className="w-20 h-3" />
    </div>
  )
}

/** Tier 2 — 순자산 추이 차트 스켈레톤 */
export function NetWorthChartSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="w-24 h-4" />
        </div>
        <Skeleton className="w-28 h-7 rounded-lg" />
      </div>
      <div className="px-5 py-5">
        <div className="flex items-end gap-1 h-[200px]">
          <div className="flex flex-col justify-between h-full py-1 mr-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="w-8 h-3" />
            ))}
          </div>
          <div className="flex-1 flex items-end gap-3 h-full pb-6">
            {[65, 45, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col gap-0.5 items-center">
                <Skeleton className="w-full rounded-t-md" style={{ height: `${h}%` }} />
                <Skeleton className="w-8 h-3 mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Tier 2 — 현금흐름 차트 스켈레톤 */
export function CashflowChartSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-24 h-4" />
        <div className="flex gap-3">
          <Skeleton className="w-10 h-3" />
          <Skeleton className="w-10 h-3" />
          <Skeleton className="w-10 h-3" />
        </div>
      </div>
      <div className="flex items-end gap-6 h-[200px] pb-6">
        {[
          [75, 50],
          [60, 80],
          [85, 55],
        ].map(([a, b], i) => (
          <div key={i} className="flex-1 flex items-end gap-1.5">
            <Skeleton className="flex-1 rounded-t-md" style={{ height: `${a}%` }} />
            <Skeleton className="flex-1 rounded-t-md" style={{ height: `${b}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Tier 3 Left — 도넛 차트 스켈레톤 */
export function DonutChartSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
      <Skeleton className="w-24 h-5 mb-1" />
      <Skeleton className="w-36 h-3 mb-5" />
      <div className="flex flex-col items-center gap-5">
        <div className="w-[200px] h-[200px] relative flex items-center justify-center shrink-0">
          <div className="w-full h-full rounded-full border-28 border-border animate-pulse" />
          <div className="absolute flex flex-col items-center gap-1">
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-20 h-5" />
          </div>
        </div>
        <div className="w-full space-y-2">
          {[80, 65, 50].map((w, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
                  <Skeleton className="w-14 h-3.5" />
                </div>
                <Skeleton className="w-full h-1 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Tier 3 Right — 예산 + 카테고리 스켈레톤 */
export function BudgetCategorySkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-12 h-6 rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted rounded-xl p-3 flex flex-col items-center gap-1.5">
              <Skeleton className="w-8 h-2.5" />
              <Skeleton className="w-14 h-4" />
            </div>
          ))}
        </div>
        <div className="flex justify-between mb-1">
          <Skeleton className="w-10 h-2.5" />
          <Skeleton className="w-8 h-2.5" />
        </div>
        <Skeleton className="w-full h-1.5 rounded-full" />
      </div>
      <div className="h-px bg-border" />
      <div>
        <Skeleton className="w-16 h-4 mb-3" />
        <div className="space-y-3">
          {[90, 70, 55, 45, 35].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-2 h-2 rounded-full shrink-0" />
              <Skeleton className="flex-1 h-3" style={{ maxWidth: `${w}%` }} />
              <Skeleton className="w-6 h-3" />
              <Skeleton className="w-16 h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Tier 4 — 거래 피드 스켈레톤 */
export function TransactionFeedSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-8 h-5 rounded-full" />
        </div>
        <Skeleton className="w-14 h-3" />
      </div>
      <div className="space-y-0">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3" style={{ width: `${[70, 55, 80, 60, 45][i]}%` }} />
              <Skeleton className="w-32 h-2.5" />
            </div>
            <Skeleton className="w-16 h-3 shrink-0" />
            <Skeleton className="w-8 h-5 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Member 뷰 — 예산 카드 스켈레톤 */
export function MemberBudgetSkeleton() {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <Skeleton className="w-28 h-3 mb-3" />
      <Skeleton className="w-48 h-10 mb-1" />
      <Skeleton className="w-40 h-3 mb-5" />
      <Skeleton className="w-full h-2 rounded-full mb-2" />
      <div className="flex justify-between">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-8 h-3" />
      </div>
    </div>
  )
}

/** Member 뷰 — 카테고리 카드 스켈레톤 */
export function MemberCategorySkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
      <Skeleton className="w-28 h-4 mb-4" />
      <div className="space-y-3">
        {[85, 65, 50, 40, 30].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-2 h-2 rounded-full shrink-0" />
            <Skeleton className="flex-1 h-3" style={{ maxWidth: `${w}%` }} />
            <Skeleton className="w-6 h-3" />
            <Skeleton className="w-16 h-3" />
          </div>
        ))}
      </div>
    </div>
  )
}

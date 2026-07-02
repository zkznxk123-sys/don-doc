'use client'

/** 스팩 탭 — [관심 스팩(내 목록) | 전체 시장(KRX 유니버스)] 토글. */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SpacList } from '@/components/ipo/spac-list'
import { SpacUniverse } from '@/components/ipo/spac-universe'
import type { IpoData } from '@/lib/ipo/store'

export function SpacPanel({ data }: { data: IpoData }) {
  const [view, setView] = useState<'mine' | 'market'>('mine')
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-card border border-border p-0.5 text-xs">
        {([['mine', '관심 스팩'], ['market', '전체 시장']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={cn('rounded-md px-3 py-1 font-medium', view === v ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
            {label}
          </button>
        ))}
      </div>
      {view === 'mine' ? <SpacList data={data} /> : <SpacUniverse />}
    </div>
  )
}

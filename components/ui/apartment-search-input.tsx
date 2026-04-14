'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ApartmentResult {
  name: string
  address: string
  roadAddress: string
  bjdCode: string | null
  x: string
  y: string
}

interface ApartmentSearchInputProps {
  value: string           // 현재 입력된 단지명
  bjdCode?: string | null
  area?: number | null
  onSelect: (result: ApartmentResult) => void
  onClear?: () => void
  placeholder?: string
  className?: string
}

export function ApartmentSearchInput({
  value,
  bjdCode,
  area,
  onSelect,
  onClear,
  placeholder = '단지명 검색 (예: 래미안원베일리)',
  className,
}: ApartmentSearchInputProps) {
  const [query, setQuery]         = useState(value)
  const [results, setResults]     = useState<ApartmentResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [open, setOpen]           = useState(false)
  const [selected, setSelected]   = useState(!!value)
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef              = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // value prop 변경 시 동기화
  useEffect(() => {
    setQuery(value)
    setSelected(!!value)
  }, [value])

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/realestate/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    setSelected(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 350)
  }

  const handleSelect = (r: ApartmentResult) => {
    setQuery(r.name)
    setSelected(true)
    setOpen(false)
    setResults([])
    onSelect(r)
  }

  const handleClear = () => {
    setQuery('')
    setSelected(false)
    setResults([])
    setOpen(false)
    onClear?.()
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={cn(
            'w-full h-10 bg-card border rounded-xl pl-9 pr-9 text-sm text-foreground',
            'placeholder-muted-foreground/40 outline-none transition-colors',
            selected
              ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-900/10'
              : 'border-border focus:border-ring',
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground/50 animate-spin" />}
          {query && !loading && (
            <button type="button" onClick={handleClear}>
              <X className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 선택된 단지 정보 뱃지 */}
      {selected && bjdCode && (
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
            <MapPin className="w-2.5 h-2.5" />
            지역코드 {bjdCode}
          </span>
          {area && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {area.toFixed(1)}㎡ ({Math.round(area / 3.305)}평)
            </span>
          )}
        </div>
      )}

      {/* 드롭다운 결과 */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-accent text-left transition-colors border-b border-border/50 last:border-0"
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                  {r.roadAddress || r.address}
                </p>
                {r.bjdCode && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    지역코드 {r.bjdCode}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-xl shadow-lg px-3 py-3">
          <p className="text-xs text-muted-foreground/60 text-center">검색 결과가 없습니다</p>
        </div>
      )}
    </div>
  )
}

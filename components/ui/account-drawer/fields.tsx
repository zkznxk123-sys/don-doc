'use client'

/**
 * account-drawer 내부 공용 input field 컴포넌트 + 파싱 헬퍼.
 * 메인 drawer 본체에서 분리 — sub-form 단위 재사용성.
 */

import { Label } from '@/components/ui/label'

export function fmtNum(val: string): string {
  const n = val.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString() : ''
}

export function parseNum(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground/40">선택</span>
    </div>
  )
}

export function NumberField({
  label, value, onChange, placeholder = '0', suffix = '원',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string
}) {
  return (
    <div>
      <Label className="text-muted-foreground text-xs mb-1.5 block">{label}</Label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(fmtNum(e.target.value))}
          placeholder={placeholder}
          className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-10 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors tabular-nums"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">{suffix}</span>
      </div>
    </div>
  )
}

export function RateField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <Label className="text-muted-foreground text-xs mb-1.5 block">{label}</Label>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-10 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">%</span>
      </div>
    </div>
  )
}

export function DateField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <Label className="text-muted-foreground text-xs mb-1.5 block">{label}</Label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground outline-none focus:border-ring transition-colors [color-scheme:dark]"
      />
    </div>
  )
}

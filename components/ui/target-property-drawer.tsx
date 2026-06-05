'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { ApartmentSearchInput, type ApartmentResult } from '@/components/ui/apartment-search-input'
import { addTargetProperty, updateTargetProperty } from '@/lib/actions/realestate'
import type { TargetPropertyData } from '@/lib/actions/realestate'
import { toKoreanUnit } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface TargetPropertyDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: TargetPropertyData
}

function parseNum(s: string): number | null {
  const n = parseInt(s.replace(/,/g, ''), 10)
  return isNaN(n) ? null : n
}

export function TargetPropertyDrawer({
  isOpen, onClose, onSuccess, initialData,
}: TargetPropertyDrawerProps) {
  const isEdit = !!initialData

  const [name, setName]       = useState(initialData?.name ?? '')
  const [bjdCode, setBjdCode] = useState<string | null>(initialData?.bjdCode ?? null)
  const [area, setArea]       = useState(initialData?.area?.toString() ?? '')
  const [budget, setBudget]   = useState(initialData?.budget?.toLocaleString() ?? '')
  const [memo, setMemo]       = useState(initialData?.memo ?? '')
  const [saving, setSaving]   = useState(false)

  const handleSelect = (r: ApartmentResult) => {
    setName(r.name)
    setBjdCode(r.bjdCode)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('단지명을 입력해주세요'); return }
    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        bjdCode,
        area: area ? parseFloat(area) : null,
        budget: parseNum(budget),
        memo: memo || null,
      }
      if (isEdit) {
        await updateTargetProperty(initialData!.id, data)
        toast.success('목표 단지가 수정됐습니다')
      } else {
        await addTargetProperty(data)
        toast.success('목표 단지가 추가됐습니다')
      }
      onSuccess()
      onClose()
    } catch (e) {
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={isOpen} onOpenChange={v => !v && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>{isEdit ? '목표 단지 수정' : '갈아타기 목표 단지 추가'}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-2">
          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">단지 검색</Label>
            <ApartmentSearchInput
              value={name}
              bjdCode={bjdCode}
              area={area ? parseFloat(area) : null}
              onSelect={handleSelect}
              onClear={() => { setName(''); setBjdCode(null) }}
              placeholder="목표 단지명 검색"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">전용면적 (㎡)</Label>
              <input
                type="number"
                step="0.01"
                value={area}
                onChange={e => setArea(e.target.value)}
                placeholder="예: 84.98"
                className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
              />
              {area && (
                <p className="text-[10px] text-muted-foreground/50 mt-1">{Math.round(parseFloat(area) / 3.305)}평</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">목표 예산</Label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={budget}
                  onChange={e => {
                    const raw = e.target.value.replace(/,/g, '')
                    if (/^\d*$/.test(raw)) setBudget(Number(raw).toLocaleString())
                  }}
                  placeholder="예: 1,200,000,000"
                  className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
                />
                {budget && (
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{toKoreanUnit(parseNum(budget) ?? 0)}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground text-xs mb-1.5 block">메모</Label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예: 초등학교 근처, 2028년 입주 목표"
              className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
            />
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? '수정 완료' : '추가'}
          </button>
          <DrawerClose asChild>
            <button className="w-full h-11 border border-border rounded-xl text-sm text-muted-foreground">
              취소
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

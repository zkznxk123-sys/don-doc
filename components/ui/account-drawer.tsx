'use client'

import { useState, useEffect } from 'react'
import { Banknote, TrendingUp, Bitcoin, Building2, Users, Eye, EyeOff, Loader2, Trash2, CreditCard, HandCoins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { createAccount, updateAccount, deleteAccount, type AccountType, type ShareLevel } from '@/lib/actions/accounts'
import { toast } from 'sonner'

export interface AccountInitialData {
  id: string
  name: string
  type: AccountType
  balance: number
  isShared: boolean
  shareLevel: ShareLevel
  isMasked?: boolean
}

interface AccountDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: AccountInitialData
}

const ACCOUNT_TYPES: { value: AccountType; label: string; desc: string; Icon: React.ElementType; color: string; isLiability?: boolean }[] = [
  { value: 'CASH',        label: '현금 · 예적금', desc: '생활비, 비상금, 저축',   Icon: Banknote,   color: 'text-blue-400' },
  { value: 'INVESTMENT',  label: '주식 · 펀드',   desc: '국내외 주식, 펀드, ETF', Icon: TrendingUp, color: 'text-emerald-400' },
  { value: 'CRYPTO',      label: '가상자산',       desc: '비트코인, 이더리움 등',  Icon: Bitcoin,    color: 'text-amber-400' },
  { value: 'REAL_ESTATE', label: '부동산',         desc: '아파트, 토지, 상가',     Icon: Building2,  color: 'text-purple-400' },
  { value: 'DEBT',        label: '대출',           desc: '주택담보대출, 신용대출 등', Icon: HandCoins,  color: 'text-red-400', isLiability: true },
  { value: 'CREDIT_CARD', label: '신용카드',       desc: '카드 사용액, 미결제 금액', Icon: CreditCard, color: 'text-rose-400', isLiability: true },
]

const SHARE_LEVELS: { value: ShareLevel; label: string; desc: string; icon: React.ElementType; color: string; bg: string }[] = [
  {
    value: 'PUBLIC',
    label: '내역까지 공개',
    desc: '이름·금액·거래 내역 모두 공개',
    icon: Users,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  {
    value: 'BALANCE_ONLY',
    label: '금액만 합산',
    desc: '금액은 가족 합계에 포함, 내역은 숨김',
    icon: Eye,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    value: 'PRIVATE',
    label: '나만 보기',
    desc: '가족 리스트에서 완전히 제외됨',
    icon: EyeOff,
    color: 'text-zinc-400',
    bg: 'bg-zinc-800 border-zinc-700',
  },
]

export function AccountDrawer({ isOpen, onClose, onSuccess, initialData }: AccountDrawerProps) {
  const isEditMode = !!initialData

  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('CASH')
  const [balance, setBalance] = useState('')
  const [shareLevel, setShareLevel] = useState<ShareLevel>('PUBLIC')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setType(initialData.type)
      setBalance(initialData.balance > 0 ? initialData.balance.toLocaleString() : '')
      setShareLevel(initialData.shareLevel ?? (initialData.isShared ? 'PUBLIC' : 'PRIVATE'))
    } else {
      setName('')
      setType('CASH')
      setBalance('')
      setShareLevel('PUBLIC')
    }
    setConfirmDelete(false)
  }, [initialData, isOpen])

  const handleClose = () => {
    setConfirmDelete(false)
    onClose()
  }

  const handleSubmit = async () => {
    const parsedBalance = parseFloat(balance.replace(/,/g, '')) || 0
    setIsLoading(true)
    try {
      if (isEditMode) {
        const result = await updateAccount(initialData.id, {
          name: name.trim(),
          type,
          balance: parsedBalance,
          shareLevel,
        })
        if (!result.success) { toast.error(result.error || '수정에 실패했습니다.'); return }
        toast.success(`"${name.trim()}" 계좌가 수정되었습니다.`)
      } else {
        const result = await createAccount({ name: name.trim(), type, balance: parsedBalance, shareLevel })
        if (!result.success) { toast.error(result.error || '계좌 생성에 실패했습니다.'); return }
        toast.success(`"${name.trim()}" 계좌가 추가되었습니다.`)
      }
      onSuccess()
      onClose()
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialData) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setIsDeleting(true)
    try {
      const result = await deleteAccount(initialData.id)
      if (!result.success) { toast.error(result.error || '삭제에 실패했습니다.'); return }
      toast.success(`"${initialData.name}" 계좌가 삭제되었습니다.`)
      onSuccess()
      onClose()
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  const formatBalanceInput = (val: string) => {
    const num = val.replace(/[^0-9]/g, '')
    return num ? Number(num).toLocaleString() : ''
  }

  const isLiabilityType = type === 'DEBT' || type === 'CREDIT_CARD'
  const isValid = name.trim().length > 0

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DrawerContent className="bg-zinc-950 border-zinc-800 max-h-[90vh]">
        <DrawerHeader className="px-6 pt-6 pb-2">
          <DrawerTitle className="text-white text-lg font-semibold">
            {isEditMode ? (isLiabilityType ? '부채 수정' : '자산 수정') : '계좌 추가'}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-6 py-4 space-y-6 overflow-y-auto">
          {/* 계좌 종류 */}
          <div>
            <Label className="text-zinc-400 text-xs mb-3 block">계좌 종류</Label>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map((t) => {
                const TypeIcon = t.Icon
                const isSelected = type === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      'relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'bg-white border-white shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                        : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/70'
                    )}
                  >
                    <TypeIcon className={cn('w-5 h-5 flex-shrink-0', isSelected ? 'text-black' : t.color)} />
                    <div>
                      <p className={cn('text-xs font-semibold leading-tight', isSelected ? 'text-black' : 'text-white')}>{t.label}</p>
                      <p className={cn('text-[10px] mt-0.5', isSelected ? 'text-black/50' : 'text-zinc-500')}>{t.desc}</p>
                    </div>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 계좌 이름 */}
          <div>
            <Label className="text-zinc-400 text-xs mb-2 block">계좌 이름</Label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 생활비 통장, 비상금"
              maxLength={30}
              className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          {/* 잔액 / 부채 금액 */}
          <div>
            <Label className="text-zinc-400 text-xs mb-2 block">
              {isLiabilityType ? '부채 금액 (원)' : '현재 잔액 (원)'}
            </Label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={balance}
                onChange={(e) => setBalance(formatBalanceInput(e.target.value))}
                placeholder="0"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-10 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">원</span>
            </div>
          </div>

          {/* 가족 공유 설정 */}
          <div>
            <Label className="text-zinc-400 text-xs mb-3 block">가족 공유 설정</Label>
            <div className="space-y-2">
              {SHARE_LEVELS.map((s) => {
                const ShareIcon = s.icon
                const isSelected = shareLevel === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setShareLevel(s.value)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all',
                      isSelected ? s.bg : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      isSelected ? 'bg-white/10' : 'bg-zinc-800'
                    )}>
                      <ShareIcon className={cn('w-4 h-4', isSelected ? s.color : 'text-zinc-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', isSelected ? 'text-white' : 'text-zinc-400')}>
                        {s.label}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{s.desc}</p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                      isSelected ? `border-current ${s.color} bg-current scale-110` : 'border-zinc-700'
                    )} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DrawerFooter className="px-6 pb-8 pt-2 gap-2">
          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className={cn(
              'w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              isValid && !isLoading
                ? 'bg-white text-black hover:bg-zinc-200 active:scale-[0.98]'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            )}
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isEditMode ? '저장 중...' : '추가 중...'}</>
              : isEditMode ? '수정 완료' : '계좌 추가하기'
            }
          </button>

          {isEditMode && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                'w-full h-11 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
                confirmDelete
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/30'
              )}
            >
              {isDeleting
                ? <><Loader2 className="w-4 h-4 animate-spin" />삭제 중...</>
                : <><Trash2 className="w-4 h-4" />{confirmDelete ? '정말 삭제하시겠습니까?' : '계좌 삭제'}</>
              }
            </button>
          )}

          <DrawerClose asChild>
            <button
              onClick={handleClose}
              className="w-full h-10 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {confirmDelete ? '취소' : '닫기'}
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

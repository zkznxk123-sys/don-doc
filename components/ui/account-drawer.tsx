'use client'

import { useState, useEffect } from 'react'
import { Loader2, Trash2, ChevronDown } from 'lucide-react'
import { ApartmentSearchInput, type ApartmentResult } from '@/components/ui/apartment-search-input'
import { cn, toKoreanUnit } from '@/lib/utils'
import { isFull } from '@/lib/feature-flags'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import {
  createAccount, updateAccount, deleteAccount,
  getAccountWithDetail, getFamilyAssetsForLinking, getEligibleParentAccounts,
  type AccountType, type ShareLevel, type RepaymentType, type DebtType, type PensionType,
  type RealEstateDetailInput, type FinancialAssetDetailInput, type DebtDetailInput, type PensionDetailInput,
} from '@/lib/actions/accounts'
import { toast } from 'sonner'

export interface AccountInitialData {
  id: string
  name: string
  type: AccountType
  balance: number
  isShared: boolean
  shareLevel: ShareLevel
  isMasked?: boolean
  netEquity?: number
  linkedDebts?: { id: string; name: string; balance: number }[]
  ownerName?: string | null
  userId?: string | null
  isJoint?: boolean
  parentAccountId?: string | null
  subAccounts?: { id: string; name: string; balance: number; type: string }[]
  realEstateDetail?: {
    complexName: string | null
    bjdCode: string | null
    area: number | null
    floor: number | null
    propertyType: string | null
  } | null
}

export interface FamilyMemberOption {
  id: string
  name: string | null
}

export interface ParentInfo {
  id: string
  type: AccountType
  name: string
}

interface AccountDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: AccountInitialData
  familyMembers?: FamilyMemberOption[]
  parentInfo?: ParentInfo
  currentUserId?: string
}

import {
  ACCOUNT_TYPES, SHARE_LEVELS, REPAYMENT_TYPES, DEBT_TYPES,
  DEBT_TYPES_NEEDING_ASSET, PROPERTY_TYPES, FINANCIAL_TYPES, PENSION_TYPES_LIST,
} from './account-drawer/constants'
import {
  fmtNum, parseNum, SectionDivider, NumberField, RateField, DateField,
} from './account-drawer/fields'
import { FinancialSection, PensionSection } from './account-drawer/sections'

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function AccountDrawer({ isOpen, onClose, onSuccess, initialData, familyMembers = [], parentInfo, currentUserId }: AccountDrawerProps) {
  const isEditMode = !!initialData
  const isProductMode = !!(parentInfo || initialData?.parentAccountId)

  // 기본 필드
  const [name, setName]           = useState('')
  const [type, setType]           = useState<AccountType>('CASH')
  const [balance, setBalance]     = useState('')
  const [shareLevel, setShareLevel] = useState<ShareLevel>('PUBLIC')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteCounts, setDeleteCounts] = useState<{ transactionCount: number; holdingCount: number; subAccountCount: number } | null>(null)

  // 상위 계좌
  const [parentAccountId, setParentAccountId] = useState<string>('')
  const [eligibleParents, setEligibleParents] = useState<{ id: string; name: string; type: AccountType }[]>([])

  // 부채 연결 자산
  const [linkedAssetId, setLinkedAssetId] = useState<string>('')
  const [linkableAssets, setLinkableAssets] = useState<{ id: string; name: string; type: AccountType }[]>([])

  // 부동산 상세
  const [reComplexName, setReComplexName]     = useState('')
  const [reBjdCode, setReBjdCode]             = useState<string | null>(null)
  const [reArea, setReArea]                   = useState('')
  const [reFloor, setReFloor]                 = useState('')
  const [rePropertyType, setRePropertyType]   = useState('')
  const [rePurchasePrice, setRePurchasePrice] = useState('')
  const [rePurchaseDate, setRePurchaseDate]   = useState('')
  const [reCurrentPrice, setReCurrentPrice]   = useState('')
  const [reTargetPrice, setReTargetPrice]     = useState('')

  // 금융자산 상세
  const [faInterestRate, setFaInterestRate]     = useState('')
  const [faMaturityDate, setFaMaturityDate]     = useState('')
  const [faMonthlyPayment, setFaMonthlyPayment] = useState('')

  // 부채 상세
  const [dDebtType, setDDebtType]             = useState<DebtType>('ETC')
  const [dInterestRate, setDInterestRate]     = useState('')
  const [dMaturityDate, setDMaturityDate]     = useState('')
  const [dRepaymentType, setDRepaymentType]   = useState<RepaymentType | ''>('')
  const [dMonthlyPayment, setDMonthlyPayment] = useState('')

  // 연금 상세
  const [pPensionType, setPPensionType]                     = useState<PensionType>('PERSONAL_PENSION')
  const [pInstitutionName, setPInstitutionName]             = useState('')
  const [pExpectedMonthlyPension, setPExpectedMonthlyPension] = useState('')
  const [pAccumulatedMonths, setPAccumulatedMonths]         = useState('')
  const [pPensionStartAge, setPPensionStartAge]             = useState('')
  const [pMonthlyPayment, setPMonthlyPayment]               = useState('')
  const [pOwnerBirthYear, setPOwnerBirthYear]               = useState('')
  const [pOwnerId, setPOwnerId]                             = useState<string>('')  // '' = 공유(소유자 없음)

  const needsLinkedAsset = DEBT_TYPES_NEEDING_ASSET.includes(dDebtType)

  const isLiabilityType = type === 'DEBT' || type === 'CREDIT_CARD'
  const isFinancialType  = FINANCIAL_TYPES.includes(type)
  const isRealEstate     = type === 'REAL_ESTATE'
  const isDebt           = type === 'DEBT'
  const isPension        = type === 'PENSION'

  // 드로어 열릴 때: 기본값 세팅 + (수정 모드) 상세 데이터 로드
  useEffect(() => {
    if (!isOpen) return

    // 상품 추가 모드: 부모 계좌 정보 세팅
    if (parentInfo && !initialData) {
      resetForm()
      setType(parentInfo.type)
      setParentAccountId(parentInfo.id)
      setConfirmDelete(false)
      return
    }

    if (initialData) {
      setName(initialData.name ?? '')
      setType(initialData.type)
      setBalance(initialData.balance > 0 ? initialData.balance.toLocaleString() : '')
      setShareLevel(initialData.shareLevel ?? (initialData.isShared ? 'PUBLIC' : 'PRIVATE'))
      setPOwnerId(initialData.isJoint ? '__joint__' : (initialData.userId ?? ''))
      setParentAccountId(initialData.parentAccountId ?? '')

      // 상세 데이터 비동기 로드
      getAccountWithDetail(initialData.id).then(detail => {
        if (!detail) return
        setLinkedAssetId(detail.linkedAssetId ?? '')

        if (detail.realEstateDetail) {
          const r = detail.realEstateDetail
          setReComplexName(r.complexName ?? '')
          setReBjdCode(r.bjdCode ?? null)
          setReArea(r.area?.toString() ?? '')
          setReFloor(r.floor?.toString() ?? '')
          setRePropertyType(r.propertyType ?? '')
          setRePurchasePrice(r.purchasePrice?.toLocaleString() ?? '')
          setRePurchaseDate(r.purchaseDate ?? '')
          setReCurrentPrice(r.currentPrice?.toLocaleString() ?? '')
          setReTargetPrice(r.targetPrice?.toLocaleString() ?? '')
        }
        if (detail.financialAssetDetail) {
          const f = detail.financialAssetDetail
          setFaInterestRate(f.interestRate != null ? String(f.interestRate) : '')
          setFaMaturityDate(f.maturityDate ?? '')
          setFaMonthlyPayment(f.monthlyPayment?.toLocaleString() ?? '')
        }
        if (detail.debtDetail) {
          const d = detail.debtDetail
          setDDebtType(d.debtType ?? 'ETC')
          setDInterestRate(d.interestRate != null ? String(d.interestRate) : '')
          setDMaturityDate(d.maturityDate ?? '')
          setDRepaymentType(d.repaymentType ?? '')
          setDMonthlyPayment(d.monthlyPayment?.toLocaleString() ?? '')
        }
        if (detail.pensionDetail) {
          const p = detail.pensionDetail
          setPPensionType(p.pensionType ?? 'PERSONAL_PENSION')
          setPInstitutionName(p.institutionName ?? '')
          setPExpectedMonthlyPension(p.expectedMonthlyPension?.toLocaleString() ?? '')
          setPAccumulatedMonths(p.accumulatedMonths != null ? String(p.accumulatedMonths) : '')
          setPPensionStartAge(p.pensionStartAge != null ? String(p.pensionStartAge) : '')
          setPMonthlyPayment(p.monthlyPayment?.toLocaleString() ?? '')
          setPOwnerBirthYear(p.ownerBirthYear != null ? String(p.ownerBirthYear) : '')
        }
      })
    } else {
      resetForm()
    }
    setConfirmDelete(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen])

  // 드로어 열릴 때 상위 계좌 후보 로드
  useEffect(() => {
    if (isOpen) {
      getEligibleParentAccounts(initialData?.id).then(r => setEligibleParents(r ?? []))
    }
  }, [isOpen, initialData?.id])

  // DEBT 선택 시 연결 가능 자산 목록 로드
  useEffect(() => {
    if (isDebt && isOpen) {
      getFamilyAssetsForLinking().then(setLinkableAssets)
    }
  }, [isDebt, isOpen])

  function resetForm() {
    setName(''); setType('CASH'); setBalance(''); setShareLevel('PUBLIC')
    setParentAccountId(''); setLinkedAssetId('')
    setRePropertyType(''); setRePurchasePrice(''); setRePurchaseDate(''); setReCurrentPrice(''); setReTargetPrice('')
    setFaInterestRate(''); setFaMaturityDate(''); setFaMonthlyPayment('')
    setDDebtType('ETC'); setDInterestRate(''); setDMaturityDate(''); setDRepaymentType(''); setDMonthlyPayment('')
    setPPensionType('PERSONAL_PENSION'); setPInstitutionName(''); setPExpectedMonthlyPension('')
    setPAccumulatedMonths(''); setPPensionStartAge(''); setPMonthlyPayment(''); setPOwnerBirthYear('')
    // 신규 추가 시 명의자 디폴트는 본인(가족 멤버 목록에 있을 때)
    const defaultOwnerId = currentUserId && familyMembers.some(m => m.id === currentUserId) ? currentUserId : ''
    setPOwnerId(defaultOwnerId)
  }

  // 모바일 키보드 가림 보정
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  useEffect(() => {
    if (!isOpen) return
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const handler = () => {
      const diff = window.innerHeight - vv.height - vv.offsetTop
      setKeyboardOffset(diff > 80 ? diff : 0)
    }
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
    handler()
    return () => {
      vv.removeEventListener('resize', handler)
      vv.removeEventListener('scroll', handler)
      setKeyboardOffset(0)
    }
  }, [isOpen])

  const isDirty = !isEditMode && (
    name.trim().length > 0 ||
    balance.trim().length > 0 ||
    reComplexName.trim().length > 0 ||
    rePurchasePrice.trim().length > 0 ||
    reCurrentPrice.trim().length > 0 ||
    faInterestRate.trim().length > 0 ||
    faMonthlyPayment.trim().length > 0 ||
    dInterestRate.trim().length > 0 ||
    dMonthlyPayment.trim().length > 0 ||
    pInstitutionName.trim().length > 0
  )

  const handleClose = () => {
    if (isDirty && !isLoading) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('입력한 내용이 저장되지 않습니다. 닫으시겠어요?')
        : true
      if (!ok) return
    }
    setConfirmDelete(false)
    setDeleteCounts(null)
    onClose()
  }

  function buildDetailInput() {
    const realEstateDetail: RealEstateDetailInput | undefined = isRealEstate ? {
      propertyType:  rePropertyType || undefined,
      complexName:   reComplexName  || null,
      bjdCode:       reBjdCode      || null,
      area:          reArea ? parseFloat(reArea) : null,
      floor:         reFloor ? parseInt(reFloor, 10) : null,
      purchasePrice: parseNum(rePurchasePrice),
      purchaseDate:  rePurchaseDate || undefined,
      currentPrice:  parseNum(reCurrentPrice),
      targetPrice:   parseNum(reTargetPrice),
    } : undefined

    const financialAssetDetail: FinancialAssetDetailInput | undefined = isFinancialType ? {
      interestRate: faInterestRate ? parseFloat(faInterestRate) : null,
      maturityDate: faMaturityDate || null,
      monthlyPayment: parseNum(faMonthlyPayment),
    } : undefined

    const debtDetail: DebtDetailInput | undefined = isDebt ? {
      debtType: dDebtType,
      interestRate: dInterestRate ? parseFloat(dInterestRate) : null,
      maturityDate: dMaturityDate || null,
      repaymentType: (dRepaymentType as RepaymentType) || null,
      monthlyPayment: parseNum(dMonthlyPayment),
    } : undefined

    const pensionTypeObj = PENSION_TYPES_LIST.find(p => p.value === pPensionType)
    const pensionDetail: PensionDetailInput | undefined = isPension ? {
      pensionType: pPensionType,
      institutionName: pInstitutionName || null,
      expectedMonthlyPension: parseNum(pExpectedMonthlyPension),
      taxDeductible: pensionTypeObj?.taxDeductible ?? false,
      accumulatedMonths: pAccumulatedMonths ? parseInt(pAccumulatedMonths) : null,
      pensionStartAge: pPensionStartAge ? parseInt(pPensionStartAge) : null,
      monthlyPayment: parseNum(pMonthlyPayment),
      ownerBirthYear: pOwnerBirthYear ? parseInt(pOwnerBirthYear) : null,
    } : undefined

    return { realEstateDetail, financialAssetDetail, debtDetail, pensionDetail }
  }

  const handleSubmit = async () => {
    if (isLoading) return
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return }
    const parsedBalance = parseFloat(balance.replace(/,/g, '')) || 0
    const { realEstateDetail, financialAssetDetail, debtDetail, pensionDetail } = buildDetailInput()
    const ownerIdInput = familyMembers.length > 0
      ? (pOwnerId === '' || pOwnerId === '__joint__' ? null : pOwnerId)
      : undefined
    const isJointInput = familyMembers.length > 0 ? pOwnerId === '__joint__' : undefined

    setIsLoading(true)
    try {
      if (isEditMode) {
        const result = await updateAccount(initialData.id, {
          name: name.trim(), type, balance: parsedBalance, shareLevel,
          ownerId: ownerIdInput, isJoint: isJointInput,
          parentAccountId: parentAccountId || null,
          linkedAssetId: isDebt ? (linkedAssetId || null) : null,
          realEstateDetail, financialAssetDetail, debtDetail, pensionDetail,
        })
        if (!result.success) { toast.error(result.error || '수정에 실패했어요.'); return }
        toast.success(`"${name.trim()}" 계좌가 수정됐어요.`)
      } else {
        const result = await createAccount({
          name: name.trim(), type, balance: parsedBalance, shareLevel,
          ownerId: ownerIdInput, isJoint: isJointInput,
          parentAccountId: parentAccountId || null,
          linkedAssetId: isDebt ? (linkedAssetId || null) : null,
          realEstateDetail, financialAssetDetail, debtDetail, pensionDetail,
        })
        if (!result.success) { toast.error(result.error || '계좌 생성에 실패했어요.'); return }
        toast.success(`"${name.trim()}" 계좌가 추가됐어요.`)
      }
      onSuccess()
      onClose()
    } catch {
      toast.error('오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialData) return
    setIsDeleting(true)
    try {
      // 첫 클릭(confirmDelete=false): probe만. dependent 있으면 reject + counts 반환
      // 두 번째 클릭(confirmDelete=true): force=true 로 cascade 삭제
      const result = await deleteAccount(initialData.id, confirmDelete ? { force: true } : undefined)

      if (result.success) {
        toast.success(`"${initialData.name}" 계좌가 삭제됐어요.`)
        setConfirmDelete(false); setDeleteCounts(null)
        onSuccess(); onClose()
        return
      }

      // dependent 있어서 reject된 경우 — confirm 단계로 전환
      if (result.transactionCount || result.holdingCount || result.subAccountCount) {
        setConfirmDelete(true)
        setDeleteCounts({
          transactionCount: result.transactionCount ?? 0,
          holdingCount: result.holdingCount ?? 0,
          subAccountCount: result.subAccountCount ?? 0,
        })
      } else {
        toast.error(result.error || '삭제에 실패했어요.')
      }
    } catch {
      toast.error('오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setIsDeleting(false)
    }
  }

  const isValid = name.trim().length > 0

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DrawerContent className="bg-background border-border max-h-[92vh]">
        <DrawerHeader className="px-6 pt-6 pb-2">
          <DrawerTitle className="text-foreground text-lg font-semibold">
            {isProductMode
              ? (isEditMode ? '상품 수정' : '상품 추가')
              : (isEditMode ? (isLiabilityType ? '부채 수정' : '자산 수정') : '자산 / 부채 추가')
            }
          </DrawerTitle>
          {isProductMode && (
            <p className="text-xs text-muted-foreground mt-1">
              소속 계좌: <span className="text-foreground font-medium">
                {parentInfo?.name ?? eligibleParents.find(p => p.id === parentAccountId)?.name ?? ''}
              </span>
            </p>
          )}
        </DrawerHeader>

        <div className="px-6 py-4 space-y-6 overflow-y-auto">

          {/* 계좌 종류 — 상품 모드에서는 숨김 */}
          {!isProductMode && <div>
            <Label className="text-muted-foreground text-xs mb-3 block">종류</Label>
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
                        ? 'bg-foreground border-foreground shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                        : 'bg-muted/40 border-border hover:border-ring hover:bg-muted/70'
                    )}
                  >
                    <TypeIcon className={cn('w-5 h-5 shrink-0', isSelected && 'text-background')} style={!isSelected ? { color: t.color } : undefined} />
                    <div>
                      <p className={cn('text-xs font-semibold leading-tight', isSelected ? 'text-background' : 'text-foreground')}>{t.label}</p>
                      <p className={cn('text-[10px] mt-0.5', isSelected ? 'text-background/50' : 'text-muted-foreground')}>{t.desc}</p>
                    </div>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-foreground rounded-full flex items-center justify-center shadow-sm">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5.5L4 7.5L8 3" stroke="currentColor" className="text-background" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>}

          {/* 이름 */}
          <div>
            <Label className="text-muted-foreground text-xs mb-2 block">이름</Label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isProductMode ? '예: TIGER 200 ETF, 채권형 펀드' : isRealEstate ? '예: 래미안위브 아파트' : isDebt ? '예: 주택담보대출' : '예: 생활비 통장'}
              maxLength={30}
              className="w-full h-11 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
            />
          </div>

          {/* 상위 계좌 (계층 구조) — 상품 모드에서는 숨김 */}
          {!isProductMode && !isLiabilityType && !isRealEstate && (eligibleParents?.length ?? 0) > 0 && (
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">상위 계좌</Label>
              <div className="relative">
                <select
                  value={parentAccountId}
                  onChange={e => setParentAccountId(e.target.value)}
                  className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-hidden focus:border-ring transition-colors appearance-none"
                >
                  <option value="">없음 (최상위)</option>
                  {eligibleParents.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
              {parentAccountId && (
                <p className="text-xs text-muted-foreground/60 mt-1">이 계좌의 잔액은 상위 계좌에 자동 합산됩니다.</p>
              )}
            </div>
          )}

          {/* 잔액 / 부채 금액 */}
          <div>
            <Label className="text-muted-foreground text-xs mb-2 block">
              {isLiabilityType ? '부채 금액' : '현재 잔액'}
            </Label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={balance}
                onChange={e => setBalance(fmtNum(e.target.value))}
                placeholder="0"
                className="w-full h-11 bg-card border border-border rounded-xl pl-4 pr-10 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">원</span>
            </div>
            {(() => {
              const n = parseFloat(balance.replace(/,/g, ''))
              return n > 0 ? (
                <p className="text-[11px] text-muted-foreground/50 mt-1.5 tabular-nums">{toKoreanUnit(n)}</p>
              ) : null
            })()}
          </div>

          {/* ── 상세 섹션들 — 상품 모드에서는 모두 숨김 ─────────────── */}

          {/* ── 부동산 상세 ─────────────────────────────────────────── */}
          {!isProductMode && isRealEstate && (
            <>
              <SectionDivider label="부동산 상세" />

              {/* 단지 검색 (아파트만) */}
              {(rePropertyType === '' || rePropertyType === '아파트') && (
                <div>
                  <Label className="text-muted-foreground text-xs mb-1.5 block">단지 검색</Label>
                  <ApartmentSearchInput
                    value={reComplexName}
                    bjdCode={reBjdCode}
                    area={reArea ? parseFloat(reArea) : null}
                    onSelect={(r: ApartmentResult) => {
                      setReComplexName(r.name)
                      setReBjdCode(r.bjdCode)
                      setRePropertyType('아파트')
                      // 이름이 계좌명과 같으면 계좌명도 자동 설정
                      if (!name) setName(r.name)
                    }}
                    onClear={() => { setReComplexName(''); setReBjdCode(null) }}
                  />
                </div>
              )}

              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">부동산 유형</Label>
                <div className="relative">
                  <select
                    value={rePropertyType}
                    onChange={e => setRePropertyType(e.target.value)}
                    className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-hidden focus:border-ring transition-colors appearance-none"
                  >
                    <option value="">선택 안 함</option>
                    {PROPERTY_TYPES.map(pt => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs mb-1.5 block">전용면적 (㎡)</Label>
                  <input
                    type="number"
                    step="0.01"
                    value={reArea}
                    onChange={e => setReArea(e.target.value)}
                    placeholder="예: 84.98"
                    className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
                  />
                  {reArea && <p className="text-[10px] text-muted-foreground/50 mt-1">{Math.round(parseFloat(reArea) / 3.305)}평</p>}
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs mb-1.5 block">층</Label>
                  <input
                    type="number"
                    value={reFloor}
                    onChange={e => setReFloor(e.target.value)}
                    placeholder="예: 15"
                    className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="매수 원금" value={rePurchasePrice} onChange={setRePurchasePrice} />
                <NumberField label="현재 시세" value={reCurrentPrice}  onChange={setReCurrentPrice} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateField   label="매수일"   value={rePurchaseDate}  onChange={setRePurchaseDate} />
                <NumberField label="목표 매도가" value={reTargetPrice} onChange={setReTargetPrice} />
              </div>
            </>
          )}

          {/* ── 금융자산 상세 ────────────────────────────────────────── */}
          {!isProductMode && isFinancialType && (
            <FinancialSection
              faInterestRate={faInterestRate} setFaInterestRate={setFaInterestRate}
              faMonthlyPayment={faMonthlyPayment} setFaMonthlyPayment={setFaMonthlyPayment}
              faMaturityDate={faMaturityDate} setFaMaturityDate={setFaMaturityDate}
            />
          )}

          {/* ── 연금 상세 ────────────────────────────────────────────── */}
          {!isProductMode && isPension && (
            <PensionSection
              pPensionType={pPensionType} setPPensionType={setPPensionType}
              pInstitutionName={pInstitutionName} setPInstitutionName={setPInstitutionName}
              pMonthlyPayment={pMonthlyPayment} setPMonthlyPayment={setPMonthlyPayment}
              pExpectedMonthlyPension={pExpectedMonthlyPension} setPExpectedMonthlyPension={setPExpectedMonthlyPension}
              pPensionStartAge={pPensionStartAge} setPPensionStartAge={setPPensionStartAge}
              pOwnerBirthYear={pOwnerBirthYear} setPOwnerBirthYear={setPOwnerBirthYear}
              pAccumulatedMonths={pAccumulatedMonths} setPAccumulatedMonths={setPAccumulatedMonths}
            />
          )}

          {/* ── 부채 상세 ────────────────────────────────────────────── */}
          {!isProductMode && isDebt && (
            <>
              <SectionDivider label="부채 상세" />

              {/* 부채 세부 유형 */}
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">부채 세부 유형</Label>
                <div className="relative">
                  <select
                    value={dDebtType}
                    onChange={e => setDDebtType(e.target.value as DebtType)}
                    className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-hidden focus:border-ring transition-colors appearance-none"
                  >
                    {DEBT_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* 연결 자산 Select — 주담대/전세 시 강조 */}
              <div
                className={cn(
                  'rounded-xl p-3 -mx-1 transition-all border',
                  needsLinkedAsset ? 'bg-warning-soft' : 'bg-transparent border-transparent'
                )}
                style={needsLinkedAsset ? { borderColor: 'color-mix(in srgb, var(--viz-copper) 30%, transparent)' } : undefined}
              >
                <Label className={cn(
                  'text-xs mb-1.5 flex items-center gap-1.5',
                  needsLinkedAsset ? 'text-warning font-medium' : 'text-muted-foreground'
                )}>
                  연결된 자산 (담보 등)
                  {needsLinkedAsset && (
                    <span
                      className="text-[10px] bg-warning-soft text-warning border px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ borderColor: 'color-mix(in srgb, var(--viz-copper) 40%, transparent)' }}
                    >
                      {dDebtType === 'MORTGAGE' ? '주담대 담보 자산' : '전세 대상 자산'} 연결 권장
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <select
                    value={linkedAssetId}
                    onChange={e => setLinkedAssetId(e.target.value)}
                    className="w-full h-10 bg-card rounded-xl pl-4 pr-9 text-sm text-foreground outline-hidden transition-colors appearance-none border border-border focus:border-ring"
                    style={needsLinkedAsset && !linkedAssetId ? { borderColor: 'color-mix(in srgb, var(--viz-copper) 50%, transparent)' } : undefined}
                  >
                    <option value="">없음</option>
                    {(needsLinkedAsset
                      ? linkableAssets.filter(a => a.type === 'REAL_ESTATE')
                      : linkableAssets
                    ).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
                {(needsLinkedAsset ? linkableAssets.filter(a => a.type === 'REAL_ESTATE') : linkableAssets).length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 mt-1">{needsLinkedAsset ? '등록된 부동산이 없습니다.' : '등록된 자산이 없습니다.'}</p>
                ) : needsLinkedAsset && !linkedAssetId ? (
                  <p className="text-xs text-warning/80 mt-1">LTV 분석을 위해 연결 자산을 선택하면 좋아요.</p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <RateField   label="대출 금리"  value={dInterestRate}   onChange={setDInterestRate} />
                <NumberField label="월 상환액"  value={dMonthlyPayment} onChange={setDMonthlyPayment} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 상환 방식 */}
                <div>
                  <Label className="text-muted-foreground text-xs mb-1.5 block">상환 방식</Label>
                  <div className="relative">
                    <select
                      value={dRepaymentType}
                      onChange={e => setDRepaymentType(e.target.value as RepaymentType | '')}
                      className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-hidden focus:border-ring transition-colors appearance-none"
                    >
                      <option value="">선택 안 함</option>
                      {REPAYMENT_TYPES.map(rt => (
                        <option key={rt.value} value={rt.value}>{rt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <DateField label="만기일" value={dMaturityDate} onChange={setDMaturityDate} />
              </div>
            </>
          )}

          {/* 명의자 */}
          {!isProductMode && familyMembers.length > 0 && (
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">명의자</Label>
              <div className="relative">
                <select
                  value={pOwnerId}
                  onChange={e => setPOwnerId(e.target.value)}
                  className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-hidden focus:border-ring transition-colors appearance-none"
                >
                  <option value="">미설정</option>
                  <option value="__joint__">공동</option>
                  {familyMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name ?? '(이름 없음)'}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* 가족 공유 설정 — lite는 1인이라 공유 개념 없음 → 숨김 */}
          {!isProductMode && isFull() && <div>
            <Label className="text-muted-foreground text-xs mb-3 block">가족 공유 설정</Label>
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
                      isSelected ? s.bg : 'bg-card border-border hover:border-ring'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', isSelected ? 'bg-foreground/10' : 'bg-muted')}>
                      <ShareIcon className={cn('w-4 h-4', isSelected ? s.color : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', isSelected ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 shrink-0 transition-all',
                      isSelected ? `border-current ${s.color} bg-current scale-110` : 'border-border'
                    )} />
                  </button>
                )
              })}
            </div>
          </div>}
        </div>

        <DrawerFooter
          className="px-6 pb-8 pt-2 gap-2"
          style={keyboardOffset > 0 ? { paddingBottom: `calc(2rem + ${keyboardOffset}px)` } : undefined}
        >
          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className={cn(
              'w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              isValid && !isLoading
                ? 'bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isEditMode ? '저장 중...' : '추가 중...'}</>
              : isEditMode ? '수정 완료' : '추가하기'
            }
          </button>

          {isEditMode && confirmDelete && deleteCounts && (
            <div className="rounded-xl border border-destructive/40 bg-expense-soft px-4 py-3 text-xs space-y-1.5">
              <p className="text-destructive font-semibold">⚠️ 연결된 데이터가 함께 삭제됩니다</p>
              <ul className="text-destructive/90 space-y-0.5 pl-1 tabular-nums">
                {deleteCounts.transactionCount > 0 && <li>· 거래 내역 {deleteCounts.transactionCount.toLocaleString()}건</li>}
                {deleteCounts.holdingCount > 0 && <li>· 보유 종목 {deleteCounts.holdingCount.toLocaleString()}개</li>}
                {deleteCounts.subAccountCount > 0 && <li>· 하위 계좌 {deleteCounts.subAccountCount.toLocaleString()}개</li>}
              </ul>
              <p className="text-destructive/70 pt-0.5">이 작업은 되돌릴 수 없습니다.</p>
            </div>
          )}

          {isEditMode && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                'w-full h-11 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
                confirmDelete
                  ? 'bg-destructive border border-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30'
              )}
            >
              {isDeleting
                ? <><Loader2 className="w-4 h-4 animate-spin" />삭제 중...</>
                : <><Trash2 className="w-4 h-4" />{confirmDelete ? '연결 데이터까지 모두 삭제' : '계좌 삭제'}</>
              }
            </button>
          )}

          <DrawerClose asChild>
            <button onClick={handleClose} className="w-full h-10 rounded-xl text-sm text-muted-foreground hover:text-foreground/70 transition-colors">
              {confirmDelete ? '취소' : '닫기'}
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

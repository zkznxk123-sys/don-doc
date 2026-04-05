'use client'

import { useState, useEffect } from 'react'
import {
  Banknote, TrendingUp, Bitcoin, Building2, Users, Eye, EyeOff,
  Loader2, Trash2, CreditCard, HandCoins, ChevronDown, PiggyBank,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
}

const ACCOUNT_TYPES: {
  value: AccountType; label: string; desc: string; Icon: React.ElementType; color: string; isLiability?: boolean
}[] = [
  { value: 'CASH',        label: '현금 · 예적금', desc: '생활비, 비상금, 저축',         Icon: Banknote,   color: 'text-blue-600 dark:text-blue-400' },
  { value: 'INVESTMENT',  label: '주식 · 펀드',   desc: '국내외 주식, 펀드, ETF',       Icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'PENSION',     label: '연금',           desc: 'IRP, 연금저축, 퇴직연금 등',  Icon: PiggyBank,  color: 'text-teal-600 dark:text-teal-400' },
  { value: 'CRYPTO',      label: '가상자산',       desc: '비트코인, 이더리움 등',        Icon: Bitcoin,    color: 'text-amber-600 dark:text-amber-400' },
  { value: 'REAL_ESTATE', label: '부동산',         desc: '아파트, 토지, 상가',           Icon: Building2,  color: 'text-purple-600 dark:text-purple-400' },
  { value: 'DEBT',        label: '대출',           desc: '주택담보대출, 신용대출 등',    Icon: HandCoins,  color: 'text-red-600 dark:text-red-400',  isLiability: true },
  { value: 'CREDIT_CARD', label: '신용카드',       desc: '카드 사용액, 미결제 금액',     Icon: CreditCard, color: 'text-rose-600 dark:text-rose-400', isLiability: true },
]

const SHARE_LEVELS: {
  value: ShareLevel; label: string; desc: string; icon: React.ElementType; color: string; bg: string
}[] = [
  { value: 'PUBLIC',       label: '내역까지 공개', desc: '이름·금액·거래 내역 모두 공개',         icon: Users,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30' },
  { value: 'BALANCE_ONLY', label: '금액만 합산',   desc: '금액은 가족 합계에 포함, 내역은 숨김', icon: Eye,    color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-100 border-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30' },
  { value: 'PRIVATE',      label: '나만 보기',     desc: '가족 리스트에서 완전히 제외됨',         icon: EyeOff, color: 'text-muted-foreground',    bg: 'bg-muted border-border' },
]

const REPAYMENT_TYPES: { value: RepaymentType; label: string }[] = [
  { value: 'EQUAL_PRINCIPAL_INTEREST', label: '원리금균등' },
  { value: 'EQUAL_PRINCIPAL',          label: '원금균등' },
  { value: 'BULLET',                   label: '만기일시' },
  { value: 'INTEREST_ONLY',            label: '이자만납부' },
]

const DEBT_TYPES: { value: DebtType; label: string }[] = [
  { value: 'MORTGAGE',       label: '주택담보대출' },
  { value: 'JEONSE_DEPOSIT', label: '전세보증금(수취)' },
  { value: 'CREDIT_LOAN',    label: '신용대출' },
  { value: 'OVERDRAFT',      label: '마이너스통장' },
  { value: 'ETC',            label: '기타' },
]

const DEBT_TYPES_NEEDING_ASSET: DebtType[] = ['MORTGAGE', 'JEONSE_DEPOSIT']

const PROPERTY_TYPES = ['아파트', '빌라', '오피스텔', '단독주택', '상가', '토지', '기타']

const FINANCIAL_TYPES: AccountType[] = ['CASH', 'INVESTMENT', 'CRYPTO', 'STO']

const PENSION_TYPES_LIST: { value: PensionType; label: string; taxDeductible: boolean }[] = [
  { value: 'PUBLIC_PENSION',   label: '공적연금 (국민/공무원)',    taxDeductible: false },
  { value: 'RETIREMENT_DB',    label: '퇴직연금 DB형',            taxDeductible: false },
  { value: 'RETIREMENT_DC',    label: '퇴직연금 DC형',            taxDeductible: false },
  { value: 'IRP',              label: 'IRP (개인형 퇴직연금)',     taxDeductible: true  },
  { value: 'PERSONAL_PENSION', label: '개인연금 (연금저축/보험)',   taxDeductible: true  },
  { value: 'HOME_PENSION',     label: '주택연금',                  taxDeductible: false },
]

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function fmtNum(val: string): string {
  const n = val.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString() : ''
}

function parseNum(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

// ─── 서브 컴포넌트: 상세 필드 섹션 ────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground/40">선택</span>
    </div>
  )
}

function NumberField({
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

function RateField({
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

function DateField({
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

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function AccountDrawer({ isOpen, onClose, onSuccess, initialData, familyMembers = [], parentInfo }: AccountDrawerProps) {
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

  // 상위 계좌
  const [parentAccountId, setParentAccountId] = useState<string>('')
  const [eligibleParents, setEligibleParents] = useState<{ id: string; name: string; type: AccountType }[]>([])

  // 부채 연결 자산
  const [linkedAssetId, setLinkedAssetId] = useState<string>('')
  const [linkableAssets, setLinkableAssets] = useState<{ id: string; name: string; type: AccountType }[]>([])

  // 부동산 상세
  const [rePropertyType, setRePropertyType] = useState('')
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
      setName(initialData.name)
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
      getEligibleParentAccounts(initialData?.id).then(setEligibleParents)
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
    setPOwnerId('')
  }

  const handleClose = () => { setConfirmDelete(false); onClose() }

  function buildDetailInput() {
    const realEstateDetail: RealEstateDetailInput | undefined = isRealEstate ? {
      propertyType: rePropertyType || undefined,
      purchasePrice: parseNum(rePurchasePrice),
      purchaseDate: rePurchaseDate || undefined,
      currentPrice: parseNum(reCurrentPrice),
      targetPrice: parseNum(reTargetPrice),
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
        if (!result.success) { toast.error(result.error || '수정에 실패했습니다.'); return }
        toast.success(`"${name.trim()}" 계좌가 수정되었습니다.`)
      } else {
        const result = await createAccount({
          name: name.trim(), type, balance: parsedBalance, shareLevel,
          ownerId: ownerIdInput, isJoint: isJointInput,
          parentAccountId: parentAccountId || null,
          linkedAssetId: isDebt ? (linkedAssetId || null) : null,
          realEstateDetail, financialAssetDetail, debtDetail, pensionDetail,
        })
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
      onSuccess(); onClose()
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsDeleting(false); setConfirmDelete(false)
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
                    <TypeIcon className={cn('w-5 h-5 flex-shrink-0', isSelected ? 'text-background' : t.color)} />
                    <div>
                      <p className={cn('text-xs font-semibold leading-tight', isSelected ? 'text-background' : 'text-foreground')}>{t.label}</p>
                      <p className={cn('text-[10px] mt-0.5', isSelected ? 'text-background/50' : 'text-muted-foreground')}>{t.desc}</p>
                    </div>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-foreground rounded-full flex items-center justify-center shadow">
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
              className="w-full h-11 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors"
            />
          </div>

          {/* 상위 계좌 (계층 구조) — 상품 모드에서는 숨김 */}
          {!isProductMode && !isLiabilityType && !isRealEstate && eligibleParents.length > 0 && (
            <div>
              <Label className="text-muted-foreground text-xs mb-1.5 block">상위 계좌</Label>
              <div className="relative">
                <select
                  value={parentAccountId}
                  onChange={e => setParentAccountId(e.target.value)}
                  className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-none focus:border-ring transition-colors appearance-none"
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
                className="w-full h-11 bg-card border border-border rounded-xl pl-4 pr-10 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">원</span>
            </div>
          </div>

          {/* ── 상세 섹션들 — 상품 모드에서는 모두 숨김 ─────────────── */}

          {/* ── 부동산 상세 ─────────────────────────────────────────── */}
          {!isProductMode && isRealEstate && (
            <>
              <SectionDivider label="부동산 상세" />
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">부동산 유형</Label>
                <div className="relative">
                  <select
                    value={rePropertyType}
                    onChange={e => setRePropertyType(e.target.value)}
                    className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-none focus:border-ring transition-colors appearance-none"
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
            <>
              <SectionDivider label="금융자산 상세" />
              <div className="grid grid-cols-2 gap-3">
                <RateField   label="이자율 / 수익률" value={faInterestRate}   onChange={setFaInterestRate} />
                <NumberField label="월 납입액"        value={faMonthlyPayment} onChange={setFaMonthlyPayment} />
              </div>
              <DateField label="만기일" value={faMaturityDate} onChange={setFaMaturityDate} />
            </>
          )}

          {/* ── 연금 상세 ────────────────────────────────────────────── */}
          {!isProductMode && isPension && (
            <>
              <SectionDivider label="연금 상세" />

              {/* 연금 종류 */}
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">연금 종류</Label>
                <div className="relative">
                  <select
                    value={pPensionType}
                    onChange={e => setPPensionType(e.target.value as PensionType)}
                    className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-none focus:border-ring transition-colors appearance-none"
                  >
                    {PENSION_TYPES_LIST.map(pt => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* 기관명 */}
              <div>
                <Label className="text-muted-foreground text-xs mb-1.5 block">기관명</Label>
                <input
                  type="text"
                  value={pInstitutionName}
                  onChange={e => setPInstitutionName(e.target.value)}
                  placeholder="예: 국민연금공단, 삼성생명"
                  className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberField label="월 납입액"      value={pMonthlyPayment}           onChange={setPMonthlyPayment} />
                <NumberField label="예상 월 수령액"  value={pExpectedMonthlyPension}    onChange={setPExpectedMonthlyPension} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs mb-1.5 block">개시 예정 나이</Label>
                  <div className="relative">
                    <input
                      type="number" min="50" max="80" value={pPensionStartAge}
                      onChange={e => setPPensionStartAge(e.target.value)}
                      placeholder="65"
                      className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-10 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">세</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs mb-1.5 block">출생연도</Label>
                  <input
                    type="number" min="1940" max="2010" value={pOwnerBirthYear}
                    onChange={e => setPOwnerBirthYear(e.target.value)}
                    placeholder="1990"
                    className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs mb-1.5 block">납입 개월 수</Label>
                  <div className="relative">
                    <input
                      type="number" min="0" value={pAccumulatedMonths}
                      onChange={e => setPAccumulatedMonths(e.target.value)}
                      placeholder="0"
                      className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-12 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">개월</span>
                  </div>
                </div>
              </div>
            </>
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
                    className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-none focus:border-ring transition-colors appearance-none"
                  >
                    {DEBT_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* 연결 자산 Select — 주담대/전세 시 강조 */}
              <div className={cn(
                'rounded-xl p-3 -mx-1 transition-all',
                needsLinkedAsset
                  ? 'bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/30'
                  : 'bg-transparent border border-transparent'
              )}>
                <Label className={cn(
                  'text-xs mb-1.5 flex items-center gap-1.5',
                  needsLinkedAsset ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'
                )}>
                  연결된 자산 (담보 등)
                  {needsLinkedAsset && (
                    <span className="text-[10px] bg-amber-200 dark:bg-amber-400/40 text-amber-800 dark:text-amber-100 border border-amber-300 dark:border-amber-400/60 px-1.5 py-0.5 rounded-md font-semibold">
                      {dDebtType === 'MORTGAGE' ? '주담대 담보 자산' : '전세 대상 자산'} 연결 권장
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <select
                    value={linkedAssetId}
                    onChange={e => setLinkedAssetId(e.target.value)}
                    className={cn(
                      'w-full h-10 bg-card rounded-xl pl-4 pr-9 text-sm text-foreground outline-none transition-colors appearance-none',
                      needsLinkedAsset && !linkedAssetId
                        ? 'border border-amber-500/50 focus:border-amber-400'
                        : 'border border-border focus:border-ring'
                    )}
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
                  <p className="text-xs text-amber-600 dark:text-amber-500/70 mt-1">LTV 분석을 위해 연결 자산을 선택하면 좋아요.</p>
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
                      className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-none focus:border-ring transition-colors appearance-none"
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
                  className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-none focus:border-ring transition-colors appearance-none"
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

          {/* 가족 공유 설정 */}
          {!isProductMode && <div>
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
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', isSelected ? 'bg-foreground/10' : 'bg-muted')}>
                      <ShareIcon className={cn('w-4 h-4', isSelected ? s.color : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', isSelected ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                      isSelected ? `border-current ${s.color} bg-current scale-110` : 'border-border'
                    )} />
                  </button>
                )
              })}
            </div>
          </div>}
        </div>

        <DrawerFooter className="px-6 pb-8 pt-2 gap-2">
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

          {isEditMode && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                'w-full h-11 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
                confirmDelete
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                  : 'bg-card border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30'
              )}
            >
              {isDeleting
                ? <><Loader2 className="w-4 h-4 animate-spin" />삭제 중...</>
                : <><Trash2 className="w-4 h-4" />{confirmDelete ? '정말 삭제하시겠습니까?' : '계좌 삭제'}</>
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

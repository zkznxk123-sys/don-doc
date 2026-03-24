'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export type AccountType = 'CASH' | 'INVESTMENT' | 'PENSION' | 'CRYPTO' | 'REAL_ESTATE' | 'STO' | 'DEBT' | 'CREDIT_CARD'
export type ShareLevel = 'PUBLIC' | 'BALANCE_ONLY' | 'PRIVATE'
export type RepaymentType = 'EQUAL_PRINCIPAL_INTEREST' | 'EQUAL_PRINCIPAL' | 'BULLET' | 'INTEREST_ONLY'
export type DebtType = 'MORTGAGE' | 'JEONSE_DEPOSIT' | 'CREDIT_LOAN' | 'OVERDRAFT' | 'ETC'

const LIABILITY_TYPES: AccountType[] = ['DEBT', 'CREDIT_CARD']

// ─── 상세 입력 타입 ────────────────────────────────────────────────────────────

export interface RealEstateDetailInput {
  propertyType?: string
  purchasePrice?: number | null
  purchaseDate?: string | null   // "YYYY-MM-DD"
  currentPrice?: number | null
  targetPrice?: number | null
}

export interface FinancialAssetDetailInput {
  interestRate?: number | null
  maturityDate?: string | null   // "YYYY-MM-DD"
  monthlyPayment?: number | null
}

export interface DebtDetailInput {
  debtType?: DebtType | null
  interestRate?: number | null
  maturityDate?: string | null   // "YYYY-MM-DD"
  repaymentType?: RepaymentType | null
  monthlyPayment?: number | null
}

export interface CreateAccountInput {
  name: string
  type: AccountType
  balance: number
  shareLevel: ShareLevel
  linkedAssetId?: string | null
  realEstateDetail?: RealEstateDetailInput
  financialAssetDetail?: FinancialAssetDetailInput
  debtDetail?: DebtDetailInput
}

// ─── 계좌 + 상세 조회 ──────────────────────────────────────────────────────────

export interface AccountWithDetail {
  id: string
  name: string
  type: AccountType
  balance: number
  shareLevel: ShareLevel
  isShared: boolean
  linkedAssetId: string | null
  realEstateDetail: {
    propertyType: string | null
    purchasePrice: number | null
    purchaseDate: string | null
    currentPrice: number | null
    targetPrice: number | null
  } | null
  financialAssetDetail: {
    interestRate: number | null
    maturityDate: string | null
    monthlyPayment: number | null
  } | null
  debtDetail: {
    debtType: DebtType
    interestRate: number | null
    maturityDate: string | null
    repaymentType: RepaymentType | null
    monthlyPayment: number | null
  } | null
}

export async function getAccountWithDetail(id: string): Promise<AccountWithDetail | null> {
  const user = await getAuthUser()
  if (!user?.familyId) return null

  const account = await prisma.account.findFirst({
    where: { id, familyId: user.familyId },
    include: {
      realEstateDetail: true,
      financialAssetDetail: true,
      debtDetail: true,
    },
  })
  if (!account) return null

  const toDateStr = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null

  return {
    id: account.id,
    name: account.name,
    type: account.type as AccountType,
    balance: account.balance,
    shareLevel: account.shareLevel as ShareLevel,
    isShared: account.isShared,
    linkedAssetId: account.linkedAssetId,
    realEstateDetail: account.realEstateDetail
      ? {
          propertyType: account.realEstateDetail.propertyType,
          purchasePrice: account.realEstateDetail.purchasePrice,
          purchaseDate: toDateStr(account.realEstateDetail.purchaseDate),
          currentPrice: account.realEstateDetail.currentPrice,
          targetPrice: account.realEstateDetail.targetPrice,
        }
      : null,
    financialAssetDetail: account.financialAssetDetail
      ? {
          interestRate: account.financialAssetDetail.interestRate,
          maturityDate: toDateStr(account.financialAssetDetail.maturityDate),
          monthlyPayment: account.financialAssetDetail.monthlyPayment,
        }
      : null,
    debtDetail: account.debtDetail
      ? {
          debtType: account.debtDetail.debtType as DebtType,
          interestRate: account.debtDetail.interestRate,
          maturityDate: toDateStr(account.debtDetail.maturityDate),
          repaymentType: account.debtDetail.repaymentType as RepaymentType | null,
          monthlyPayment: account.debtDetail.monthlyPayment,
        }
      : null,
  }
}

// ─── 부동산 상세 + 연결 부채 ───────────────────────────────────────────────────

export interface LinkedDebt {
  id: string
  name: string
  type: AccountType
  balance: number         // 부채 잔액
  interestRate: number | null
  maturityDate: string | null
  repaymentType: RepaymentType | null
  monthlyPayment: number | null
}

export interface RealEstateWithDebts {
  id: string
  name: string
  balance: number         // 등록 잔액 (현재 시세와 다를 수 있음)
  shareLevel: ShareLevel
  propertyType: string | null
  purchasePrice: number | null
  purchaseDate: string | null
  currentPrice: number | null
  targetPrice: number | null
  linkedDebts: LinkedDebt[]
  // 계산 지표 (null = 필요한 데이터 없음)
  roi: number | null            // (현재가 - 매수원금) / 매수원금 * 100
  netEquity: number | null      // 현재가 - 총 부채
  ltv: number | null            // 총 부채 / 현재가 * 100
  totalDebt: number
}

export async function getRealEstateWithDebts(accountId: string): Promise<RealEstateWithDebts | null> {
  const user = await getAuthUser()
  if (!user?.familyId) return null

  const account = await prisma.account.findFirst({
    where: { id: accountId, familyId: user.familyId, type: 'REAL_ESTATE' },
    include: {
      realEstateDetail: true,
      linkedDebts: {
        include: { debtDetail: true },
      },
    },
  })
  if (!account) return null

  const toDateStr = (d: Date | null | undefined) => d ? d.toISOString().slice(0, 10) : null

  const linkedDebts: LinkedDebt[] = account.linkedDebts.map(d => ({
    id: d.id,
    name: d.name,
    type: d.type as AccountType,
    balance: d.balance,
    interestRate: d.debtDetail?.interestRate ?? null,
    maturityDate: toDateStr(d.debtDetail?.maturityDate),
    repaymentType: (d.debtDetail?.repaymentType as RepaymentType) ?? null,
    monthlyPayment: d.debtDetail?.monthlyPayment ?? null,
  }))

  const totalDebt = linkedDebts.reduce((s, d) => s + d.balance, 0)
  const detail = account.realEstateDetail
  const currentPrice = detail?.currentPrice ?? null
  const purchasePrice = detail?.purchasePrice ?? null

  const roi = currentPrice != null && purchasePrice != null && purchasePrice > 0
    ? ((currentPrice - purchasePrice) / purchasePrice) * 100
    : null

  const netEquity = currentPrice != null ? currentPrice - totalDebt : null
  const ltv = currentPrice != null && currentPrice > 0 && totalDebt > 0
    ? (totalDebt / currentPrice) * 100
    : null

  return {
    id: account.id,
    name: account.name,
    balance: account.balance,
    shareLevel: account.shareLevel as ShareLevel,
    propertyType: detail?.propertyType ?? null,
    purchasePrice: detail?.purchasePrice ?? null,
    purchaseDate: toDateStr(detail?.purchaseDate),
    currentPrice,
    targetPrice: detail?.targetPrice ?? null,
    linkedDebts,
    roi,
    netEquity,
    ltv,
    totalDebt,
  }
}

/** 부채 연결 대상 자산 목록 (부채·신용카드 제외) */
export async function getFamilyAssetsForLinking(): Promise<{ id: string; name: string; type: AccountType }[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const accounts = await prisma.account.findMany({
    where: {
      familyId: user.familyId,
      type: { notIn: ['DEBT', 'CREDIT_CARD'] },
    },
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
  })

  return accounts.map(a => ({ id: a.id, name: a.name, type: a.type as AccountType }))
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createAccount(
  input: CreateAccountInput
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }
  if (!user.familyId) return { success: false, error: '가족 그룹이 없습니다.' }

  const name = input.name.trim()
  if (!name) return { success: false, error: '계좌 이름을 입력해주세요.' }
  if (name.length > 30) return { success: false, error: '30자 이하로 입력해주세요.' }
  if (!LIABILITY_TYPES.includes(input.type) && input.balance < 0)
    return { success: false, error: '잔액은 0 이상이어야 합니다.' }

  const isShared = input.shareLevel !== 'PRIVATE'

  await prisma.account.create({
    data: {
      name,
      type: input.type,
      balance: input.balance,
      shareLevel: input.shareLevel,
      isShared,
      familyId: user.familyId,
      userId: isShared ? null : user.id,
      linkedAssetId: input.linkedAssetId ?? null,
      ...(input.type === 'REAL_ESTATE' && input.realEstateDetail
        ? { realEstateDetail: { create: buildRealEstateData(input.realEstateDetail) } }
        : {}),
      ...(['CASH', 'INVESTMENT', 'CRYPTO', 'STO'].includes(input.type) && input.financialAssetDetail
        ? { financialAssetDetail: { create: buildFinancialData(input.financialAssetDetail) } }
        : {}),
      ...(input.type === 'DEBT' && input.debtDetail
        ? { debtDetail: { create: buildDebtData(input.debtDetail) } }
        : {}),
    },
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateAccount(
  id: string,
  input: Partial<CreateAccountInput>
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const account = await prisma.account.findFirst({
    where: { id, familyId: user.familyId ?? undefined },
  })
  if (!account) return { success: false, error: '계좌를 찾을 수 없습니다.' }

  const name = input.name?.trim()
  if (name !== undefined && !name) return { success: false, error: '계좌 이름을 입력해주세요.' }

  const shareLevel = input.shareLevel
  const isShared = shareLevel !== undefined ? shareLevel !== 'PRIVATE' : undefined
  const type = input.type ?? account.type

  await prisma.account.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.balance !== undefined && { balance: input.balance }),
      ...('linkedAssetId' in input && { linkedAssetId: input.linkedAssetId ?? null }),
      ...(shareLevel !== undefined && {
        shareLevel,
        isShared: isShared!,
        userId: isShared ? null : user.id,
      }),
    },
  })

  // 상세 정보 upsert (제공된 경우만)
  if (type === 'REAL_ESTATE' && input.realEstateDetail !== undefined) {
    const data = buildRealEstateData(input.realEstateDetail!)
    await prisma.realEstateDetail.upsert({
      where: { accountId: id },
      update: data,
      create: { accountId: id, ...data },
    })
  }

  if (['CASH', 'INVESTMENT', 'CRYPTO', 'STO'].includes(type) && input.financialAssetDetail !== undefined) {
    const data = buildFinancialData(input.financialAssetDetail!)
    await prisma.financialAssetDetail.upsert({
      where: { accountId: id },
      update: data,
      create: { accountId: id, ...data },
    })
  }

  if (type === 'DEBT' && input.debtDetail !== undefined) {
    const data = buildDebtData(input.debtDetail!)
    await prisma.debtDetail.upsert({
      where: { accountId: id },
      update: data,
      create: { accountId: id, ...data },
    })
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteAccount(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const account = await prisma.account.findFirst({
    where: { id, familyId: user.familyId ?? undefined },
  })
  if (!account) return { success: false, error: '계좌를 찾을 수 없습니다.' }

  await prisma.account.delete({ where: { id } })

  revalidatePath('/dashboard')
  return { success: true }
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function buildRealEstateData(d: RealEstateDetailInput) {
  return {
    propertyType: d.propertyType ?? null,
    purchasePrice: d.purchasePrice ?? null,
    purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
    currentPrice: d.currentPrice ?? null,
    targetPrice: d.targetPrice ?? null,
  }
}

function buildFinancialData(d: FinancialAssetDetailInput) {
  return {
    interestRate: d.interestRate ?? null,
    maturityDate: d.maturityDate ? new Date(d.maturityDate) : null,
    monthlyPayment: d.monthlyPayment ?? null,
  }
}

function buildDebtData(d: DebtDetailInput) {
  return {
    debtType: d.debtType ?? 'ETC',
    interestRate: d.interestRate ?? null,
    maturityDate: d.maturityDate ? new Date(d.maturityDate) : null,
    repaymentType: d.repaymentType ?? null,
    monthlyPayment: d.monthlyPayment ?? null,
  }
}

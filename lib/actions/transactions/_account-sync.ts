/**
 * accountBalances 동기화 헬퍼 — private helpers.
 *
 * bulk.ts('use server')에서 분리한 이유: server action 파일 안 함수를 export하면
 * 자동으로 server action 엔드포인트가 되어 클라이언트 호출이 가능해진다. 이 헬퍼는
 * 내부용이라 직접 노출하지 않아야 하므로 일반 모듈로 분리. 동시에 테스트 가능해짐.
 *
 * 분기 우선순위:
 *   1) ExcelMapping lookup (사용자 명시 매핑이 진실)
 *   2) fuzzy account match → 증권계좌면 cash-sub '예수금' 자식 생성
 *   3) holding 이름 매칭 → 잔액 동기화 skip (이미 holding으로 들어감)
 *   4a) fuzzy hit → 매칭된 계좌에 잔액 sync
 *   4b) 매칭 실패 + NEW_ACCOUNT 명시 매핑 → 신규 생성 허용
 *   4c) 매칭 실패 + 명시 의도 없음 → 차단(asset-input-redesign 1b), pending mapping
 */

import { prisma } from '@/lib/prisma'
import { findExcelMapping } from '@/lib/actions/excel-mapping'
import type { PendingBalance } from './_dedup'

export type MappingToUpsert = {
  excelName: string
  mappingType: 'ACCOUNT' | 'CASH_SUB' | 'HOLDING_SKIP'
  targetAccountId: string
}

export interface BalanceSyncPlan {
  pendings: PendingBalance[]
  mappingsToUpsert: MappingToUpsert[]
  skipped: string[]
  cashSubCreated: string[]
}

export type AccountTypeForSync = 'CASH' | 'INVESTMENT' | 'PENSION' | 'REAL_ESTATE' | 'DEBT'

export interface AccountBalanceInput {
  name: string
  balance: number
  type?: AccountTypeForSync
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/**
 * 계좌명으로 Account 조회 → 없으면 자동 생성 (4단계 매칭).
 * - 1) userId 소유 계좌 / 2) 공유 포함 가족 전체 / 3) 공백 정규화 fuzzy / 4) holding 이름 매칭
 * - 모두 실패 시 신규 생성. 1b 차단 후에는 resolveAccountSyncPlan 안에서만 명시적 NEW_ACCOUNT 경로로 호출.
 */
export async function findOrCreateAccount(
  name: string,
  familyId: string,
  type: AccountTypeForSync = 'CASH',
  userId?: string
): Promise<string> {
  if (userId) {
    const userOwned = await prisma.account.findFirst({
      where: { familyId, name: { contains: name, mode: 'insensitive' }, userId },
      select: { id: true },
    })
    if (userOwned) return userOwned.id
  }
  const existing = await prisma.account.findFirst({
    where: { familyId, name: { contains: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existing) return existing.id

  const normalized = normalize(name)
  const allFamilyAccounts = await prisma.account.findMany({
    where: { familyId },
    select: { id: true, name: true, holdings: { select: { name: true } } },
  })
  const fuzzyMatch = allFamilyAccounts.find(a => {
    const aNorm = normalize(a.name)
    return aNorm.includes(normalized) || normalized.includes(aNorm)
  })
  if (fuzzyMatch) return fuzzyMatch.id

  const holdingMatch = allFamilyAccounts.find(a =>
    a.holdings.some(h => {
      const hNorm = normalize(h.name)
      return hNorm.includes(normalized) || normalized.includes(hNorm)
    })
  )
  if (holdingMatch) return holdingMatch.id

  const created = await prisma.account.create({
    data: {
      name,
      type,
      balance: 0,
      isShared: false,
      shareLevel: 'PUBLIC',
      familyId,
      ...(userId ? { userId } : {}),
    },
  })
  return created.id
}

/**
 * accountBalances를 분류해 BalanceSyncPlan 수립.
 * createManyTransactions·syncAccountBalancesOnly 공유.
 */
export async function resolveAccountSyncPlan(args: {
  familyId: string
  userId: string
  accountBalances: AccountBalanceInput[]
  /**
   * 미매칭 계좌 자동 생성 허용. 기본 false(1b 차단 유지 — 은행 export 잔액
   * 동기화는 지저분한 이름이 쓰레기 계좌를 만들지 않게 skip). 자산 템플릿
   * import(부자공식 등)는 "내 순자산을 통째로 등록"이 목적이고 type이 신뢰
   * 가능하므로 true로 호출 → 미매칭 이름을 파서 type으로 신규 생성.
   */
  autoCreate?: boolean
}): Promise<BalanceSyncPlan> {
  const { familyId, userId, accountBalances, autoCreate = false } = args
  const pendings: PendingBalance[] = []
  const mappingsToUpsert: MappingToUpsert[] = []
  const skipped: string[] = []
  const cashSubCreated: string[] = []

  if (accountBalances.length === 0) return { pendings, mappingsToUpsert, skipped, cashSubCreated }

  const allFamilyAccounts = await prisma.account.findMany({
    where: { familyId },
    select: {
      id: true, name: true, type: true, balance: true,
      holdings: { select: { name: true } },
      subAccounts: { select: { id: true, name: true, balance: true } },
    },
  })

  for (const ab of accountBalances) {
    // 0. ExcelMapping 우선 lookup
    const mapping = await findExcelMapping(familyId, ab.name)
    if (mapping) {
      if (mapping.mappingType === 'IGNORE' || mapping.mappingType === 'HOLDING_SKIP') {
        skipped.push(`${ab.name} (mapping:${mapping.mappingType})`)
        continue
      }
      if (mapping.mappingType === 'CASH_SUB' && mapping.targetAccountId) {
        const parent = allFamilyAccounts.find(a => a.id === mapping.targetAccountId)
        if (parent) {
          const existingCashSub = parent.subAccounts.find(s => s.name === '예수금')
          if (existingCashSub) {
            pendings.push({ accountId: existingCashSub.id, oldBalance: existingCashSub.balance, newBalance: ab.balance })
          } else {
            const created = await prisma.account.create({
              data: {
                name: '예수금', type: 'CASH', balance: ab.balance,
                familyId, userId, parentAccountId: parent.id,
                isShared: true, shareLevel: 'PUBLIC',
              },
            })
            cashSubCreated.push(`${parent.name} 예수금 (mapping)`)
            pendings.push({ accountId: created.id, oldBalance: 0, newBalance: ab.balance })
          }
          continue
        }
        // parent 사라진 경우 fall through to 일반
      }
      if (mapping.mappingType === 'ACCOUNT' && mapping.targetAccountId) {
        const acc = await prisma.account.findUnique({
          where: { id: mapping.targetAccountId },
          select: { balance: true },
        })
        if (acc) {
          pendings.push({ accountId: mapping.targetAccountId, oldBalance: acc.balance, newBalance: ab.balance })
          continue
        }
        // 대상 계좌 삭제된 경우 fall through
      }
      // NEW_ACCOUNT는 4b 분기에서 명시 매핑 의도로 처리
    }

    // 1. fuzzy account match
    const abNorm = normalize(ab.name)
    const accountHit = allFamilyAccounts.find(a => {
      const aNorm = normalize(a.name)
      return aNorm.includes(abNorm) || abNorm.includes(aNorm)
    })

    // 2. cash-sub: account 매칭됐는데 holdings 있는 증권계좌 → 자식 '예수금'
    if (accountHit && accountHit.holdings.length > 0) {
      const existingCashSub = accountHit.subAccounts.find(s => s.name === '예수금')
      if (existingCashSub) {
        pendings.push({ accountId: existingCashSub.id, oldBalance: existingCashSub.balance, newBalance: ab.balance })
      } else {
        const created = await prisma.account.create({
          data: {
            name: '예수금', type: 'CASH', balance: ab.balance,
            familyId, userId, parentAccountId: accountHit.id,
            isShared: true, shareLevel: 'PUBLIC',
          },
        })
        cashSubCreated.push(`${accountHit.name} 예수금`)
        pendings.push({ accountId: created.id, oldBalance: 0, newBalance: ab.balance })
      }
      if (!mapping) mappingsToUpsert.push({ excelName: ab.name, mappingType: 'CASH_SUB', targetAccountId: accountHit.id })
      continue
    }

    // 3. holding-skip: account 매칭 안 됐고 holding 이름 매칭 → 잔액 동기화 skip
    if (!accountHit) {
      const holdingHit = allFamilyAccounts.find(a =>
        a.holdings.some(h => {
          const hNorm = normalize(h.name)
          return hNorm.includes(abNorm) || abNorm.includes(hNorm)
        })
      )
      if (holdingHit) {
        skipped.push(ab.name)
        if (!mapping) mappingsToUpsert.push({ excelName: ab.name, mappingType: 'HOLDING_SKIP', targetAccountId: holdingHit.id })
        continue
      }
    }

    // 4. 일반 분기 — 2026-06-11 [asset-input-redesign 1b] 신규 계좌 자동 생성 차단
    // 4a. fuzzy accountHit 있음: 매칭된 계좌에 잔액 동기화
    if (accountHit) {
      pendings.push({ accountId: accountHit.id, oldBalance: accountHit.balance, newBalance: ab.balance })
      if (!mapping) mappingsToUpsert.push({ excelName: ab.name, mappingType: 'ACCOUNT', targetAccountId: accountHit.id })
      continue
    }

    // 4b. 매칭 실패 + 사용자가 NEW_ACCOUNT를 명시 매핑한 경우: 신규 생성 허용
    if (mapping?.mappingType === 'NEW_ACCOUNT') {
      const id = await findOrCreateAccount(ab.name, familyId, ab.type ?? 'CASH', userId)
      const acc = await prisma.account.findUnique({ where: { id }, select: { balance: true } })
      pendings.push({ accountId: id, oldBalance: acc?.balance ?? 0, newBalance: ab.balance })
      continue
    }

    // 4c. 매칭 실패 + 자산 템플릿 import: 파서 type으로 신규 생성.
    // 매핑은 저장 안 함 — 같은 이름으로 생성됐으니 다음 업로드는 4a fuzzy match로 잡힘.
    if (autoCreate) {
      const id = await findOrCreateAccount(ab.name, familyId, ab.type ?? 'CASH', userId)
      const acc = await prisma.account.findUnique({ where: { id }, select: { balance: true } })
      pendings.push({ accountId: id, oldBalance: acc?.balance ?? 0, newBalance: ab.balance })
      continue
    }

    // 4d. 매칭 실패 + 명시 의도 없음: 신규 자동 생성 차단(1b)
    skipped.push(`${ab.name} (no_match)`)
  }

  return { pendings, mappingsToUpsert, skipped, cashSubCreated }
}

/**
 * ExcelMapping 자동 upsert — mappingsToUpsert를 DB에 반영.
 * 다음 업로드부터 같은 row가 동일 결정으로 자동 분기.
 */
export async function upsertMappings(familyId: string, mappings: MappingToUpsert[]): Promise<void> {
  for (const m of mappings) {
    await prisma.excelMapping.upsert({
      where: { familyId_excelName: { familyId, excelName: m.excelName } },
      create: { familyId, excelName: m.excelName, mappingType: m.mappingType, targetAccountId: m.targetAccountId },
      update: { mappingType: m.mappingType, targetAccountId: m.targetAccountId },
    })
  }
}

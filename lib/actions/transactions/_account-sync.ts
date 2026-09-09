/**
 * 자산 잔액 동기화 계획(plan) — 순수 함수 + 스냅샷 로더. (2026-09-07 근원 재설계)
 *
 * 원칙 — "추측하지 말고, 멈추고, 보여주고, 되돌릴 수 있게":
 *   1) 식별은 바인딩(ExcelMapping: 명의자 + 표기명 → 대상)으로만. 바인딩이 없으면
 *      정규화 **완전 일치 + 유일** 일 때만 자동 제안을 적용하고, 부분 일치(substring)는
 *      후보로만 보여준다(적용 안 함). 다른 구성원 명의 계좌에는 자동으로 쓰지 않는다.
 *   2) 두 행이 같은 대상(계좌·필드)을 가리키면 조용히 합치지 않고 CONFLICT로 막는다.
 *   3) 계획 단계는 DB에 아무것도 쓰지 않는다. 생성·갱신은 apply(_apply-sync.ts)에서
 *      단일 트랜잭션으로.
 *   4) 레거시(userId=null) 바인딩은 조회하지 않는다 — 8/10 동명 가드를 우회해 배우자
 *      계좌를 덮어쓴 경로(2026-09-04 사고).
 *
 * 이 파일은 'use server'가 아니다(내부 헬퍼를 엔드포인트로 노출하지 않기 위해).
 * 순수 함수 planBalanceSync는 prisma 없이 테스트한다.
 */

import { prisma } from '@/lib/prisma'
import type { ExcelMappingType } from '@prisma/client'

// ━━ 입력 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type AccountTypeForSync = 'CASH' | 'INVESTMENT' | 'PENSION' | 'REAL_ESTATE' | 'DEBT'

export interface AccountBalanceInput {
  name: string
  balance: number
  type?: AccountTypeForSync
  /** 뱅샐 대출현황에서 온 대출 조건 — ACCOUNT 적용 시 DebtDetail(금리·만기)에 반영 */
  loan?: { lender: string | null; principal: number | null; interestRate: number | null; startDate: string | null; maturityDate: string | null }
  /** 뱅샐 투자현황의 금융사 — 종목 행을 어느 증권계좌 종목으로 볼지 제안 (예: "한국투자증권") */
  broker?: string
}

/** 사용자가 미리보기에서 확정한 행별 결정 (바인딩·자동 제안보다 우선) */
export type SyncDecisionKind = 'ACCOUNT' | 'ACCOUNT_CASH' | 'HOLDING_SKIP' | 'IGNORE' | 'NEW_ACCOUNT'
export interface SyncDecisionInput {
  kind: SyncDecisionKind
  targetAccountId?: string | null
}

// ━━ 스냅샷 (계획 입력 — DB 읽기 결과) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SnapshotAccount {
  id: string
  name: string
  type: string
  balance: number
  cashBalance: number
  userId: string | null
  ownerName: string | null
  holdingNames: string[]
}

export interface SnapshotBinding {
  excelName: string
  mappingType: ExcelMappingType
  targetAccountId: string | null
}

export interface SyncSnapshot {
  accounts: SnapshotAccount[]
  /** 명의자(ownerUserId) 축의 바인딩만 — null 레거시는 포함하지 않는다 */
  bindings: SnapshotBinding[]
}

// ━━ 출력 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type DecisionSource = 'binding' | 'auto' | 'user'
export type SyncTargetField = 'balance' | 'cashBalance'

export interface SyncCandidate {
  accountId: string
  accountName: string
  ownerName: string | null
  hasHoldings: boolean
  balance: number
  cashBalance: number
}

export type UnresolvedReason =
  | 'no_match'               // 후보 없음
  | 'fuzzy_only'             // 부분 일치 후보만 있음 — 자동 적용 안 함
  | 'ambiguous'              // 완전 일치가 2개+ 이고 명의로도 안 갈림
  | 'owner_mismatch'         // 완전 일치 1개지만 다른 구성원 명의
  | 'broker_ambiguous'       // 금융사 기준 후보 계좌가 2개+
  | 'binding_target_missing' // 바인딩/결정의 대상 계좌가 삭제됨

export type PlannedDecision =
  | { kind: 'ACCOUNT'; accountId: string; accountName: string; field: 'balance'; oldBalance: number; source: DecisionSource }
  | { kind: 'ACCOUNT_CASH'; accountId: string; accountName: string; field: 'cashBalance'; oldBalance: number; source: DecisionSource }
  | { kind: 'HOLDING_SKIP'; accountId: string | null; accountName: string | null; source: DecisionSource }
  | { kind: 'IGNORE'; source: DecisionSource }
  | { kind: 'NEW_ACCOUNT'; source: DecisionSource }
  | { kind: 'EXCLUDED' }
  | { kind: 'UNRESOLVED'; reason: UnresolvedReason; candidates: SyncCandidate[] }
  | { kind: 'CONFLICT'; accountId: string; accountName: string; field: SyncTargetField; withExcelNames: string[] }

export interface PlannedRow {
  excelName: string
  /** 같은 표기명 행이 한 파일에 여러 개면 합산값 (예: 뱅샐 "종합매매" 원화·외화 예수금 2행) */
  balance: number
  type: AccountTypeForSync
  /** 합산된 원본 행 수 (1 = 단일 행) */
  mergedCount: number
  /** mergedCount > 1일 때 원본 금액들 — 미리보기에 투명하게 표시 */
  parts?: number[]
  loan?: AccountBalanceInput['loan']
  broker?: string
  decision: PlannedDecision
}

export interface BalanceSyncPlan {
  rows: PlannedRow[]
  /** 적용 가능 여부 — 제외되지 않은 행 중 UNRESOLVED·CONFLICT가 없을 때 true */
  ready: boolean
  /** 적용을 막는 행 요약 (excelName: 사유) */
  blocking: { excelName: string; reason: string }[]
}

// ━━ 계획 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, '')

function toCandidate(a: SnapshotAccount): SyncCandidate {
  return {
    accountId: a.id, accountName: a.name, ownerName: a.ownerName,
    hasHoldings: a.holdingNames.length > 0, balance: a.balance, cashBalance: a.cashBalance,
  }
}

function targetDecision(
  kind: 'ACCOUNT' | 'ACCOUNT_CASH',
  acc: SnapshotAccount,
  source: DecisionSource,
): PlannedDecision {
  return kind === 'ACCOUNT'
    ? { kind, accountId: acc.id, accountName: acc.name, field: 'balance', oldBalance: acc.balance, source }
    : { kind, accountId: acc.id, accountName: acc.name, field: 'cashBalance', oldBalance: acc.cashBalance, source }
}

/** 바인딩 또는 사용자 결정 1건을 PlannedDecision으로 — 대상이 사라졌으면 UNRESOLVED */
function fromExplicit(
  k: SyncDecisionKind,
  targetAccountId: string | null | undefined,
  byId: Map<string, SnapshotAccount>,
  source: DecisionSource,
): PlannedDecision {
  if (k === 'IGNORE') return { kind: 'IGNORE', source }
  if (k === 'NEW_ACCOUNT') return { kind: 'NEW_ACCOUNT', source }
  const acc = targetAccountId ? byId.get(targetAccountId) : undefined
  if (k === 'HOLDING_SKIP') {
    return { kind: 'HOLDING_SKIP', accountId: acc?.id ?? null, accountName: acc?.name ?? null, source }
  }
  if (!acc) return { kind: 'UNRESOLVED', reason: 'binding_target_missing', candidates: [] }
  return targetDecision(k, acc, source)
}

/** 바인딩·결정이 없을 때의 자동 제안 — 완전 일치·유일·명의 일치일 때만 적용 */
function autoDecision(
  row: AccountBalanceInput,
  accounts: SnapshotAccount[],
  ownerUserId: string,
  autoCreate: boolean,
): PlannedDecision {
  const norm = normalizeName(row.name)
  if (!norm) return { kind: 'UNRESOLVED', reason: 'no_match', candidates: [] }

  // 1) 계좌명 완전 일치
  const exact = accounts.filter(a => normalizeName(a.name) === norm)
  if (exact.length > 0) {
    let hit: SnapshotAccount | null = exact.length === 1 ? exact[0] : null
    if (!hit) {
      const owned = exact.filter(a => a.userId === ownerUserId)
      if (owned.length === 1) hit = owned[0]
    }
    if (!hit) return { kind: 'UNRESOLVED', reason: 'ambiguous', candidates: exact.map(toCandidate) }
    // 다른 구성원 명의 계좌엔 자동으로 쓰지 않는다 (명의 미설정/공동은 허용)
    if (hit.userId && hit.userId !== ownerUserId) {
      return { kind: 'UNRESOLVED', reason: 'owner_mismatch', candidates: [toCandidate(hit)] }
    }
    return targetDecision(hit.holdingNames.length > 0 ? 'ACCOUNT_CASH' : 'ACCOUNT', hit, 'auto')
  }

  // 2) 종목명 완전 일치 → 잔액 동기화 skip (종목 가치는 holdings 시세가 진실)
  const holdingParents = accounts.filter(a => a.holdingNames.some(h => normalizeName(h) === norm))
  if (holdingParents.length === 1) {
    return { kind: 'HOLDING_SKIP', accountId: holdingParents[0].id, accountName: holdingParents[0].name, source: 'auto' }
  }
  if (holdingParents.length > 1) {
    return { kind: 'HOLDING_SKIP', accountId: null, accountName: null, source: 'auto' }
  }

  // 2.5) 뱅샐 투자현황 금융사 → 그 증권사 계좌의 종목으로. HOLDING_SKIP은 잔액을 쓰지 않아
  //      위험이 없으므로 후보가 유일하면 자동 적용, 여럿이면 후보로.
  if (row.broker) {
    const cands = accountsByBroker(row.broker, accounts, ownerUserId)
    if (cands.length === 1) {
      return { kind: 'HOLDING_SKIP', accountId: cands[0].id, accountName: cands[0].name, source: 'auto' }
    }
    if (cands.length > 1) return { kind: 'UNRESOLVED', reason: 'broker_ambiguous', candidates: cands.map(toCandidate) }
  }

  // 3) 부분 일치 — 후보로만 (적용 안 함)
  const fuzzy = accounts.filter(a => {
    const an = normalizeName(a.name)
    if (an.includes(norm) || norm.includes(an)) return true
    return a.holdingNames.some(h => { const hn = normalizeName(h); return hn.includes(norm) || norm.includes(hn) })
  })
  if (fuzzy.length > 0) return { kind: 'UNRESOLVED', reason: 'fuzzy_only', candidates: fuzzy.map(toCandidate) }

  // 4) 후보 없음 — 자산 템플릿 import(autoCreate)만 신규 생성
  if (autoCreate) return { kind: 'NEW_ACCOUNT', source: 'auto' }
  return { kind: 'UNRESOLVED', reason: 'no_match', candidates: [] }
}

const INVESTMENT_TYPES = new Set(['INVESTMENT', 'PENSION', 'CRYPTO', 'STO'])

/**
 * 금융사명으로 증권·연금 계좌 후보. "한화투자증권" → "한화투자증권 종합매매", "유진투자증권" → "유진증권",
 * "미래에셋증권" → "미래에셋2". 명의자 소유 계좌가 있으면 그쪽으로 좁힌다.
 */
function accountsByBroker(broker: string, accounts: SnapshotAccount[], ownerUserId: string): SnapshotAccount[] {
  const full = normalizeName(broker)
  const keys = Array.from(new Set([full, full.replace(/투자증권$/, ''), full.replace(/증권$/, '')])).filter(k => k.length >= 2)
  const pool = accounts.filter(a => INVESTMENT_TYPES.has(a.type))
  for (const k of keys) {
    const hits = pool.filter(a => normalizeName(a.name).includes(k))
    if (hits.length === 0) continue
    if (hits.length === 1) return hits
    const owned = hits.filter(a => a.userId === ownerUserId)
    return owned.length >= 1 ? owned : hits
  }
  return []
}

const REASON_LABEL: Record<UnresolvedReason, string> = {
  no_match: '일치하는 계좌가 없어요',
  fuzzy_only: '비슷한 계좌가 있지만 확정이 필요해요',
  ambiguous: '같은 이름의 계좌가 여러 개예요',
  owner_mismatch: '다른 구성원 명의 계좌예요',
  broker_ambiguous: '같은 금융사 계좌가 여러 개예요',
  binding_target_missing: '연결됐던 계좌가 삭제됐어요',
}

/**
 * 같은 표기명 행을 한 파일 안에서 합산한다.
 * 뱅크샐러드는 한 증권계좌의 원화·외화 예수금을 같은 상품명("종합매매")으로 두 줄 내보낸다.
 * 이름이 곧 키인 바인딩 모델에서는 이 두 줄이 같은 대상을 가리켜야 맞으므로, 서로 다른
 * 표기명이 한 대상으로 몰리는 CONFLICT와 달리 여기서는 합산이 정답이다. 합산 사실은
 * mergedCount·parts로 미리보기에 그대로 드러낸다(조용한 dedup이 아니다).
 */
function mergeSameNameRows(rows: AccountBalanceInput[]): (AccountBalanceInput & { mergedCount: number; parts?: number[] })[] {
  const order: string[] = []
  const byName = new Map<string, { name: string; balance: number; type?: AccountTypeForSync; loan?: AccountBalanceInput['loan']; broker?: string; parts: number[] }>()
  for (const r of rows) {
    const key = r.name.trim()
    const cur = byName.get(key)
    if (cur) { cur.balance += r.balance; cur.parts.push(r.balance); cur.loan = cur.loan ?? r.loan; cur.broker = cur.broker ?? r.broker }
    else { order.push(key); byName.set(key, { name: key, balance: r.balance, type: r.type, loan: r.loan, broker: r.broker, parts: [r.balance] }) }
  }
  return order.map(k => {
    const m = byName.get(k)!
    const loan = { ...(m.loan ? { loan: m.loan } : {}), ...(m.broker ? { broker: m.broker } : {}) }
    return m.parts.length > 1
      ? { name: m.name, balance: m.balance, type: m.type, ...loan, mergedCount: m.parts.length, parts: m.parts }
      : { name: m.name, balance: m.balance, type: m.type, ...loan, mergedCount: 1 }
  })
}

/**
 * 잔액 동기화 계획 수립 (순수 함수).
 * 우선순위: 제외 > 사용자 결정 > 바인딩 > 자동 제안. 마지막에 대상 충돌 검사.
 */
export function planBalanceSync(args: {
  rows: AccountBalanceInput[]
  snapshot: SyncSnapshot
  ownerUserId: string
  decisions?: Record<string, SyncDecisionInput>
  excludedNames?: string[]
  autoCreate?: boolean
}): BalanceSyncPlan {
  const { rows, snapshot, ownerUserId, decisions = {}, autoCreate = false } = args
  const excluded = new Set(args.excludedNames ?? [])
  const byId = new Map(snapshot.accounts.map(a => [a.id, a]))
  const bindingByName = new Map(snapshot.bindings.map(b => [b.excelName.trim(), b]))

  const planned: PlannedRow[] = mergeSameNameRows(rows).map(row => {
    const excelName = row.name
    const type = row.type ?? 'CASH'
    const base = { excelName, balance: row.balance, type, mergedCount: row.mergedCount, ...(row.parts ? { parts: row.parts } : {}), ...(row.loan ? { loan: row.loan } : {}), ...(row.broker ? { broker: row.broker } : {}) }
    if (excluded.has(excelName)) return { ...base, decision: { kind: 'EXCLUDED' } }

    const userDecision = decisions[excelName]
    if (userDecision) {
      return { ...base, decision: fromExplicit(userDecision.kind, userDecision.targetAccountId, byId, 'user') }
    }
    const binding = bindingByName.get(excelName)
    if (binding) {
      return { ...base, decision: fromExplicit(binding.mappingType, binding.targetAccountId, byId, 'binding') }
    }
    return { ...base, decision: autoDecision(row, snapshot.accounts, ownerUserId, autoCreate) }
  })

  // 대상 충돌 — 같은 (계좌, 필드)에 2행 이상이 쓰려 하면 전부 CONFLICT
  const writers = new Map<string, number[]>()
  planned.forEach((r, i) => {
    const d = r.decision
    if (d.kind === 'ACCOUNT' || d.kind === 'ACCOUNT_CASH') {
      const key = `${d.accountId}|${d.field}`
      writers.set(key, [...(writers.get(key) ?? []), i])
    }
  })
  for (const idxs of writers.values()) {
    if (idxs.length < 2) continue
    for (const i of idxs) {
      const d = planned[i].decision
      if (d.kind !== 'ACCOUNT' && d.kind !== 'ACCOUNT_CASH') continue
      planned[i] = {
        ...planned[i],
        decision: {
          kind: 'CONFLICT', accountId: d.accountId, accountName: d.accountName, field: d.field,
          withExcelNames: idxs.filter(j => j !== i).map(j => planned[j].excelName),
        },
      }
    }
  }

  const blocking = planned.flatMap(r => {
    if (r.decision.kind === 'UNRESOLVED') return [{ excelName: r.excelName, reason: REASON_LABEL[r.decision.reason] }]
    if (r.decision.kind === 'CONFLICT') {
      return [{ excelName: r.excelName, reason: `'${r.decision.withExcelNames.join(', ')}'와 같은 계좌(${r.decision.accountName})를 가리켜요` }]
    }
    return []
  })

  return { rows: planned, ready: blocking.length === 0, blocking }
}

// ━━ 스냅샷 로더 (DB 읽기 전용) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 계획에 필요한 가족 계좌 + 명의자 축 바인딩을 읽는다. 쓰기 없음.
 * 바인딩은 (familyId, ownerUserId)로만 조회 — userId=null 레거시 행은 의도적으로 제외.
 */
export async function loadSyncSnapshot(familyId: string, ownerUserId: string): Promise<SyncSnapshot> {
  const [accounts, bindings] = await Promise.all([
    prisma.account.findMany({
      where: { familyId },
      select: {
        id: true, name: true, type: true, balance: true, cashBalance: true, userId: true,
        user: { select: { name: true } },
        holdings: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.excelMapping.findMany({
      where: { familyId, userId: ownerUserId },
      select: { excelName: true, mappingType: true, targetAccountId: true },
    }),
  ])
  return {
    accounts: accounts.map(a => ({
      id: a.id, name: a.name, type: a.type, balance: a.balance, cashBalance: a.cashBalance,
      userId: a.userId, ownerName: a.user?.name ?? null, holdingNames: a.holdings.map(h => h.name),
    })),
    bindings,
  }
}

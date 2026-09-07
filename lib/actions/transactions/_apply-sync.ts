/**
 * 잔액 동기화 계획 적용 — 트랜잭션 클라이언트 안에서만 호출. (2026-09-07 근원 재설계)
 *
 * planBalanceSync 결과(ready=true)를 받아 계좌 생성·잔액/예수금 갱신·BalanceChangeLog·
 * 바인딩(ExcelMapping) upsert를 수행한다. 호출 측이 prisma.$transaction으로 감싸므로
 * 중간 실패 시 배치 전체가 취소된다.
 *
 * 'use server' 파일이 아니다 — 내부 헬퍼를 엔드포인트로 노출하지 않기 위해.
 */

import type { Prisma } from '@prisma/client'
import type { BalanceSyncPlan, SyncDecisionKind } from './_account-sync'

export interface ApplySyncResult {
  /** 잔액·예수금이 갱신(또는 신규 생성)된 계좌 수 */
  synced: number
  /** 값이 실제로 바뀐 건수 (BalanceChangeLog 건수) */
  changed: number
  /** 신규 생성된 계좌명 */
  created: string[]
  /** 동기화하지 않은 행 요약 (무시·종목) */
  skipped: string[]
}

type LogRow = {
  accountId: string; oldBalance: number; newBalance: number; delta: number
  field: 'balance' | 'cashBalance'; source: string; uploadBatchId: string
}

export async function applyBalanceSyncPlan(
  tx: Prisma.TransactionClient,
  args: {
    familyId: string
    /** 명의자 — 신규 계좌 소유자이자 바인딩 축 */
    ownerUserId: string
    plan: BalanceSyncPlan
    batchId: string
    source: string
  },
): Promise<ApplySyncResult> {
  const { familyId, ownerUserId, plan, batchId, source } = args
  if (!plan.ready) {
    throw new Error(`잔액 동기화 계획이 확정되지 않았습니다: ${plan.blocking.map(b => b.excelName).join(', ')}`)
  }

  const logs: LogRow[] = []
  const created: string[] = []
  const skipped: string[] = []
  let synced = 0

  const upsertBinding = async (excelName: string, mappingType: SyncDecisionKind, targetAccountId: string | null) => {
    await tx.excelMapping.upsert({
      where: { familyId_userId_excelName: { familyId, userId: ownerUserId, excelName } },
      create: { familyId, userId: ownerUserId, excelName, mappingType, targetAccountId },
      update: { mappingType, targetAccountId },
    })
  }

  for (const row of plan.rows) {
    const d = row.decision
    switch (d.kind) {
      case 'EXCLUDED':
        break

      case 'IGNORE':
        skipped.push(`${row.excelName} (무시)`)
        if (d.source === 'user') await upsertBinding(row.excelName, 'IGNORE', null)
        break

      case 'HOLDING_SKIP':
        skipped.push(`${row.excelName} (종목)`)
        if (d.source !== 'binding') await upsertBinding(row.excelName, 'HOLDING_SKIP', d.accountId)
        break

      case 'NEW_ACCOUNT': {
        const acc = await tx.account.create({
          data: {
            name: row.excelName, type: row.type, balance: row.balance,
            familyId, userId: ownerUserId, isShared: false, shareLevel: 'PUBLIC',
          },
          select: { id: true },
        })
        created.push(row.excelName)
        synced++
        if (row.balance !== 0) {
          logs.push({ accountId: acc.id, oldBalance: 0, newBalance: row.balance, delta: row.balance, field: 'balance', source, uploadBatchId: batchId })
        }
        // 다음 업로드부터는 이름 매칭 없이 바인딩으로 직행
        await upsertBinding(row.excelName, 'ACCOUNT', acc.id)
        break
      }

      case 'ACCOUNT':
      case 'ACCOUNT_CASH': {
        await tx.account.update({
          where: { id: d.accountId },
          data: d.field === 'balance' ? { balance: row.balance } : { cashBalance: row.balance },
        })
        synced++
        if (d.oldBalance !== row.balance) {
          logs.push({
            accountId: d.accountId, oldBalance: d.oldBalance, newBalance: row.balance,
            delta: row.balance - d.oldBalance, field: d.field, source, uploadBatchId: batchId,
          })
        }
        if (d.source !== 'binding') await upsertBinding(row.excelName, d.kind, d.accountId)
        break
      }

      case 'UNRESOLVED':
      case 'CONFLICT':
        // ready=true면 도달 불가 — 방어
        throw new Error(`확정되지 않은 행: ${row.excelName}`)
    }
  }

  if (logs.length > 0) await tx.balanceChangeLog.createMany({ data: logs })

  return { synced, changed: logs.length, created, skipped }
}

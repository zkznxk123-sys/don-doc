/**
 * 자산 동기화 근원 재설계(2026-09-07) 데이터 마이그레이션 + 9/4 사고 복구.
 *
 * 실행: NODE_PATH=$PWD/node_modules npx tsx scripts/migrate-asset-sync-20260907.ts [--apply]
 *   - 기본은 dry-run(변경 내용만 출력). --apply 시 단일 트랜잭션으로 반영.
 *   - 선행 조건: `npx prisma db push` 로 cashBalance·field·revertedAt·ACCOUNT_CASH 반영 완료.
 *
 * 단계
 *  1) "예수금" 자식 계좌(CASH, parent 있음, 거래 0건) → 부모.cashBalance 합산 후 삭제.
 *     자식의 BalanceChangeLog는 부모로 재지정(field=cashBalance) — 이력 보존.
 *  2) ExcelMapping CASH_SUB → ACCOUNT_CASH.
 *  3) 레거시(userId=null) 매핑 → 대상 계좌 소유자(userId)로 명의 부여.
 *     소유자 없는 계좌를 가리키거나 대상이 없으면 그대로 두거나 삭제 (더 이상 조회되지 않음 → 미리보기 재확정).
 *     같은 (family, owner, excelName) 행이 이미 있으면 레거시 행 삭제(명의 행이 진실).
 *  4) 9/4 사고 복구 — 안혜빈 업로드가 덮어쓴 한상빈 계좌 2건을 직전 값으로 (manual-repair 배치 + 로그).
 */
import fs from 'node:fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
import { PrismaClient, type Prisma } from '@prisma/client'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const won = (n: number) => Math.round(n).toLocaleString('ko-KR')

// 9/4 사고 복구 대상 — (계좌명, 소유자 이름, 잘못 덮어쓴 배치 파일명, 복구값)
const REPAIRS = [
  { accountName: '주택청약종합저축', ownerName: '한상빈', wrongValue: 6_450_000, restore: 15_650_000 },
  { accountName: '연금저축계좌(신)', ownerName: '한상빈', wrongValue: 25, restore: 40_508 },
]

async function main() {
  console.log(APPLY ? '### APPLY 모드' : '### DRY-RUN (변경 없음) — --apply 로 반영')

  // ── 1) 예수금 자식 → 부모.cashBalance ──
  const cashChildren = await prisma.account.findMany({
    where: { name: '예수금', type: 'CASH', parentAccountId: { not: null } },
    select: {
      id: true, balance: true, parentAccountId: true, familyId: true,
      parentAccount: { select: { name: true, cashBalance: true } },
      _count: { select: { transactions: true, subAccounts: true, holdings: true } },
    },
  })
  const byParent = new Map<string, typeof cashChildren>()
  for (const c of cashChildren) byParent.set(c.parentAccountId!, [...(byParent.get(c.parentAccountId!) ?? []), c])
  console.log(`\n## 1) 예수금 자식 ${cashChildren.length}개 → 부모 ${byParent.size}개`)
  for (const [pid, kids] of byParent) {
    const sum = kids.reduce((s, k) => s + k.balance, 0)
    console.log(`  ${kids[0].parentAccount!.name}: cashBalance ${won(kids[0].parentAccount!.cashBalance)} → ${won(kids[0].parentAccount!.cashBalance + sum)}  (자식 ${kids.map(k => won(k.balance)).join(' + ')})`)
    for (const k of kids) {
      if (k._count.transactions || k._count.subAccounts || k._count.holdings) throw new Error(`예수금 자식 ${k.id}에 거래/자식/종목이 있어 자동 이관 불가`)
    }
    void pid
  }

  // ── 2) CASH_SUB → ACCOUNT_CASH ──
  const cashSub = await prisma.excelMapping.findMany({ where: { mappingType: 'CASH_SUB' }, select: { id: true, excelName: true } })
  console.log(`\n## 2) CASH_SUB 매핑 ${cashSub.length}건 → ACCOUNT_CASH: ${cashSub.map(m => m.excelName).join(', ')}`)

  // ── 3) 레거시 매핑 명의 부여 ──
  const legacy = await prisma.excelMapping.findMany({ where: { userId: null }, select: { id: true, familyId: true, excelName: true, mappingType: true, targetAccountId: true } })
  const targets = await prisma.account.findMany({
    where: { id: { in: legacy.map(l => l.targetAccountId).filter((x): x is string => !!x) } },
    select: { id: true, name: true, userId: true, user: { select: { name: true } } },
  })
  const targetById = new Map(targets.map(t => [t.id, t]))
  const assign: { id: string; userId: string; excelName: string; owner: string; target: string }[] = []
  const dropDup: { id: string; excelName: string; owner: string }[] = []
  const dropNoTarget: { id: string; excelName: string }[] = []
  const keepNull: { id: string; excelName: string; target: string }[] = []
  for (const l of legacy) {
    if (!l.targetAccountId) {
      // NEW_ACCOUNT/IGNORE 처럼 대상 없는 레거시 — 명의를 알 수 없으므로 그대로(미적용)
      keepNull.push({ id: l.id, excelName: l.excelName, target: '(없음)' })
      continue
    }
    const t = targetById.get(l.targetAccountId)
    if (!t) { dropNoTarget.push({ id: l.id, excelName: l.excelName }); continue }
    if (!t.userId) { keepNull.push({ id: l.id, excelName: l.excelName, target: t.name }); continue }
    const dup = await prisma.excelMapping.findUnique({
      where: { familyId_userId_excelName: { familyId: l.familyId, userId: t.userId, excelName: l.excelName } },
      select: { id: true },
    })
    if (dup) dropDup.push({ id: l.id, excelName: l.excelName, owner: t.user?.name ?? t.userId })
    else assign.push({ id: l.id, userId: t.userId, excelName: l.excelName, owner: t.user?.name ?? t.userId, target: t.name })
  }
  console.log(`\n## 3) 레거시 매핑 ${legacy.length}건`)
  console.log(`  명의 부여 ${assign.length}건:`); for (const a of assign) console.log(`    ${a.excelName} → ${a.target} [${a.owner}]`)
  console.log(`  명의 행과 중복 → 삭제 ${dropDup.length}건:`); for (const d of dropDup) console.log(`    ${d.excelName} [${d.owner}]`)
  console.log(`  대상 계좌 없음 → 삭제 ${dropNoTarget.length}건:`); for (const d of dropNoTarget) console.log(`    ${d.excelName}`)
  console.log(`  명의 불명 → 유지(미적용, 미리보기 재확정) ${keepNull.length}건:`); for (const k of keepNull) console.log(`    ${k.excelName} → ${k.target}`)

  // ── 4) 9/4 사고 복구 ──
  const repairs: { accountId: string; name: string; from: number; to: number; familyId: string; userId: string }[] = []
  for (const r of REPAIRS) {
    const acc = await prisma.account.findFirst({
      where: { name: r.accountName, user: { name: r.ownerName } },
      select: { id: true, balance: true, familyId: true, userId: true },
    })
    if (!acc) { console.log(`  ⚠️ ${r.accountName} (${r.ownerName}) 계좌 없음 — 건너뜀`); continue }
    if (acc.balance !== r.wrongValue) { console.log(`  ⚠️ ${r.accountName} 현재값 ${won(acc.balance)} ≠ 예상 ${won(r.wrongValue)} — 이후 변경 있음, 건너뜀`); continue }
    repairs.push({ accountId: acc.id, name: r.accountName, from: acc.balance, to: r.restore, familyId: acc.familyId, userId: acc.userId! })
  }
  console.log(`\n## 4) 9/4 사고 복구 ${repairs.length}건`)
  for (const r of repairs) console.log(`  ${r.name}: ${won(r.from)} → ${won(r.to)}`)

  if (!APPLY) { console.log('\n(dry-run 종료)'); return }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1)
    for (const [pid, kids] of byParent) {
      const sum = kids.reduce((s, k) => s + k.balance, 0)
      await tx.account.update({ where: { id: pid }, data: { cashBalance: { increment: sum } } })
      for (const k of kids) {
        await tx.balanceChangeLog.updateMany({ where: { accountId: k.id }, data: { accountId: pid, field: 'cashBalance' } })
        await tx.account.delete({ where: { id: k.id } })
      }
    }
    // 2)
    if (cashSub.length) await tx.excelMapping.updateMany({ where: { id: { in: cashSub.map(m => m.id) } }, data: { mappingType: 'ACCOUNT_CASH' } })
    // 3)
    for (const a of assign) await tx.excelMapping.update({ where: { id: a.id }, data: { userId: a.userId } })
    const toDelete = [...dropDup.map(d => d.id), ...dropNoTarget.map(d => d.id)]
    if (toDelete.length) await tx.excelMapping.deleteMany({ where: { id: { in: toDelete } } })
    // 4)
    if (repairs.length) {
      const batch = await tx.uploadBatch.create({
        data: { familyId: repairs[0].familyId, userId: repairs[0].userId, fileName: '2026-09-04 동기화 사고 복구', source: 'manual-repair', syncedAccounts: repairs.length },
        select: { id: true },
      })
      for (const r of repairs) {
        await tx.account.update({ where: { id: r.accountId }, data: { balance: r.to } })
        await tx.balanceChangeLog.create({
          data: { accountId: r.accountId, oldBalance: r.from, newBalance: r.to, delta: r.to - r.from, field: 'balance', source: 'manual-repair', uploadBatchId: batch.id },
        })
      }
    }
  }, { timeout: 60_000 })
  console.log('\n✅ 반영 완료')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

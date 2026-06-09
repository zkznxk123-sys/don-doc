/**
 * BalanceChangeLog dedup — 같은 uploadBatchId + accountId 중복 합치기.
 *
 * 회귀 사례: 6/8 createManyTransactions에서 dedup 누락으로 같은 계좌에 N번 update + log N건 찍힘.
 * 같은 batch+account 그룹에서 첫 oldBalance + 마지막 newBalance로 합쳐 1건만 남기고 나머지 삭제.
 *
 * 사용:
 *   npx tsx scripts/dedup-balance-change-logs.ts <email>              # dry-run
 *   npx tsx scripts/dedup-balance-change-logs.ts <email> --apply      # dedup (옵션 A: 첫 row 합치고 나머지 삭제)
 *   npx tsx scripts/dedup-balance-change-logs.ts <email> --delete-all # 옵션 B: 중복 그룹 전체 삭제 (잘못된 ledger 완전 제거)
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const [, , email, ...flags] = process.argv
  if (!email) {
    console.error('사용: npx tsx scripts/dedup-balance-change-logs.ts <email> [--apply]')
    process.exit(1)
  }
  const apply = flags.includes('--apply')
  const deleteAll = flags.includes('--delete-all')

  const user = await prisma.user.findFirst({ where: { email } })
  if (!user?.familyId) {
    console.error(`❌ user 또는 familyId 없음: ${email}`)
    process.exit(1)
  }
  const familyId = user.familyId
  console.log(`\n🔍 familyId: ${familyId}\n`)

  // familyId 소속 모든 BalanceChangeLog (account의 familyId 통해 필터)
  const logs = await prisma.balanceChangeLog.findMany({
    where: {
      uploadBatchId: { not: null },
      account: { familyId },
    },
    orderBy: { changedAt: 'asc' },
    include: { account: { select: { name: true } }, uploadBatch: { select: { fileName: true, source: true } } },
  })

  // 그룹화: (uploadBatchId, accountId) → logs[]
  const groups = new Map<string, typeof logs>()
  for (const l of logs) {
    const key = `${l.uploadBatchId}__${l.accountId}`
    const arr = groups.get(key) ?? []
    arr.push(l)
    groups.set(key, arr)
  }

  const duplicateGroups = Array.from(groups.values()).filter(g => g.length > 1)
  if (duplicateGroups.length === 0) {
    console.log('✅ 중복 없음.\n')
    await prisma.$disconnect()
    return
  }

  console.log(`📊 중복 그룹 ${duplicateGroups.length}개 — 총 ${duplicateGroups.reduce((s, g) => s + g.length, 0)}건 → ${duplicateGroups.length}건으로 합침 (${duplicateGroups.reduce((s, g) => s + g.length - 1, 0)}건 삭제)\n`)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('샘플 (상위 10 그룹)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  duplicateGroups.slice(0, 10).forEach(g => {
    const first = g[0]
    const last = g[g.length - 1]
    console.log(`\n  ${first.account.name} · batch=${first.uploadBatch?.fileName ?? first.uploadBatch?.source ?? '-'} · ${g.length}건`)
    console.log(`    합칠 후: ${first.oldBalance.toLocaleString()} → ${last.newBalance.toLocaleString()} (Δ${(last.newBalance - first.oldBalance).toLocaleString()})`)
    console.log(`    삭제될 ${g.length - 1}건의 newBalance: ${g.slice(0, -1).map(l => l.newBalance.toLocaleString()).join(', ')}`)
  })

  if (!apply && !deleteAll) {
    console.log('\n💡 dry-run.')
    console.log('   옵션 A (--apply): 각 그룹 첫 row 합치고 나머지 삭제')
    console.log('   옵션 B (--delete-all): 중복 그룹 전체 삭제 (잘못된 ledger 완전 제거, 변경 이력 손실 감수)\n')
    await prisma.$disconnect()
    return
  }

  if (deleteAll) {
    // 옵션 B: 중복 그룹 전체 삭제 (마지막 newBalance가 종목 1개 평가액이라 ledger로 무의미한 케이스)
    const allIds = duplicateGroups.flatMap(g => g.map(l => l.id))
    const r = await prisma.balanceChangeLog.deleteMany({ where: { id: { in: allIds } } })
    console.log(`\n✅ 중복 그룹 ${duplicateGroups.length}개 — 총 ${r.count}건 삭제 완료.\n`)
    await prisma.$disconnect()
    return
  }

  // 옵션 A: 각 그룹 첫 row를 last의 newBalance·delta로 update, 나머지 삭제
  let updated = 0
  let deleted = 0
  for (const g of duplicateGroups) {
    const first = g[0]
    const last = g[g.length - 1]
    await prisma.balanceChangeLog.update({
      where: { id: first.id },
      data: { newBalance: last.newBalance, delta: last.newBalance - first.oldBalance },
    })
    updated++
    const toDeleteIds = g.slice(1).map(l => l.id)
    if (toDeleteIds.length > 0) {
      const r = await prisma.balanceChangeLog.deleteMany({ where: { id: { in: toDeleteIds } } })
      deleted += r.count
    }
  }

  console.log(`\n✅ ${updated} 그룹 합치기 + ${deleted}건 삭제 완료.\n`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

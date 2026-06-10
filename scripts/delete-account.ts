/**
 * 단일 account 삭제 (안전 가드 포함).
 *
 * 검증: balance=0 + holdings·subAccounts·transactions 모두 0건일 때만 삭제.
 * BalanceChangeLog는 cascade로 함께 삭제됨.
 *
 * 사용:
 *   npx tsx scripts/delete-account.ts <accountId>          # dry-run
 *   npx tsx scripts/delete-account.ts <accountId> --apply
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const [, , accountId, ...flags] = process.argv
  if (!accountId) {
    console.error('사용: npx tsx scripts/delete-account.ts <accountId> [--apply]')
    process.exit(1)
  }
  const apply = flags.includes('--apply')

  const acc = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      holdings: true,
      subAccounts: true,
      _count: { select: { transactions: true, balanceChanges: true } },
      family: { select: { name: true } },
    },
  })
  if (!acc) { console.error(`❌ account 없음: ${accountId}`); process.exit(1) }

  console.log(`\n🔍 ${acc.name} (${acc.type}) — family=${acc.family?.name}`)
  console.log(`   balance: ${acc.balance.toLocaleString()}`)
  console.log(`   holdings: ${acc.holdings.length}건 / subAccounts: ${acc.subAccounts.length}건`)
  console.log(`   transactions: ${acc._count.transactions}건 / BalanceChangeLog: ${acc._count.balanceChanges}건\n`)

  // 안전 가드
  const blockers: string[] = []
  if (acc.balance !== 0) blockers.push(`balance ≠ 0 (${acc.balance})`)
  if (acc.holdings.length > 0) blockers.push(`holdings ${acc.holdings.length}건`)
  if (acc.subAccounts.length > 0) blockers.push(`subAccounts ${acc.subAccounts.length}건`)
  if (acc._count.transactions > 0) blockers.push(`transactions ${acc._count.transactions}건`)

  if (blockers.length > 0) {
    console.error(`❌ 삭제 차단:`)
    blockers.forEach(b => console.error(`   - ${b}`))
    process.exit(1)
  }

  console.log(`✅ 안전 가드 통과. BalanceChangeLog ${acc._count.balanceChanges}건은 cascade로 함께 삭제됨.`)

  if (!apply) {
    console.log('\n💡 dry-run. 실제 삭제하려면 --apply 추가.\n')
    await prisma.$disconnect()
    return
  }

  await prisma.account.delete({ where: { id: accountId } })
  console.log(`\n✅ "${acc.name}" 삭제 완료.\n`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

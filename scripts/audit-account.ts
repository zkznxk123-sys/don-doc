/**
 * 계좌명으로 검색해서 account 본체·sub-account·최근 BalanceChangeLog dump.
 *
 * 사용:
 *   npx tsx scripts/audit-account.ts "연금저축펀드-키움"
 *   npx tsx scripts/audit-account.ts "연금" --limit=30
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const [, , query, ...flags] = process.argv
  if (!query) {
    console.error('사용: npx tsx scripts/audit-account.ts "계좌명" [--limit=20]')
    process.exit(1)
  }
  const limitArg = flags.find(f => f.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 20

  const accounts = await prisma.account.findMany({
    where: { name: { contains: query, mode: 'insensitive' } },
    include: {
      holdings: { select: { name: true, ticker: true, quantity: true, currentPrice: true } },
      subAccounts: { select: { id: true, name: true, balance: true, type: true } },
      family: { select: { name: true } },
    },
  })

  console.log(`\n🔍 query: "${query}" — ${accounts.length}개 account 검색됨\n`)

  for (const a of accounts) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📁 ${a.name} (${a.type}) — family=${a.family?.name ?? '?'}`)
    console.log(`   id: ${a.id}`)
    console.log(`   balance: ${a.balance.toLocaleString()}`)
    console.log(`   parentAccountId: ${a.parentAccountId ?? '-'}`)
    console.log(`   holdings: ${a.holdings.length}건`)
    a.holdings.slice(0, 5).forEach(h => console.log(`      ↳ ${h.name} ${h.ticker ?? ''} ${h.quantity}주`))
    console.log(`   subAccounts: ${a.subAccounts.length}건`)
    a.subAccounts.forEach(s => console.log(`      ↳ ${s.name} (${s.type}) ${s.balance.toLocaleString()} · id=${s.id}`))

    // BalanceChangeLog 조회 (자식 sub-account 포함)
    const allIds = [a.id, ...a.subAccounts.map(s => s.id)]
    const logs = await prisma.balanceChangeLog.findMany({
      where: { accountId: { in: allIds } },
      orderBy: { changedAt: 'desc' },
      take: limit,
      include: { uploadBatch: { select: { id: true, source: true, fileName: true, createdAt: true } } },
    })
    if (logs.length > 0) {
      console.log(`   📊 BalanceChangeLog (최근 ${logs.length}건, 자식 포함):`)
      logs.forEach(l => {
        const isSub = l.accountId !== a.id
        const subName = isSub ? a.subAccounts.find(s => s.id === l.accountId)?.name ?? '?' : '본체'
        const delta = l.delta > 0 ? `+${l.delta.toLocaleString()}` : l.delta.toLocaleString()
        const batch = l.uploadBatch ? `${l.uploadBatch.source} ${l.uploadBatch.fileName ?? ''}` : 'manual'
        console.log(`      [${l.changedAt.toISOString().slice(0, 16).replace('T', ' ')}] ${subName}: ${l.oldBalance.toLocaleString()} → ${l.newBalance.toLocaleString()} (Δ${delta}) · ${batch}`)
      })
    }
  }

  // ExcelMapping 조회
  const mappings = await prisma.excelMapping.findMany({
    where: { excelName: { contains: query, mode: 'insensitive' } },
  })
  if (mappings.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔗 ExcelMapping (excelName 매치)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    mappings.forEach(m => {
      console.log(`   "${m.excelName}" → ${m.mappingType} (targetAccountId=${m.targetAccountId ?? '-'})`)
    })
  }

  console.log('\n✅ done\n')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

/**
 * 종목명으로 검색해서 holding이 어느 account에 있는지 + owner 확인.
 *
 * 사용:
 *   npx tsx scripts/audit-holding.ts "삼성신종종류형MMF"
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const [, , query] = process.argv
  if (!query) {
    console.error('사용: npx tsx scripts/audit-holding.ts "종목명"')
    process.exit(1)
  }

  const holdings = await prisma.investmentHolding.findMany({
    where: { name: { contains: query, mode: 'insensitive' } },
    include: {
      account: {
        select: {
          id: true, name: true, type: true,
          family: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  })

  console.log(`\n🔍 "${query}" — ${holdings.length}건\n`)
  holdings.forEach(h => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📁 ${h.name} (${h.ticker ?? '-'}, ${h.quantity}주)`)
    console.log(`   holdingId: ${h.id}`)
    console.log(`   avgPrice: ${h.avgPrice.toLocaleString()} · currentPrice: ${h.currentPrice?.toLocaleString() ?? '-'} · currency: ${h.currency}`)
    console.log(`   account: ${h.account.name} (${h.account.type}, id=${h.account.id})`)
    console.log(`   owner: ${h.account.user?.name ?? '-'} <${h.account.user?.email ?? '-'}>`)
    console.log(`   family: ${h.account.family?.name ?? '-'}`)
  })

  console.log('\n✅ done\n')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

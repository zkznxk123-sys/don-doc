/**
 * 가족의 모든 PENSION 계좌 + owner + holdings 한 줄 요약.
 * rename 작업을 위한 현황 표.
 *
 * 사용: npx tsx scripts/list-pension-accounts.ts <email>
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const [, , email] = process.argv
  if (!email) { console.error('사용: npx tsx scripts/list-pension-accounts.ts <email>'); process.exit(1) }

  const user = await prisma.user.findFirst({ where: { email } })
  if (!user?.familyId) { console.error('❌ user/familyId 없음'); process.exit(1) }

  const accounts = await prisma.account.findMany({
    where: { familyId: user.familyId, type: 'PENSION' },
    include: {
      holdings: { select: { name: true, ticker: true, quantity: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { name: 'asc' },
  })

  console.log(`\n📁 PENSION 계좌 ${accounts.length}건 (family=${user.familyId})\n`)
  accounts.forEach(a => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📁 ${a.name}`)
    console.log(`   id: ${a.id}`)
    console.log(`   balance: ${a.balance.toLocaleString()}`)
    console.log(`   owner: ${a.user?.name ?? '-'} <${a.user?.email ?? '-'}>`)
    console.log(`   isShared: ${a.isShared} · shareLevel: ${a.shareLevel}`)
    a.holdings.forEach(h => console.log(`      ↳ ${h.name} ${h.ticker ?? ''} ${h.quantity}주`))
  })

  console.log('\n✅ done\n')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

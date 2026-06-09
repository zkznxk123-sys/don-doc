/**
 * /api/demo/data가 노출하는 모든 텍스트 필드를 dump.
 * 사용자가 직접 훑어보고 실명·실금액·민감 정보 있으면 시드 교체.
 *
 * 실행: tsx scripts/audit-demo-data.ts
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const demoEmail = process.env.DEMO_CFO_EMAIL
  if (!demoEmail) {
    console.error('❌ DEMO_CFO_EMAIL 미설정 (.env.local 확인)')
    process.exit(1)
  }

  console.log(`\n🔍 demo email: ${demoEmail}\n`)

  const user = await prisma.user.findFirst({ where: { email: demoEmail } })
  if (!user?.familyId) {
    console.error('❌ demo user 또는 familyId 없음')
    process.exit(1)
  }

  const familyId = user.familyId

  const [accounts, transactions, scenarios, feedPosts, members] = await Promise.all([
    prisma.account.findMany({ where: { familyId }, include: { holdings: true } }),
    prisma.transaction.findMany({
      where: { user: { familyId }, visibility: 'SHARED' },
      include: { user: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    }),
    prisma.scenario.findMany({
      where: { familyId, status: { in: ['active', 'interested'] } },
      include: { chatMessages: { take: 20 } },
      take: 10,
    }),
    prisma.familyPost.findMany({
      where: { familyId },
      include: { author: { select: { name: true } }, comments: { include: { author: { select: { name: true } } } } },
      take: 20,
    }),
    prisma.user.findMany({ where: { familyId }, select: { id: true, name: true, email: true, role: true } }),
  ])

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👥 가족 멤버')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  members.forEach(m => console.log(`  - ${m.name} (${m.role}) <${m.email}>`))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`💰 계좌 ${accounts.length}건 — 이름 + balance`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  accounts.forEach(a => {
    console.log(`  - ${a.name} (${a.type}): ${a.balance.toLocaleString()}`)
    a.holdings.forEach(h => console.log(`      ↳ ${h.name} ${h.ticker ?? ''} ${h.quantity}주`))
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`💸 거래 ${transactions.length}건 (최근 100건, SHARED)`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  transactions.forEach(t => {
    const sign = t.amount > 0 ? '+' : ''
    console.log(`  [${t.date.toISOString().slice(0, 10)}] ${sign}${t.amount.toLocaleString()} · ${t.category ?? '-'} · ${t.description} (by ${t.user.name})`)
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`💭 시나리오 ${scenarios.length}건 — title + rationale + chat`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  scenarios.forEach(sc => {
    console.log(`  ▸ ${sc.title}`)
    console.log(`    rationale: ${sc.rationale}`)
    sc.chatMessages.forEach(m => console.log(`      ${m.role}: ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`))
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📰 피드 ${feedPosts.length}건 — author + content + comments`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  feedPosts.forEach(p => {
    console.log(`  ▸ [${p.author.name}] ${p.content.slice(0, 150)}${p.content.length > 150 ? '...' : ''}`)
    p.comments.forEach(c => console.log(`      💬 ${c.author.name}: ${c.content.slice(0, 100)}`))
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ dump 완료. 실명·실숫자·민감 정보 검토 후:')
  console.log('   - 깨끗 → vault/_log.md에 "demo 데이터 점검 완료" 명시')
  console.log('   - 실명 있음 → 해당 row만 fixture 데이터로 update')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

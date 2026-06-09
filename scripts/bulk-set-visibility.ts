/**
 * 본인 가족의 모든 Transaction visibility를 일괄 변경.
 *
 * 사용:
 *   npx tsx scripts/bulk-set-visibility.ts <email> SHARED         # dry-run (변경 건수만 보고)
 *   npx tsx scripts/bulk-set-visibility.ts <email> SHARED --apply # 실제 변경
 *
 * 안전 가드:
 *   - email로 user → familyId 해석. demo 가족(DEMO_CFO_EMAIL)은 거부.
 *   - dry-run 기본. --apply 명시해야 변경.
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const [, , email, target, ...flags] = process.argv
  if (!email || !target || (target !== 'SHARED' && target !== 'PRIVATE')) {
    console.error('사용: npx tsx scripts/bulk-set-visibility.ts <email> {SHARED|PRIVATE} [--apply]')
    process.exit(1)
  }
  const apply = flags.includes('--apply')

  const demoEmail = process.env.DEMO_CFO_EMAIL
  if (email === demoEmail) {
    console.error(`❌ demo 가족(${demoEmail})은 변경 불가. demo fixture 보호.`)
    process.exit(1)
  }

  const user = await prisma.user.findFirst({ where: { email } })
  if (!user?.familyId) {
    console.error(`❌ user 또는 familyId 없음: ${email}`)
    process.exit(1)
  }

  const familyId = user.familyId
  console.log(`\n🔍 email: ${email}`)
  console.log(`   familyId: ${familyId}\n`)

  // 변경 대상 = familyId 소속 + 현재 visibility != target
  const targets = await prisma.transaction.findMany({
    where: {
      user: { familyId },
      visibility: { not: target },
    },
    select: { id: true, visibility: true, date: true, amount: true, description: true },
    orderBy: { date: 'desc' },
  })

  console.log(`📊 변경 대상: ${targets.length}건 (current != ${target})`)
  console.log(`   ${target === 'SHARED' ? '비공개 → 공유' : '공유 → 비공개'}\n`)

  if (targets.length === 0) {
    console.log('✅ 이미 모두 target 상태. 변경 없음.\n')
    await prisma.$disconnect()
    return
  }

  // 샘플 10건
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('샘플 (최근 10건)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  targets.slice(0, 10).forEach(t => {
    console.log(`  [${t.date.toISOString().slice(0, 10)}] ${t.visibility} → ${target} · ${t.amount.toLocaleString()} · ${t.description}`)
  })
  if (targets.length > 10) {
    console.log(`  ... 외 ${targets.length - 10}건`)
  }

  if (!apply) {
    console.log('\n💡 dry-run 상태. 실제 변경하려면 --apply 추가:')
    console.log(`   npx tsx scripts/bulk-set-visibility.ts ${email} ${target} --apply\n`)
    await prisma.$disconnect()
    return
  }

  // 실제 변경
  const result = await prisma.transaction.updateMany({
    where: {
      user: { familyId },
      visibility: { not: target },
    },
    data: { visibility: target },
  })

  console.log(`\n✅ ${result.count}건 visibility = ${target}으로 변경 완료\n`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

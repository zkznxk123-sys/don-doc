/**
 * PENSION 계좌 7개 일괄 rename — 명명 규칙: `유형_상품 (소유자, 운용사)`.
 *
 * 1회용 스크립트. ID 하드코딩으로 정확한 계좌만 변경. 다른 계좌·family 영향 없음.
 *
 * 사용:
 *   npx tsx scripts/rename-pension-accounts.ts        # dry-run
 *   npx tsx scripts/rename-pension-accounts.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

const RENAMES: { id: string; from: string; to: string }[] = [
  { id: 'cmnltpl9y000c6nk1lapoecah', from: '국민연금 (안혜빈)',          to: '국민연금 (안혜빈)' },
  { id: 'cmnlto4e000096nk1ff0oyeo8', from: '국민연금 (한상빈)',          to: '국민연금 (한상빈)' },
  { id: 'cmnluavef000o6nk1wn6ejk9u', from: '연금저축펀드 (한상빈)',      to: '개인연금_연저펀 (한상빈, 미래)' },
  { id: 'cmnoorc0q000i13piu8lsw9j4', from: '연금저축펀드-키움 (안혜빈)', to: '개인연금_연저펀 (안혜빈, 키움)' },
  { id: 'cmnbhrhlp00789bmttevxngza', from: '퇴직_DC (한상빈)',           to: '퇴직연금_DC (한상빈, 미래)' },
  { id: 'cmnbsa4pi00otrjh0u9uf2rc0', from: '퇴직_개인형IRP (안혜빈)',    to: '퇴직연금_IRP (안혜빈, 삼성)' },
  { id: 'cmnbhrhof007a9bmt6zwy9xp1', from: '퇴직_개인형IRP (한상빈)',    to: '퇴직연금_IRP (한상빈, 미래)' },
]

async function main() {
  const apply = process.argv.includes('--apply')

  // 1. 검증 — 모든 id 존재 + 현재 이름 확인
  const accounts = await prisma.account.findMany({
    where: { id: { in: RENAMES.map(r => r.id) } },
    select: { id: true, name: true },
  })
  const accountMap = new Map(accounts.map(a => [a.id, a.name]))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Rename 계획')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  let blockers = 0
  for (const r of RENAMES) {
    const current = accountMap.get(r.id)
    if (!current) {
      console.error(`❌ id 없음: ${r.id} (${r.to})`)
      blockers++
      continue
    }
    if (current === r.to) {
      console.log(`  [SKIP] ${r.id}: 이미 "${r.to}"`)
      continue
    }
    console.log(`  ${current} → ${r.to}  (id=${r.id})`)
  }
  if (blockers > 0) {
    console.error(`\n❌ 차단 ${blockers}건. ID 확인 후 재시도.`)
    process.exit(1)
  }

  if (!apply) {
    console.log('\n💡 dry-run. 실제 변경하려면 --apply 추가.\n')
    await prisma.$disconnect()
    return
  }

  // 2. 트랜잭션 — 모두 성공하거나 모두 롤백
  await prisma.$transaction(
    RENAMES
      .filter(r => accountMap.get(r.id) !== r.to)
      .map(r => prisma.account.update({ where: { id: r.id }, data: { name: r.to } }))
  )

  console.log(`\n✅ rename 완료 (${RENAMES.length}건 중 변경 필요한 것만).\n`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

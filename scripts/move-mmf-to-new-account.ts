/**
 * 일회성: '삼성신종종류형MMF제4호-CP' holding을 신규 계좌로 이동.
 *
 * 현재: 연금저축펀드-회사 (안혜빈 owner) 안에 holding으로 들어가 있음.
 * 변경: 신규 '개인연금_연저펀 (안혜빈, 삼성)' 계좌 생성 후 그 안의 holding으로 이동.
 * 부모·신규 계좌 balance는 holdings 합산으로 재계산.
 *
 * 사용:
 *   npx tsx scripts/move-mmf-to-new-account.ts        # dry-run
 *   npx tsx scripts/move-mmf-to-new-account.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

const HOLDING_ID = 'cmnvuzunj000d108nb8xi47rn' // 삼성신종종류형MMF제4호-CP
const NEW_ACCOUNT_NAME = '개인연금_연저펀 (안혜빈, 삼성)'

async function recalcBalance(tx: typeof prisma, accountId: string): Promise<number> {
  const holdings = await tx.investmentHolding.findMany({
    where: { accountId },
    select: { quantity: true, currentPrice: true, avgPrice: true },
  })
  const balance = Math.round(holdings.reduce((s, h) =>
    s + h.quantity * (h.currentPrice ?? h.avgPrice), 0))
  await tx.account.update({ where: { id: accountId }, data: { balance } })
  return balance
}

async function main() {
  const apply = process.argv.includes('--apply')

  const holding = await prisma.investmentHolding.findUnique({
    where: { id: HOLDING_ID },
    include: {
      account: {
        select: { id: true, name: true, type: true, familyId: true, userId: true, isShared: true, shareLevel: true },
      },
    },
  })
  if (!holding) { console.error(`❌ holding 없음: ${HOLDING_ID}`); process.exit(1) }

  const oldAccount = holding.account

  // 신규 계좌 이미 존재 체크
  const existingNew = await prisma.account.findFirst({
    where: { familyId: oldAccount.familyId, name: NEW_ACCOUNT_NAME },
  })

  console.log(`\n🔍 holding: ${holding.name} (${holding.quantity}주, avgPrice=${holding.avgPrice.toLocaleString()})`)
  console.log(`📁 현재 계좌: ${oldAccount.name} (id=${oldAccount.id})`)
  console.log(`📁 신규 계좌: ${NEW_ACCOUNT_NAME} ${existingNew ? `(이미 존재 id=${existingNew.id})` : '(새로 생성 예정)'}`)
  console.log(`👤 owner: 동일 userId=${oldAccount.userId ?? '-'} · familyId=${oldAccount.familyId}\n`)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('실행 계획')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (!existingNew) {
    console.log(`1. 신규 계좌 "${NEW_ACCOUNT_NAME}" 생성 (PENSION, SHARED, owner=${oldAccount.userId ?? '-'})`)
  } else {
    console.log(`1. 신규 계좌 이미 존재 → 그쪽으로 이동`)
  }
  console.log(`2. holding accountId: ${oldAccount.id} → 신규 계좌 id`)
  console.log(`3. 기존 계좌 balance 재계산 (holdings 합산)`)
  console.log(`4. 신규 계좌 balance 재계산 (holdings 합산)`)

  if (!apply) {
    console.log('\n💡 dry-run. 실제 변경하려면 --apply 추가.\n')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async tx => {
    // (1) 신규 계좌 생성 or 재사용
    const newAccountId = existingNew?.id ?? (await tx.account.create({
      data: {
        name: NEW_ACCOUNT_NAME,
        type: 'PENSION',
        balance: 0, // 아래에서 재계산
        familyId: oldAccount.familyId!,
        userId: oldAccount.userId,
        isShared: true,
        shareLevel: 'PUBLIC',
      },
    })).id

    // (2) holding 이동
    await tx.investmentHolding.update({
      where: { id: HOLDING_ID },
      data: { accountId: newAccountId },
    })

    // (3)(4) balance 재계산
    // @ts-expect-error tx는 PrismaClient subset이지만 동일 method signature
    const oldBalance = await recalcBalance(tx, oldAccount.id)
    // @ts-expect-error
    const newBalance = await recalcBalance(tx, newAccountId)

    console.log(`\n✅ 완료`)
    console.log(`   기존 ${oldAccount.name}: balance → ${oldBalance.toLocaleString()}`)
    console.log(`   신규 ${NEW_ACCOUNT_NAME}: balance → ${newBalance.toLocaleString()} (id=${newAccountId})`)
  })

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

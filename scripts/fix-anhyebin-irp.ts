/**
 * 일회성: 신규로 잘못 생성된 '안혜빈_IRP' 계좌 정리.
 *
 * 6/8 엑셀 업로드 시 fuzzy match가 한상빈 IRP만 잡아서 안혜빈 IRP row가
 * '안혜빈_IRP'라는 신규 계좌로 생성됨. 이 계좌의 잔액 3,000,000을 안혜빈
 * 기존 IRP(holdings 보유 증권계좌)의 자식 '예수금' sub-account로 옮기고,
 * 신규 계좌는 삭제. ExcelMapping에 CASH_SUB로 등록해 다음 업로드 자동 분기.
 *
 * 사용:
 *   npx tsx scripts/fix-anhyebin-irp.ts        # dry-run
 *   npx tsx scripts/fix-anhyebin-irp.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

const STALE_ACCOUNT_ID = 'cmq5d384m0005l304m1zur2kq' // 안혜빈_IRP (신규, 잘못 생성됨)
const PARENT_IRP_ID = 'cmnbsa4pi00otrjh0u9uf2rc0'   // 안혜빈 퇴직_개인형IRP (실제)
const EXCEL_NAME = '안혜빈_IRP'

async function main() {
  const apply = process.argv.includes('--apply')

  // 1. 검증
  const stale = await prisma.account.findUnique({
    where: { id: STALE_ACCOUNT_ID },
    include: { holdings: true, subAccounts: true, transactions: { take: 1 } },
  })
  const parent = await prisma.account.findUnique({
    where: { id: PARENT_IRP_ID },
    include: { holdings: true, subAccounts: { where: { name: '예수금' } } },
  })

  if (!stale) {
    console.error('❌ 신규 계좌 없음 (이미 정리됨?)')
    process.exit(1)
  }
  if (!parent) {
    console.error('❌ 부모 IRP 계좌 없음')
    process.exit(1)
  }
  if (stale.familyId !== parent.familyId) {
    console.error('❌ family 불일치 — 작업 거부')
    process.exit(1)
  }
  if (stale.holdings.length > 0 || stale.subAccounts.length > 0 || stale.transactions.length > 0) {
    console.error(`❌ 신규 계좌에 holdings(${stale.holdings.length}) · subAccounts(${stale.subAccounts.length}) · transactions(${stale.transactions.length}) 있음 — 안전 정리 불가`)
    process.exit(1)
  }

  console.log(`\n🔍 신규 계좌: ${stale.name} (id=${stale.id}, balance=${stale.balance.toLocaleString()})`)
  console.log(`📁 부모 IRP: ${parent.name} (id=${parent.id}, balance=${parent.balance.toLocaleString()}, holdings=${parent.holdings.length})`)
  const existingCashSub = parent.subAccounts.find(s => s.name === '예수금')
  console.log(`💰 부모의 기존 예수금 sub: ${existingCashSub ? `${existingCashSub.balance.toLocaleString()} (id=${existingCashSub.id})` : '없음 — 신규 생성 예정'}\n`)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('실행 계획')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (existingCashSub) {
    console.log(`1. 부모의 예수금 sub balance ${existingCashSub.balance.toLocaleString()} → ${(existingCashSub.balance + stale.balance).toLocaleString()} (+${stale.balance.toLocaleString()})`)
  } else {
    console.log(`1. 부모 IRP에 자식 '예수금' sub-account 생성 (balance=${stale.balance.toLocaleString()})`)
  }
  console.log(`2. 신규 계좌 '${stale.name}' 삭제 (BalanceChangeLog cascade)`)
  console.log(`3. ExcelMapping upsert: "${EXCEL_NAME}" → CASH_SUB (targetAccountId=${parent.id})`)

  if (!apply) {
    console.log('\n💡 dry-run. 실제 변경하려면 --apply 추가.\n')
    await prisma.$disconnect()
    return
  }

  // 2. 트랜잭션 실행
  await prisma.$transaction(async tx => {
    // (1) 예수금 sub
    if (existingCashSub) {
      await tx.account.update({
        where: { id: existingCashSub.id },
        data: { balance: existingCashSub.balance + stale.balance },
      })
    } else {
      await tx.account.create({
        data: {
          name: '예수금',
          type: 'CASH',
          balance: stale.balance,
          familyId: parent.familyId,
          userId: parent.userId,
          parentAccountId: parent.id,
          isShared: true,
          shareLevel: 'PUBLIC',
        },
      })
    }
    // (2) 신규 계좌 삭제
    await tx.account.delete({ where: { id: stale.id } })
    // (3) ExcelMapping upsert
    await tx.excelMapping.upsert({
      where: { familyId_excelName: { familyId: parent.familyId, excelName: EXCEL_NAME } },
      create: {
        familyId: parent.familyId,
        excelName: EXCEL_NAME,
        mappingType: 'CASH_SUB',
        targetAccountId: parent.id,
      },
      update: { mappingType: 'CASH_SUB', targetAccountId: parent.id },
    })
  })

  console.log(`\n✅ 완료. 다음 엑셀 업로드부터 "${EXCEL_NAME}"은 자동으로 ${parent.name} 예수금으로 분기됩니다.\n`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

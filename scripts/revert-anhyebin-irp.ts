/**
 * 일회성: 안혜빈_IRP fix 되돌리기.
 *
 * 6/10 fix-anhyebin-irp.ts로 안혜빈 IRP에 예수금 sub(3,000,000)을 만들고
 * ExcelMapping CASH_SUB 등록했으나, 사용자 판단으로 이건 예수금이 아니라
 * 그냥 잘못 들어온 row였음. 되돌리기:
 *
 * 1. 안혜빈 IRP의 자식 예수금 sub-account 삭제
 * 2. ExcelMapping "안혜빈_IRP" → IGNORE로 변경 (다음 업로드 자동 skip)
 *
 * 사용:
 *   npx tsx scripts/revert-anhyebin-irp.ts          # dry-run
 *   npx tsx scripts/revert-anhyebin-irp.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()

const PARENT_IRP_ID = 'cmnbsa4pi00otrjh0u9uf2rc0' // 안혜빈 퇴직_개인형IRP
const EXCEL_NAME = '안혜빈_IRP'

async function main() {
  const apply = process.argv.includes('--apply')

  const parent = await prisma.account.findUnique({
    where: { id: PARENT_IRP_ID },
    include: { subAccounts: { where: { name: '예수금' } } },
  })
  if (!parent) { console.error('❌ 부모 IRP 없음'); process.exit(1) }

  const cashSub = parent.subAccounts.find(s => s.name === '예수금')
  if (!cashSub) {
    console.log('⚠️  예수금 sub 없음 (이미 삭제됐을 수 있음)')
  } else {
    console.log(`💰 삭제 대상: 예수금 sub (id=${cashSub.id}, balance=${cashSub.balance.toLocaleString()})`)
  }

  const mapping = await prisma.excelMapping.findUnique({
    where: { familyId_excelName: { familyId: parent.familyId, excelName: EXCEL_NAME } },
  })
  console.log(`🔗 ExcelMapping: ${mapping ? `${mapping.mappingType}` : '없음'} → IGNORE로 변경`)

  console.log('\n실행 계획:')
  if (cashSub) console.log(`  1. 예수금 sub-account 삭제 (id=${cashSub.id})`)
  console.log(`  2. ExcelMapping upsert "${EXCEL_NAME}" → IGNORE`)

  if (!apply) {
    console.log('\n💡 dry-run. 실제 변경하려면 --apply 추가.\n')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async tx => {
    if (cashSub) {
      await tx.account.delete({ where: { id: cashSub.id } })
    }
    await tx.excelMapping.upsert({
      where: { familyId_excelName: { familyId: parent.familyId, excelName: EXCEL_NAME } },
      create: { familyId: parent.familyId, excelName: EXCEL_NAME, mappingType: 'IGNORE', targetAccountId: null },
      update: { mappingType: 'IGNORE', targetAccountId: null },
    })
  })

  console.log('\n✅ 되돌리기 완료. 다음 엑셀 업로드부터 "안혜빈_IRP" row는 자동 skip됩니다.\n')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

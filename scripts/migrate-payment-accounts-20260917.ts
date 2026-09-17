/**
 * 결제수단 계좌 정리 (2026-09-17): 거래 업로드가 카드·간편결제 이름마다 만든 CASH 계좌를
 * PAYMENT 타입으로 바꾸고, 같은 가족 안의 완전 동명 결제수단 계좌는 하나로 합친다.
 *
 * 실행: NODE_PATH=$PWD/node_modules npx tsx scripts/migrate-payment-accounts-20260917.ts [--apply]
 *   - 기본 dry-run. 선행: `npx prisma db push`(PAYMENT enum 값 추가).
 *   - 대상: type CASH · balance 0 · cashBalance 0 · 종목/하위/연결부채 없음 · classifyPaymentMethod = PAYMENT
 *   - 병합: 소유자(userId) 있는 쪽 > 거래 많은 쪽을 남기고, 나머지의 거래·잔액변경·바인딩을 옮긴 뒤 삭제
 */
import fs from 'node:fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
import { PrismaClient } from '@prisma/client'
import { classifyPaymentMethod } from '../lib/payment-method-calc'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

async function main() {
  console.log(APPLY ? '### APPLY 모드' : '### DRY-RUN (변경 없음) — --apply 로 반영')
  const accounts = await prisma.account.findMany({
    where: { type: 'CASH', balance: 0, cashBalance: 0 },
    select: { id: true, name: true, familyId: true, userId: true, _count: { select: { holdings: true, subAccounts: true, linkedDebts: true, transactions: true } }, family: { select: { name: true } } },
  })
  const targets = accounts.filter(a => classifyPaymentMethod(a.name) === 'PAYMENT' && a._count.holdings === 0 && a._count.subAccounts === 0 && a._count.linkedDebts === 0)
  console.log(`\n## 1) PAYMENT로 전환 ${targets.length}개`)
  for (const a of targets) console.log(`  [${a.family.name}] ${a.name} (tx ${a._count.transactions}, owner ${a.userId ? 'Y' : '-'})`)

  // 동명 병합 (가족 내 같은 이름)
  const groups = new Map<string, typeof targets>()
  for (const a of targets) { const k = `${a.familyId}|${a.name.trim().toLowerCase()}`; groups.set(k, [...(groups.get(k) ?? []), a]) }
  const merges: { keep: typeof targets[number]; drop: typeof targets }[] = []
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const sorted = [...g].sort((x, y) => (y.userId ? 1 : 0) - (x.userId ? 1 : 0) || y._count.transactions - x._count.transactions)
    merges.push({ keep: sorted[0], drop: sorted.slice(1) })
  }
  console.log(`\n## 2) 동명 병합 ${merges.length}건`)
  for (const m of merges) console.log(`  ${m.keep.name}: 유지 ${m.keep.id.slice(-6)}(tx ${m.keep._count.transactions}) ← 흡수 ${m.drop.map(d => `${d.id.slice(-6)}(tx ${d._count.transactions})`).join(', ')}`)

  if (!APPLY) { console.log('\n(dry-run 종료)'); return }
  await prisma.$transaction(async tx => {
    for (const m of merges) {
      for (const d of m.drop) {
        await tx.transaction.updateMany({ where: { accountId: d.id }, data: { accountId: m.keep.id } })
        await tx.balanceChangeLog.updateMany({ where: { accountId: d.id }, data: { accountId: m.keep.id } })
        await tx.excelMapping.updateMany({ where: { targetAccountId: d.id }, data: { targetAccountId: m.keep.id } })
        await tx.account.delete({ where: { id: d.id } })
      }
    }
    const dropped = new Set(merges.flatMap(m => m.drop.map(d => d.id)))
    const ids = targets.filter(a => !dropped.has(a.id)).map(a => a.id)
    await tx.account.updateMany({ where: { id: { in: ids } }, data: { type: 'PAYMENT' } })
  }, { timeout: 60_000 })
  console.log('\n✅ 반영 완료')
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

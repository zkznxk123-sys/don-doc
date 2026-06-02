import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
;(async () => {
  const f = await p.familyGroup.findFirst({ where: { name: 'HaAnn' } })
  if (!f) { console.log('no family'); return }
  const accounts = await p.account.findMany({
    where: { familyId: f.id, parentAccountId: null, type: 'INVESTMENT' },
    include: {
      subAccounts: { select: { id: true, name: true, balance: true, type: true } },
      _count: { select: { holdings: true } },
    },
  })
  for (const a of accounts) {
    console.log(`\n[${a.name}] balance=${a.balance.toLocaleString()} holdings=${a._count.holdings}`)
    for (const s of a.subAccounts) {
      console.log(`  └ ${s.name} (${s.type}) ${s.balance.toLocaleString()}`)
    }
  }
  await p.$disconnect()
})()

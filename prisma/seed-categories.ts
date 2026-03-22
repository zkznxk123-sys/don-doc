/**
 * 시스템 기본 카테고리 시드
 * familyId: null → 모든 가족에게 공통 제공
 *
 * 실행: npx tsx prisma/seed-categories.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SYSTEM_CATEGORIES = [
  // 지출
  { name: '식비',     icon: '🍽️', type: 'EXPENSE' as const },
  { name: '카페',     icon: '☕',  type: 'EXPENSE' as const },
  { name: '교통',     icon: '🚇',  type: 'EXPENSE' as const },
  { name: '쇼핑',     icon: '🛍️', type: 'EXPENSE' as const },
  { name: '의료/건강', icon: '🏥', type: 'EXPENSE' as const },
  { name: '문화/여가', icon: '🎬', type: 'EXPENSE' as const },
  { name: '관리비',   icon: '🏠',  type: 'EXPENSE' as const },
  { name: '교육',     icon: '📚',  type: 'EXPENSE' as const },
  { name: '통신',     icon: '📱',  type: 'EXPENSE' as const },
  { name: '보험',     icon: '🛡️', type: 'EXPENSE' as const },
  { name: '미용',     icon: '💇',  type: 'EXPENSE' as const },
  { name: '경조사',   icon: '🎁',  type: 'EXPENSE' as const },
  { name: '기타',     icon: '📋',  type: 'EXPENSE' as const },
  // 수입
  { name: '급여',     icon: '💰',  type: 'INCOME' as const },
  { name: '부업',     icon: '📦',  type: 'INCOME' as const },
  { name: '투자수익', icon: '📈',  type: 'INCOME' as const },
  { name: '용돈/이체', icon: '💸', type: 'INCOME' as const },
  { name: '기타수입', icon: '🪙',  type: 'INCOME' as const },
]

async function main() {
  console.log('\n🌱 시스템 기본 카테고리 시드 시작\n')

  let created = 0
  let skipped = 0

  for (const cat of SYSTEM_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { name: cat.name, familyId: null },
    })
    if (existing) {
      skipped++
    } else {
      await prisma.category.create({
        data: { name: cat.name, icon: cat.icon, type: cat.type, familyId: null },
      })
      created++
    }
  }

  console.log(`✅ 완료 — 생성: ${created}개, 스킵(이미 존재): ${skipped}개`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

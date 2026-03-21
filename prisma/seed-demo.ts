/**
 * 데모 계정 시드 스크립트
 *
 * 사전 준비:
 *   1. Supabase 대시보드 → Authentication → Users 에서 아래 계정을 직접 생성하세요:
 *      Email:    process.env.DEMO_EMAIL   (기본: demo@dondoc.app)
 *      Password: process.env.DEMO_PASSWORD (기본: demo1234!!)
 *   2. .env 에 DEMO_EMAIL / DEMO_PASSWORD 를 설정하세요.
 *
 * 실행:
 *   npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_EMAIL    = process.env.DEMO_EMAIL    ?? 'demo@dondoc.app'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234!!'

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function monthsAgo(n: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function yearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 데모 시드 시작  (${DEMO_EMAIL})\n`)

  // 1. 유저 및 가족 upsert ───────────────────────────────────────────────────

  let family = await prisma.familyGroup.findFirst({
    where: { name: '데모 패밀리 오피스' },
  })

  if (!family) {
    family = await prisma.familyGroup.create({
      data: { name: '데모 패밀리 오피스' },
    })
    console.log('✅ 가족 그룹 생성')
  } else {
    console.log('ℹ️  기존 가족 그룹 재사용')
  }

  let user = await prisma.user.findFirst({ where: { email: DEMO_EMAIL } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        name: '데모 유저',
        role: 'CFO',
        familyId: family.id,
      },
    })
    console.log('✅ 데모 유저 생성')
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'CFO', familyId: family.id },
    })
    console.log('ℹ️  기존 유저 업데이트')
  }

  // 기존 계좌/트랜잭션/스냅샷 초기화 ─────────────────────────────────────────
  await prisma.netWorthSnapshot.deleteMany({ where: { familyId: family.id } })
  await prisma.transaction.deleteMany({ where: { userId: user.id } })
  await prisma.account.deleteMany({ where: { familyId: family.id } })
  console.log('🗑️  기존 데모 데이터 삭제 완료')

  // 2. 카테고리 ─────────────────────────────────────────────────────────────

  const catDefs = [
    { name: '월급',    icon: '💰', type: 'INCOME'  as const },
    { name: '부업',    icon: '📦', type: 'INCOME'  as const },
    { name: '식비',    icon: '🍽️', type: 'EXPENSE' as const },
    { name: '교통',    icon: '🚇', type: 'EXPENSE' as const },
    { name: '쇼핑',    icon: '🛍️', type: 'EXPENSE' as const },
    { name: '의료',    icon: '🏥', type: 'EXPENSE' as const },
    { name: '문화',    icon: '🎬', type: 'EXPENSE' as const },
    { name: '관리비',  icon: '🏠', type: 'EXPENSE' as const },
  ]

  const categories: Record<string, string> = {}
  for (const c of catDefs) {
    const existing = await prisma.category.findFirst({
      where: { name: c.name, familyId: family.id },
    })
    const cat = existing ?? await prisma.category.create({
      data: { name: c.name, icon: c.icon, type: c.type, familyId: family.id },
    })
    categories[c.name] = cat.id
  }
  console.log('✅ 카테고리 준비 완료')

  // 3. 자산 계좌 ─────────────────────────────────────────────────────────────

  // 3-1. 아파트
  const apartment = await prisma.account.create({
    data: {
      name: '래미안 위브 아파트',
      type: 'REAL_ESTATE',
      balance: 1_500_000_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      realEstateDetail: {
        create: {
          propertyType: '아파트',
          purchasePrice: 1_200_000_000,
          purchaseDate: new Date('2021-03-15'),
          currentPrice: 1_500_000_000,
          targetPrice: 1_700_000_000,
        },
      },
    },
  })

  // 3-2. 주담대 (아파트 연결)
  await prisma.account.create({
    data: {
      name: '주택담보대출',
      type: 'DEBT',
      balance: 300_000_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      linkedAssetId: apartment.id,
      debtDetail: {
        create: {
          debtType: 'MORTGAGE',
          interestRate: 3.8,
          repaymentType: 'EQUAL_PRINCIPAL_INTEREST',
          monthlyPayment: 1_550_000,
          maturityDate: new Date('2051-04-01'),
        },
      },
    },
  })

  // 3-3. 주식
  const stocks = await prisma.account.create({
    data: {
      name: '주식 포트폴리오',
      type: 'INVESTMENT',
      balance: 50_000_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      financialAssetDetail: {
        create: {
          interestRate: 12.4,
        },
      },
    },
  })

  // 3-4. 예적금
  const savings = await prisma.account.create({
    data: {
      name: '적금 통장',
      type: 'CASH',
      balance: 30_000_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      financialAssetDetail: {
        create: {
          interestRate: 3.5,
          monthlyPayment: 500_000,
          maturityDate: new Date('2026-12-01'),
        },
      },
    },
  })

  // 3-5. 생활비 통장 (트랜잭션 기록용)
  const checking = await prisma.account.create({
    data: {
      name: '생활비 통장',
      type: 'CASH',
      balance: 5_000_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
    },
  })

  console.log('✅ 자산/부채 계좌 생성 완료')

  // 4. 거래 내역 (6개월, ~50건) ──────────────────────────────────────────────

  const txData: {
    amount: number
    date: Date
    description: string
    category: string
    categoryId: string
    userId: string
    accountId: string
  }[] = []

  // 월급 (6개월)
  for (let m = 5; m >= 0; m--) {
    const d = monthsAgo(m)
    d.setDate(25)
    txData.push({
      amount: rand(5_800_000, 6_200_000),
      date: d,
      description: '급여 입금',
      category: '월급',
      categoryId: categories['월급'],
      userId: user.id,
      accountId: checking.id,
    })
  }

  // 부업 수입 (격월)
  for (let m = 5; m >= 0; m -= 2) {
    const d = monthsAgo(m)
    d.setDate(rand(5, 15))
    txData.push({
      amount: rand(300_000, 800_000),
      date: d,
      description: '프리랜서 수입',
      category: '부업',
      categoryId: categories['부업'],
      userId: user.id,
      accountId: checking.id,
    })
  }

  // 고정 지출 — 관리비 (6개월)
  for (let m = 5; m >= 0; m--) {
    const d = monthsAgo(m)
    d.setDate(10)
    txData.push({
      amount: -rand(180_000, 250_000),
      date: d,
      description: '아파트 관리비',
      category: '관리비',
      categoryId: categories['관리비'],
      userId: user.id,
      accountId: checking.id,
    })
  }

  // 주담대 상환 (6개월)
  for (let m = 5; m >= 0; m--) {
    const d = monthsAgo(m)
    d.setDate(15)
    txData.push({
      amount: -1_550_000,
      date: d,
      description: '주택담보대출 상환',
      category: '관리비',
      categoryId: categories['관리비'],
      userId: user.id,
      accountId: checking.id,
    })
  }

  // 식비 (월 3~5건)
  const foodDescs = ['마트 장보기', '외식 — 저녁', '카페 방문', '배달 음식', '점심 식사']
  for (let m = 5; m >= 0; m--) {
    const count = rand(3, 5)
    for (let k = 0; k < count; k++) {
      const d = monthsAgo(m)
      d.setDate(rand(1, 28))
      txData.push({
        amount: -rand(15_000, 120_000),
        date: d,
        description: foodDescs[rand(0, foodDescs.length - 1)],
        category: '식비',
        categoryId: categories['식비'],
        userId: user.id,
        accountId: checking.id,
      })
    }
  }

  // 교통 (월 2~3건)
  const transportDescs = ['지하철 교통카드', 'KTX 기차표', '주유비', '택시']
  for (let m = 5; m >= 0; m--) {
    const count = rand(2, 3)
    for (let k = 0; k < count; k++) {
      const d = monthsAgo(m)
      d.setDate(rand(1, 28))
      txData.push({
        amount: -rand(5_000, 80_000),
        date: d,
        description: transportDescs[rand(0, transportDescs.length - 1)],
        category: '교통',
        categoryId: categories['교통'],
        userId: user.id,
        accountId: checking.id,
      })
    }
  }

  // 쇼핑 (월 1~2건)
  const shoppingDescs = ['쿠팡 주문', '의류 구입', '올리브영', '가전제품']
  for (let m = 5; m >= 0; m--) {
    const count = rand(1, 2)
    for (let k = 0; k < count; k++) {
      const d = monthsAgo(m)
      d.setDate(rand(1, 28))
      txData.push({
        amount: -rand(20_000, 350_000),
        date: d,
        description: shoppingDescs[rand(0, shoppingDescs.length - 1)],
        category: '쇼핑',
        categoryId: categories['쇼핑'],
        userId: user.id,
        accountId: checking.id,
      })
    }
  }

  // 의료 (격월)
  for (let m = 4; m >= 0; m -= 2) {
    const d = monthsAgo(m)
    d.setDate(rand(5, 20))
    txData.push({
      amount: -rand(15_000, 80_000),
      date: d,
      description: '병원 진료비',
      category: '의료',
      categoryId: categories['의료'],
      userId: user.id,
      accountId: checking.id,
    })
  }

  // 적금 납입 (6개월)
  for (let m = 5; m >= 0; m--) {
    const d = monthsAgo(m)
    d.setDate(5)
    txData.push({
      amount: -500_000,
      date: d,
      description: '적금 납입',
      category: '관리비',
      categoryId: categories['관리비'],
      userId: user.id,
      accountId: savings.id,
    })
  }

  // 주식 매수 (3개월에 한 번)
  for (let m = 5; m >= 0; m -= 3) {
    const d = monthsAgo(m)
    d.setDate(rand(10, 20))
    txData.push({
      amount: -rand(500_000, 2_000_000),
      date: d,
      description: '국내 주식 매수',
      category: '쇼핑',
      categoryId: categories['쇼핑'],
      userId: user.id,
      accountId: stocks.id,
    })
  }

  // 날짜 기준 정렬 후 일괄 삽입
  txData.sort((a, b) => a.date.getTime() - b.date.getTime())
  await prisma.transaction.createMany({ data: txData })
  console.log(`✅ 거래 내역 ${txData.length}건 생성`)

  // 5. 순자산 스냅샷 (12개월) ────────────────────────────────────────────────
  //
  //  [스토리]
  //  - 1년 전: 부동산 취득 직후 담보대출 부담으로 순자산 낮음
  //  - 4~5개월 전: 주식 조정으로 총자산 일시 하락 (리얼리티)
  //  - 이후: 부동산 시세 급등 + 주식 반등 + 대출 상환으로 순자산 가파르게 가속
  //
  //  총자산:  8.5억 → 16.85억  (+98%)
  //  순자산:  2.8억 → 12.8억   (+357%) — 차트에서 극적인 우상향 곡선
  //
  const snapshots = [
    { totalAssets:   850_000_000, totalLiabilities: 570_000_000 }, // -11개월: 순자산  2.8억
    { totalAssets:   920_000_000, totalLiabilities: 558_000_000 }, // -10개월: 순자산  3.62억
    { totalAssets: 1_050_000_000, totalLiabilities: 544_000_000 }, // -9개월:  순자산  5.06억  ← 부동산 시세 반영
    { totalAssets: 1_180_000_000, totalLiabilities: 528_000_000 }, // -8개월:  순자산  6.52억
    { totalAssets: 1_310_000_000, totalLiabilities: 510_000_000 }, // -7개월:  순자산  8.0억   ← 주식 급등
    { totalAssets: 1_220_000_000, totalLiabilities: 496_000_000 }, // -6개월:  순자산  7.24억  ← 주식 조정 (일시 하락)
    { totalAssets: 1_360_000_000, totalLiabilities: 480_000_000 }, // -5개월:  순자산  8.8억   ← 반등
    { totalAssets: 1_490_000_000, totalLiabilities: 460_000_000 }, // -4개월:  순자산 10.3억   ← 아파트 호가 상승
    { totalAssets: 1_560_000_000, totalLiabilities: 438_000_000 }, // -3개월:  순자산 12.22억
    { totalAssets: 1_620_000_000, totalLiabilities: 380_000_000 }, // -2개월:  순자산 12.4억   ← 대출 일부 상환
    { totalAssets: 1_660_000_000, totalLiabilities: 345_000_000 }, // -1개월:  순자산 13.15억
    { totalAssets: 1_685_000_000, totalLiabilities: 305_000_000 }, // 이번달:  순자산 13.8억
  ]

  for (let i = 0; i < snapshots.length; i++) {
    const date = monthsAgo(snapshots.length - 1 - i)
    const ym = yearMonth(date)
    const { totalAssets, totalLiabilities } = snapshots[i]
    await prisma.netWorthSnapshot.upsert({
      where: { familyId_yearMonth: { familyId: family.id, yearMonth: ym } },
      update: { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities },
      create: {
        familyId: family.id,
        yearMonth: ym,
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
      },
    })
  }
  console.log(`✅ 순자산 스냅샷 ${snapshots.length}개월 생성`)

  console.log('\n🎉 데모 시드 완료!')
  console.log(`   이메일:    ${DEMO_EMAIL}`)
  console.log(`   비밀번호:  ${DEMO_PASSWORD}`)
  console.log('\n   ⚠️  Supabase 대시보드에서 위 계정이 생성되어 있어야 데모 로그인이 동작합니다.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

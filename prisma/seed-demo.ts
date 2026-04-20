/**
 * 돈독 (don-doc) — 경진대회 데모 시드
 *
 * 사전 준비:
 *   1. Clerk 대시보드에서 두 계정 생성 후 User ID(user_xxx) 복사
 *   2. .env 에 아래 값 설정:
 *        DEMO_CFO_EMAIL=demo-cfo@dondoc.app
 *        DEMO_CFO_CLERK_ID=user_xxxxxxxxxxxxxxxxxxxx   ← CFO Clerk ID
 *        DEMO_MEMBER_EMAIL=demo-member@dondoc.app
 *        DEMO_MEMBER_CLERK_ID=user_yyyyyyyyyyyyyyyyyyyy ← MEMBER Clerk ID
 *
 * 실행:
 *   npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CFO_EMAIL      = process.env.DEMO_CFO_EMAIL      ?? 'demo-cfo@dondoc.app'
const CFO_CLERK_ID   = process.env.DEMO_CFO_CLERK_ID   ?? ''
const MEMBER_EMAIL   = process.env.DEMO_MEMBER_EMAIL   ?? 'demo-member@dondoc.app'
const MEMBER_CLERK_ID = process.env.DEMO_MEMBER_CLERK_ID ?? ''

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function daysAgo(n: number, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

function monthsAgo(n: number, day = 1): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(day)
  d.setHours(9, 0, 0, 0)
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
  console.log('\n🌱 돈독 경진대회 데모 시드 시작\n')

  // ══════════════════════════════════════════════════════════════════
  // 1. 가족 그룹 + 두 멤버
  // ══════════════════════════════════════════════════════════════════

  let family = await prisma.familyGroup.findFirst({ where: { name: '김민준 패밀리 오피스' } })
  if (!family) {
    family = await prisma.familyGroup.create({ data: { name: '김민준 패밀리 오피스' } })
  }

  // CFO — 김민준
  let cfo = await prisma.user.findFirst({ where: { email: CFO_EMAIL } })
  if (!cfo) {
    cfo = await prisma.user.create({
      data: { email: CFO_EMAIL, name: '김민준', role: 'CFO', familyId: family.id,
              ...(CFO_CLERK_ID ? { clerkId: CFO_CLERK_ID } : {}) },
    })
  } else {
    cfo = await prisma.user.update({
      where: { id: cfo.id },
      data: { name: '김민준', role: 'CFO', familyId: family.id,
              ...(CFO_CLERK_ID ? { clerkId: CFO_CLERK_ID } : {}) },
    })
  }

  // MEMBER — 박지수 (배우자)
  let member = await prisma.user.findFirst({ where: { email: MEMBER_EMAIL } })
  if (!member) {
    member = await prisma.user.create({
      data: { email: MEMBER_EMAIL, name: '박지수', role: 'MEMBER', familyId: family.id,
              ...(MEMBER_CLERK_ID ? { clerkId: MEMBER_CLERK_ID } : {}) },
    })
  } else {
    member = await prisma.user.update({
      where: { id: member.id },
      data: { name: '박지수', role: 'MEMBER', familyId: family.id,
              ...(MEMBER_CLERK_ID ? { clerkId: MEMBER_CLERK_ID } : {}) },
    })
  }
  console.log(`✅ 가족 구성원: ${cfo.name}(CFO), ${member.name}(MEMBER)`)

  // ══════════════════════════════════════════════════════════════════
  // 2. 기존 데모 데이터 초기화
  // ══════════════════════════════════════════════════════════════════

  const userIds = [cfo.id, member.id]
  await prisma.familyPost.deleteMany({ where: { familyId: family.id } })
  await prisma.scenario.deleteMany({ where: { familyId: family.id } })
  await prisma.budget.deleteMany({ where: { familyId: family.id } })
  await prisma.netWorthSnapshot.deleteMany({ where: { familyId: family.id } })
  await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.account.deleteMany({ where: { familyId: family.id } })
  await prisma.monthlyGoal.deleteMany({ where: { familyId: family.id } })
  console.log('🗑️  기존 데모 데이터 초기화 완료')

  // ══════════════════════════════════════════════════════════════════
  // 3. 카테고리 (시스템 기본 사용)
  // ══════════════════════════════════════════════════════════════════

  const systemCats = await prisma.category.findMany({ where: { familyId: null } })
  const catMap: Record<string, string> = {}
  for (const c of systemCats) catMap[c.name] = c.id

  // 가족 커스텀 카테고리 추가
  const customCats = [
    { name: '주담대 상환', icon: '🏦', type: 'EXPENSE' as const },
    { name: '투자', icon: '📈', type: 'EXPENSE' as const },
    { name: '용돈', icon: '💝', type: 'EXPENSE' as const },
  ]
  for (const c of customCats) {
    const existing = await prisma.category.findFirst({ where: { name: c.name, familyId: family.id } })
    const cat = existing ?? await prisma.category.create({
      data: { name: c.name, icon: c.icon, type: c.type, familyId: family.id },
    })
    catMap[c.name] = cat.id
  }
  console.log('✅ 카테고리 준비 완료')

  // ══════════════════════════════════════════════════════════════════
  // 4. 자산/부채 계좌
  // ══════════════════════════════════════════════════════════════════

  // ─ 4-1. 아파트 (마포구 래미안)
  const apartment = await prisma.account.create({
    data: {
      name: '마포 래미안 84㎡',
      type: 'REAL_ESTATE',
      balance: 1_450_000_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      realEstateDetail: {
        create: {
          propertyType: '아파트',
          complexName: '래미안 마포 리버웰',
          area: 84.3,
          floor: 12,
          purchasePrice: 1_050_000_000,
          purchaseDate: new Date('2020-09-10'),
          currentPrice: 1_450_000_000,
          targetPrice: 1_600_000_000,
        },
      },
    },
  })

  // ─ 4-2. 주담대
  await prisma.account.create({
    data: {
      name: '주택담보대출 (KB국민)',
      type: 'DEBT',
      balance: -280_000_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      linkedAssetId: apartment.id,
      debtDetail: {
        create: {
          debtType: 'MORTGAGE',
          interestRate: 3.65,
          repaymentType: 'EQUAL_PRINCIPAL_INTEREST',
          monthlyPayment: 1_500_000,
          maturityDate: new Date('2050-09-01'),
        },
      },
    },
  })

  // ─ 4-3. 국내주식 포트폴리오
  const krStocks = await prisma.account.create({
    data: {
      name: '국내 주식 (MTS)',
      type: 'INVESTMENT',
      balance: 38_400_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      financialAssetDetail: { create: { interestRate: 11.2 } },
    },
  })

  await prisma.investmentHolding.createMany({
    data: [
      { accountId: krStocks.id, ticker: '005930', market: 'KOSPI', name: '삼성전자',     quantity: 300, avgPrice: 68_000, currentPrice: 74_200, currency: 'KRW' },
      { accountId: krStocks.id, ticker: '000660', market: 'KOSPI', name: 'SK하이닉스',   quantity: 40,  avgPrice: 185_000, currentPrice: 198_000, currency: 'KRW' },
      { accountId: krStocks.id, ticker: '035720', market: 'KOSDAQ', name: '카카오',       quantity: 100, avgPrice: 42_000, currentPrice: 38_500, currency: 'KRW' },
    ],
  })

  // ─ 4-4. 해외주식 포트폴리오
  const usStocks = await prisma.account.create({
    data: {
      name: '해외 주식 (증권사)',
      type: 'INVESTMENT',
      balance: 24_800_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      financialAssetDetail: { create: { interestRate: 28.4 } },
    },
  })

  await prisma.investmentHolding.createMany({
    data: [
      { accountId: usStocks.id, ticker: 'NVDA',  market: 'NASDAQ', name: 'NVIDIA Corp.',  quantity: 12, avgPrice: 420, currentPrice: 870, currency: 'USD' },
      { accountId: usStocks.id, ticker: 'AAPL',  market: 'NASDAQ', name: 'Apple Inc.',     quantity: 20, avgPrice: 170, currentPrice: 198, currency: 'USD' },
      { accountId: usStocks.id, ticker: 'QQQ',   market: 'NASDAQ', name: 'Invesco QQQ',    quantity: 8,  avgPrice: 380, currentPrice: 445, currency: 'USD' },
    ],
  })

  // ─ 4-5. 연금저축
  const pension = await prisma.account.create({
    data: {
      name: '연금저축 (삼성생명)',
      type: 'PENSION',
      balance: 18_500_000,
      shareLevel: 'PUBLIC',
      isShared: false,
      familyId: family.id,
      financialAssetDetail: { create: { interestRate: 5.8, monthlyPayment: 300_000, maturityDate: new Date('2055-01-01') } },
    },
  })

  // ─ 4-6. IRP 계좌
  await prisma.account.create({
    data: {
      name: 'IRP 계좌 (한국투자)',
      type: 'PENSION',
      balance: 9_200_000,
      shareLevel: 'PUBLIC',
      isShared: false,
      familyId: family.id,
      financialAssetDetail: { create: { interestRate: 7.1, monthlyPayment: 200_000 } },
    },
  })

  // ─ 4-7. CMA (비상금)
  const cma = await prisma.account.create({
    data: {
      name: 'CMA 비상금 (토스)',
      type: 'CASH',
      balance: 12_000_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
      financialAssetDetail: { create: { interestRate: 3.2 } },
    },
  })

  // ─ 4-8. 생활비 통장 (거래 내역 연결)
  const checking = await prisma.account.create({
    data: {
      name: '생활비 통장 (국민)',
      type: 'CASH',
      balance: 4_800_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
    },
  })

  // ─ 4-9. 배우자 통장
  const memberChecking = await prisma.account.create({
    data: {
      name: '박지수 급여 통장',
      type: 'CASH',
      balance: 3_200_000,
      shareLevel: 'PUBLIC',
      isShared: true,
      familyId: family.id,
    },
  })

  console.log('✅ 자산/부채 계좌 9개 생성 완료')

  // ══════════════════════════════════════════════════════════════════
  // 5. 거래 내역 (6개월, ~130건)
  // ══════════════════════════════════════════════════════════════════

  type TxInput = {
    amount: number; date: Date; description: string
    category: string; userId: string; accountId: string
    visibility?: 'SHARED' | 'PRIVATE'
  }

  const txs: TxInput[] = []

  // ── 김민준 수입 ──────────────────────────────────────────────────
  for (let m = 5; m >= 0; m--) {
    // 급여 (25일)
    txs.push({ amount: rand(7_200_000, 7_600_000), date: monthsAgo(m, 25),
      description: '급여 입금 — 네이버(주)', category: '급여', userId: cfo.id, accountId: checking.id })
    // 배당금 (3개월에 한 번)
    if (m % 3 === 0) txs.push({ amount: rand(80_000, 150_000), date: monthsAgo(m, 20),
      description: '삼성전자 분기 배당금', category: '투자수익', userId: cfo.id, accountId: krStocks.id })
  }
  // 부업 수입 (격월)
  for (let m = 5; m >= 0; m -= 2) {
    txs.push({ amount: rand(500_000, 1_200_000), date: monthsAgo(m, rand(5, 15)),
      description: '기술 컨설팅 수입', category: '부업', userId: cfo.id, accountId: checking.id })
  }

  // ── 박지수 수입 ──────────────────────────────────────────────────
  for (let m = 5; m >= 0; m--) {
    txs.push({ amount: rand(4_800_000, 5_100_000), date: monthsAgo(m, 24),
      description: '급여 입금 — 삼성물산(주)', category: '급여', userId: member.id, accountId: memberChecking.id })
  }

  // ── 고정 지출 (김민준) ───────────────────────────────────────────
  for (let m = 5; m >= 0; m--) {
    // 주담대 상환
    txs.push({ amount: -1_500_000, date: monthsAgo(m, 15),
      description: '주택담보대출 상환 (원리금)', category: '주담대 상환', userId: cfo.id, accountId: checking.id })
    // 관리비
    txs.push({ amount: -rand(220_000, 280_000), date: monthsAgo(m, 10),
      description: '아파트 관리비', category: '관리비', userId: cfo.id, accountId: checking.id })
    // 연금저축 납입
    txs.push({ amount: -300_000, date: monthsAgo(m, 5),
      description: '연금저축 납입', category: '보험', userId: cfo.id, accountId: checking.id })
    // IRP 납입
    txs.push({ amount: -200_000, date: monthsAgo(m, 6),
      description: 'IRP 납입', category: '보험', userId: cfo.id, accountId: checking.id })
    // 통신비
    txs.push({ amount: -rand(85_000, 95_000), date: monthsAgo(m, 18),
      description: '통신비 (KT 5G)', category: '통신', userId: cfo.id, accountId: checking.id })
  }

  // ── 변동 지출 — 식비/카페 ────────────────────────────────────────
  const foodDescs = ['마트 장보기 (이마트)', '외식 — 한식당', '카페 방문', '배달의민족', '편의점', '회식비', '냉면 전문점']
  const cafeDescs = ['스타벅스', '투썸플레이스', '이디야 커피', '블루보틀']
  for (let m = 5; m >= 0; m--) {
    // 식비 (월 5~7건, 김민준)
    for (let k = 0; k < rand(5, 7); k++) {
      txs.push({ amount: -rand(12_000, 95_000), date: monthsAgo(m, rand(1, 28)),
        description: foodDescs[rand(0, foodDescs.length - 1)], category: '식비', userId: cfo.id, accountId: checking.id })
    }
    // 카페 (월 3~4건)
    for (let k = 0; k < rand(3, 4); k++) {
      txs.push({ amount: -rand(4_500, 12_000), date: monthsAgo(m, rand(1, 28)),
        description: cafeDescs[rand(0, cafeDescs.length - 1)], category: '카페', userId: cfo.id, accountId: checking.id })
    }
    // 식비 (박지수, 월 3~4건)
    for (let k = 0; k < rand(3, 4); k++) {
      txs.push({ amount: -rand(10_000, 60_000), date: monthsAgo(m, rand(1, 28)),
        description: foodDescs[rand(0, foodDescs.length - 1)], category: '식비', userId: member.id, accountId: memberChecking.id })
    }
  }

  // ── 교통 ─────────────────────────────────────────────────────────
  const transportDescs = ['지하철 교통카드 충전', '주유비 (GS칼텍스)', 'KTX 출장', '택시', '고속도로 통행료']
  for (let m = 5; m >= 0; m--) {
    for (let k = 0; k < rand(2, 4); k++) {
      txs.push({ amount: -rand(5_000, 120_000), date: monthsAgo(m, rand(1, 28)),
        description: transportDescs[rand(0, transportDescs.length - 1)], category: '교통', userId: cfo.id, accountId: checking.id })
    }
  }

  // ── 쇼핑 ─────────────────────────────────────────────────────────
  const shoppingDescs = ['쿠팡 주문', '의류 구입 (무신사)', '올리브영', '다이소', '인테리어 소품']
  for (let m = 5; m >= 0; m--) {
    for (let k = 0; k < rand(1, 3); k++) {
      txs.push({ amount: -rand(15_000, 280_000), date: monthsAgo(m, rand(1, 28)),
        description: shoppingDescs[rand(0, shoppingDescs.length - 1)], category: '쇼핑', userId: cfo.id, accountId: checking.id })
    }
    // 박지수 쇼핑 (PRIVATE)
    if (rand(0, 1) === 1) {
      txs.push({ amount: -rand(30_000, 180_000), date: monthsAgo(m, rand(1, 28)),
        description: '의류 쇼핑 (신세계)', category: '쇼핑', userId: member.id, accountId: memberChecking.id,
        visibility: 'PRIVATE' })
    }
  }

  // ── 의료/건강 ─────────────────────────────────────────────────────
  for (let m = 5; m >= 0; m--) {
    if (rand(0, 2) > 0) {
      txs.push({ amount: -rand(15_000, 85_000), date: monthsAgo(m, rand(5, 25)),
        description: ['내과 진료비', '치과 스케일링', '약국 처방약', '헬스장 월회비'][rand(0, 3)],
        category: '의료/건강', userId: rand(0, 1) === 0 ? cfo.id : member.id,
        accountId: rand(0, 1) === 0 ? checking.id : memberChecking.id })
    }
  }

  // ── 문화/여가 ─────────────────────────────────────────────────────
  const cultureDescs = ['CGV 영화 관람', '넷플릭스 구독료', '책 구입', '등산 장비', '여행 항공권', '콘서트 티켓']
  for (let m = 5; m >= 0; m--) {
    if (rand(0, 1) === 1) {
      txs.push({ amount: -rand(10_000, 450_000), date: monthsAgo(m, rand(1, 28)),
        description: cultureDescs[rand(0, cultureDescs.length - 1)], category: '문화/여가', userId: cfo.id, accountId: checking.id })
    }
  }

  // ── 교육 ─────────────────────────────────────────────────────────
  for (let m = 5; m >= 0; m--) {
    if (rand(0, 2) === 0) {
      txs.push({ amount: -rand(50_000, 300_000), date: monthsAgo(m, rand(1, 20)),
        description: ['온라인 강의 수강료', '도서 정기구독', '어학원 수업료'][rand(0, 2)],
        category: '교육', userId: cfo.id, accountId: checking.id })
    }
  }

  // ── 보험 ─────────────────────────────────────────────────────────
  for (let m = 5; m >= 0; m--) {
    txs.push({ amount: -rand(180_000, 220_000), date: monthsAgo(m, 2),
      description: '실손 의료보험 (DB손해)', category: '보험', userId: cfo.id, accountId: checking.id })
  }

  // ── 용돈 (부모님) ─────────────────────────────────────────────────
  for (let m = 5; m >= 0; m--) {
    txs.push({ amount: -200_000, date: monthsAgo(m, 28),
      description: '부모님 용돈', category: '용돈', userId: cfo.id, accountId: checking.id })
  }

  // ── 주식 매수 ─────────────────────────────────────────────────────
  for (let m = 5; m >= 0; m -= 2) {
    txs.push({ amount: -rand(500_000, 1_500_000), date: monthsAgo(m, rand(10, 20)),
      description: '국내 주식 매수 (삼성전자)', category: '투자', userId: cfo.id, accountId: krStocks.id })
    txs.push({ amount: -rand(1_000_000, 2_500_000), date: monthsAgo(m, rand(5, 15)),
      description: '해외 주식 매수 (NVDA)', category: '투자', userId: cfo.id, accountId: usStocks.id })
  }

  // 날짜 정렬 후 삽입
  txs.sort((a, b) => a.date.getTime() - b.date.getTime())
  await prisma.transaction.createMany({
    data: txs.map(t => ({
      amount: t.amount, date: t.date, description: t.description,
      category: t.category, categoryId: catMap[t.category] ?? null,
      userId: t.userId, accountId: t.accountId,
      visibility: t.visibility ?? 'SHARED',
    })),
  })
  console.log(`✅ 거래 내역 ${txs.length}건 생성`)

  // ══════════════════════════════════════════════════════════════════
  // 6. 예산 데이터 (최근 3개월)
  // ══════════════════════════════════════════════════════════════════

  for (let m = 2; m >= 0; m--) {
    const month = yearMonth(monthsAgo(m))
    // 가족 전체 예산
    await prisma.budget.upsert({
      where: { id: `demo-family-budget-${month}` },
      create: { id: `demo-family-budget-${month}`, amount: 4_500_000, month, familyId: family.id },
      update: { amount: 4_500_000 },
    })
    // 개인 예산 (김민준)
    await prisma.budget.upsert({
      where: { id: `demo-cfo-budget-${month}` },
      create: { id: `demo-cfo-budget-${month}`, amount: 2_800_000, month, familyId: family.id, userId: cfo.id },
      update: { amount: 2_800_000 },
    })
    // 개인 예산 (박지수)
    await prisma.budget.upsert({
      where: { id: `demo-member-budget-${month}` },
      create: { id: `demo-member-budget-${month}`, amount: 1_700_000, month, familyId: family.id, userId: member.id },
      update: { amount: 1_700_000 },
    })
  }
  console.log('✅ 예산 데이터 생성')

  // ══════════════════════════════════════════════════════════════════
  // 7. 월별 목표 (최근 3개월)
  // ══════════════════════════════════════════════════════════════════

  for (let m = 2; m >= 0; m--) {
    const month = yearMonth(monthsAgo(m))
    await prisma.monthlyGoal.upsert({
      where: { familyId_month: { familyId: family.id, month } },
      update: {},
      create: { familyId: family.id, month, targetIncome: 13_000_000, targetExpense: 4_500_000, targetSavingsRate: 35 },
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // 8. 순자산 스냅샷 (12개월 — 극적 우상향 스토리)
  // ══════════════════════════════════════════════════════════════════
  //
  //  [스토리] 아파트 취득 2년 후: 시세 4억 상승 + 주식 급등 + 대출 상환
  //  총자산:  9.8억 → 15.45억   순자산: 4.1억 → 11.6억 (+183%)
  //
  const snapshots = [
    { totalAssets:  980_000_000, totalLiabilities: 570_000_000 }, // -11 → 4.1억
    { totalAssets: 1_020_000_000, totalLiabilities: 555_000_000 }, // -10 → 4.65억
    { totalAssets: 1_080_000_000, totalLiabilities: 540_000_000 }, // -9  → 5.4억
    { totalAssets: 1_150_000_000, totalLiabilities: 523_000_000 }, // -8  → 6.27억
    { totalAssets: 1_100_000_000, totalLiabilities: 508_000_000 }, // -7  → 5.92억  (주식 조정)
    { totalAssets: 1_230_000_000, totalLiabilities: 490_000_000 }, // -6  → 7.4억   (반등)
    { totalAssets: 1_330_000_000, totalLiabilities: 472_000_000 }, // -5  → 8.58억
    { totalAssets: 1_390_000_000, totalLiabilities: 450_000_000 }, // -4  → 9.4억   (아파트 호가 상승)
    { totalAssets: 1_430_000_000, totalLiabilities: 430_000_000 }, // -3  → 10.0억
    { totalAssets: 1_480_000_000, totalLiabilities: 380_000_000 }, // -2  → 11.0억  (대출 일부 상환)
    { totalAssets: 1_510_000_000, totalLiabilities: 320_000_000 }, // -1  → 11.9억
    { totalAssets: 1_545_000_000, totalLiabilities: 285_000_000 }, // 0   → 12.6억
  ]

  for (let i = 0; i < snapshots.length; i++) {
    const date = monthsAgo(snapshots.length - 1 - i)
    const ym = yearMonth(date)
    const { totalAssets, totalLiabilities } = snapshots[i]
    await prisma.netWorthSnapshot.upsert({
      where: { familyId_yearMonth: { familyId: family.id, yearMonth: ym } },
      update: { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities },
      create: { familyId: family.id, yearMonth: ym, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities },
    })
  }
  console.log('✅ 순자산 스냅샷 12개월 생성')

  // ══════════════════════════════════════════════════════════════════
  // 9. 시나리오 허브 (3개 시나리오 + 채팅 + 확장 계획)
  // ══════════════════════════════════════════════════════════════════

  const batch1 = crypto.randomUUID()

  // 시나리오 1 — 부동산 갈아타기
  const sc1 = await prisma.scenario.create({
    data: {
      familyId: family.id,
      generationBatch: batch1,
      title: '마포 → 용산/성동 아파트 갈아타기 전략',
      category: '부동산',
      rationale: '현재 마포 아파트 시세 14.5억 대비 용산·성동 목표 단지는 18~22억 수준. 순자산 12.6억 중 유동 자산이 1억 미만으로, 갈아타기 타이밍과 추가 대출 여력을 면밀히 계산해야 합니다.',
      gap: '목표 단지 최소 진입가 18억 vs 현재 순유동자산 약 9천만원. 약 4~5억 갭 파이낸싱 필요.',
      timeline: '현 아파트 매도 후 → 갭 자금 마련 (6~12개월) → 매수 실행',
      risk: '금리 인상 시 추가 대출 이자 부담 증가. 매도-매수 타이밍 엇갈릴 경우 전세 거주 비용 발생.',
      actions: [
        '현 아파트 KB시세 주간 모니터링 등록',
        '국민은행 갈아타기 대출 한도 조회 (비대면)',
        '용산구·성동구 목표 단지 임장 2회 이상',
        '공인중개사 매도 타이밍 상담 (2곳 이상)',
        '추가 필요 자금 6개월 긴급 저축 계획 수립',
      ],
      completedActions: [0],
      feasibility: 72,
      status: 'interested',
      expansion: {
        overview: '현재 아파트를 최적 타이밍에 매도하고, 용산·성동 핵심 입지 아파트로 이동하는 2단계 전략입니다.',
        phases: [
          { phase: 1, name: '준비기 (0~3개월)', tasks: ['KB시세 알림 설정', '대출 한도 조회', '임장 계획 수립'] },
          { phase: 2, name: '실행기 (3~9개월)', tasks: ['매도 물건 내놓기', '목표 단지 청약/매수 검토', '브릿지론 협의'] },
          { phase: 3, name: '완료기 (9~12개월)', tasks: ['잔금 처리', '이사', '새 담보대출 최적화'] },
        ],
      },
    },
  })

  await prisma.scenarioChatMessage.createMany({
    data: [
      { scenarioId: sc1.id, role: 'user', content: '용산 갈아타기 시 추가 대출을 얼마나 받을 수 있을지 계산해줘' },
      { scenarioId: sc1.id, role: 'assistant', content: 'DSR 40% 기준으로 현재 가족 합산 연소득 약 1.5억 기준, 추가 담보대출 한도는 약 3억 5천만원 수준으로 예상됩니다. 현 주담대 잔액 2.8억을 감안하면 신규 물건에 대한 LTV 70% 이내에서 최대 12억 6천만원 담보가 가능하며, 이를 합산하면 목표 20억 단지도 충분히 검토 가능합니다. 단, 변동금리 시나리오(+1.5%)에서 월 상환액이 280만원까지 올라갈 수 있으니 여유 현금 6개월치 확보를 먼저 권합니다.' },
      { scenarioId: sc1.id, role: 'user', content: '성동구 vs 용산구 어디가 더 낫다고 봐?' },
      { scenarioId: sc1.id, role: 'assistant', content: '성동구(성수·왕십리)는 IT 기업 집중·20~30대 수요 강해 임대 수요가 탄탄하고, 용산구(한남·이촌)는 한강뷰 프리미엄과 개발 호재(용산국제업무지구)가 강점입니다. 두 분의 직장 위치가 마포/강남이라면 용산이 더 가깝고, 자녀 학군을 중시한다면 성동(서울숲 인근 초·중) 쪽이 유리합니다. 장기 보유 목적이라면 용산 개발 호재를, 현금 흐름(전세 수익)을 중시한다면 성동을 추천합니다.' },
    ],
  })

  // 시나리오 2 — 연금 최적화
  const sc2 = await prisma.scenario.create({
    data: {
      familyId: family.id,
      generationBatch: batch1,
      title: '은퇴 자산 30억 달성 — 연금·IRP 세액공제 최적화',
      category: '연금/장기',
      rationale: '현재 연금저축 1,850만원 + IRP 920만원 = 2,770만원 보유. 두 분 합산 연소득 1.5억 기준 세액공제 한도(900만원)를 아직 100% 활용하지 못하고 있습니다.',
      gap: '연간 세액공제 가능 추가 납입액: 약 4,000만원(현재 600만원 납입 → 최대 900만원). 연 300만원 추가 가능.',
      timeline: '올해 연말정산 전 11월까지 IRP 추가 납입 완료. 매년 1월 연금저축 자동이체 설정.',
      risk: '중도 해지 시 기타소득세 16.5% 부과. 55세 이전 인출 제한.',
      actions: [
        'IRP 계좌 연간 납입 한도 확인 (700만원)',
        '연금저축 + IRP 합산 900만원 납입 스케줄 설정',
        '연금저축 포트폴리오 리밸런싱 (TDF 2050 → 주식형 70% 비중)',
        '은퇴 후 연금 수령액 시뮬레이션 실행',
      ],
      completedActions: [],
      feasibility: 88,
      status: 'active',
    },
  })

  // 시나리오 3 — 주식 포트폴리오
  const sc3 = await prisma.scenario.create({
    data: {
      familyId: family.id,
      generationBatch: batch1,
      title: 'AI·반도체 집중 포트폴리오 리밸런싱',
      category: '투자',
      rationale: 'NVIDIA 비중이 전체 투자 포트폴리오의 38%로 과도한 단일 종목 집중. 국내·해외 합산 63.2M 중 카카오는 -8.3% 손실 중이며, AI 관련 추가 익스포져 검토가 필요합니다.',
      gap: '목표: 단일 종목 20% 이하. NVDA 현재 38% → 20%로 축소 시 약 2.8M 실현 익.',
      timeline: '2~3개월에 걸쳐 분할 매도. 수익 실현 후 배당 ETF(SCHD) 및 국내 인덱스(KODEX 200)로 분산.',
      risk: 'NVDA 추가 상승 시 수익 기회 손실. 환율 변동(KRW/USD)으로 원화 환산 수익률 변동.',
      actions: [
        'NVDA 목표 비중 20%까지 분할 매도 (3회, 月 1회)',
        '카카오 손절 기준가 35,000원 이하 설정',
        '매도 자금으로 SCHD ETF 매수 검토',
        '국내 주식: KODEX 200 월적립식 50만원 설정',
        '반기별 포트폴리오 리밸런싱 캘린더 등록',
      ],
      completedActions: [0],
      feasibility: 81,
      status: 'interested',
    },
  })

  // 시나리오 4 — 부채 최적화
  await prisma.scenario.create({
    data: {
      familyId: family.id,
      generationBatch: batch1,
      title: '주담대 금리 인하 — 보금자리론 대환 검토',
      category: '부채',
      rationale: '현재 KB 주담대 금리 3.65% (변동). 주택금융공사 보금자리론 현재 고정금리 3.25% 제공 중. 잔액 2.8억 기준 연 112만원 이자 절감 가능.',
      gap: '대환 대출 신청 조건: LTV 70% 이내 ✓, DTI 40% ✓. 중도상환수수료 잔여 기간 확인 필요.',
      timeline: '중도상환수수료 소멸 후(2025년 9월) 대환 신청 최적 시점.',
      risk: '고정금리 선택 시 향후 금리 인하 혜택 미적용. 대환 수수료 약 40만원 발생.',
      actions: [
        '현재 중도상환수수료 잔액 은행 앱에서 확인',
        '주택금융공사 보금자리론 한도 조회 (온라인)',
        '변동 vs 고정 5년 총이자 비교 계산',
        '대환 실행 시점 캘린더 알림 설정 (2025.09)',
      ],
      completedActions: [],
      feasibility: 91,
      status: 'active',
    },
  })

  console.log(`✅ 시나리오 ${4}개 + 채팅 메시지 생성`)

  // ══════════════════════════════════════════════════════════════════
  // 10. 가족 피드 게시물 + 댓글 + 반응
  // ══════════════════════════════════════════════════════════════════

  // 피드용 거래 하나 찾기 (가장 최근 식비)
  const foodTx = await prisma.transaction.findFirst({
    where: { userId: cfo.id, category: '식비' },
    orderBy: { date: 'desc' },
  })

  // 게시물 1 — 거래 공유 (txn_ref)
  if (foodTx) {
    const p1 = await prisma.familyPost.create({
      data: {
        familyId: family.id, authorId: cfo.id,
        type: 'txn_ref', transactionId: foodTx.id,
        content: '지난주 외식비가 너무 많이 나온 것 같아. 이번 달 식비 예산 초과 위기야 😅',
        taggedUsers: { connect: [{ id: member.id }] },
        createdAt: daysAgo(3),
      },
    })
    await prisma.postReaction.createMany({
      data: [
        { postId: p1.id, userId: member.id, emoji: '😮' },
        { postId: p1.id, userId: cfo.id, emoji: '🤔' },
      ],
    })
    await prisma.postComment.create({
      data: { postId: p1.id, authorId: member.id, content: '맞아, 요즘 외식이 좀 잦았지. 이번 주는 집밥 위주로 가자!', createdAt: daysAgo(3, 14) },
    })
  }

  // 게시물 2 — 시나리오 공유
  const p2 = await prisma.familyPost.create({
    data: {
      familyId: family.id, authorId: cfo.id, type: 'text',
      content: `AI가 분석한 결과 용산 갈아타기가 가능성 72%로 나왔어. 이번 달 임장 한번 가볼까? 성동구도 같이 보자 🏠\n\n특히 왕십리 쪽이 학군이 괜찮다고 하더라고`,
      isPinned: true,
      taggedUsers: { connect: [{ id: member.id }] },
      createdAt: daysAgo(5),
    },
  })
  await prisma.postReaction.createMany({
    data: [
      { postId: p2.id, userId: member.id, emoji: '✅' },
      { postId: p2.id, userId: cfo.id, emoji: '❤️' },
    ],
  })
  await prisma.postComment.createMany({
    data: [
      { postId: p2.id, authorId: member.id, content: '좋아! 주말에 성동구 먼저 보자. 성수동도 같이 가고 싶어 ☕', createdAt: daysAgo(5, 15) },
      { postId: p2.id, authorId: cfo.id, content: '오케이, 토요일 오전 10시에 출발! 사전에 KB시세 앱에서 미리 확인해 둘게', createdAt: daysAgo(4, 20) },
    ],
  })

  // 게시물 3 — NVDA 수익 공유
  const p3 = await prisma.familyPost.create({
    data: {
      familyId: family.id, authorId: cfo.id, type: 'text',
      content: 'NVDA가 오늘 또 올랐어 🚀 평단가 대비 +107%야. 시나리오대로 20% 비중 조절 시작해야 할 것 같아.',
      createdAt: daysAgo(8),
    },
  })
  await prisma.postReaction.createMany({
    data: [
      { postId: p3.id, userId: member.id, emoji: '🎉' },
      { postId: p3.id, userId: member.id, emoji: '👍' },
    ],
  })
  await prisma.postComment.create({
    data: { postId: p3.id, authorId: member.id, content: '오오 대박!! 수익 실현하면 여행 자금 일부 넣어요 ✈️', createdAt: daysAgo(8, 12) },
  })

  // 게시물 4 — 연금 관련
  await prisma.familyPost.create({
    data: {
      familyId: family.id, authorId: member.id, type: 'text',
      content: '나도 IRP 계좌 이번 달 50만원 더 넣었어. 연말정산 환급 기대 중 😊\n세액공제 최대 900만원까지 가능하다니 작년엔 너무 아꼈던 것 같아.',
      createdAt: daysAgo(12),
    },
  })

  // 게시물 5 — 일반 공지 (핀 없음, 오래된 글)
  await prisma.familyPost.create({
    data: {
      familyId: family.id, authorId: cfo.id, type: 'text',
      content: '이번 달 가계부 결산 공유 📊\n\n수입 12,820,000원 / 지출 4,180,000원\n저축률 67% 달성! 목표 35% 대비 초과 달성 🎯\n\n주담대 상환분 제외하면 실 소비 2,680,000원이야.',
      createdAt: daysAgo(20),
    },
  })

  console.log('✅ 가족 피드 게시물 5개 + 댓글 + 반응 생성')

  // ══════════════════════════════════════════════════════════════════
  // 11. 결과 요약
  // ══════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(60))
  console.log('🎉 경진대회 데모 시드 완료!')
  console.log('═'.repeat(60))
  console.log(`\n  CFO 계정   : ${CFO_EMAIL}`)
  console.log(`  MEMBER 계정: ${MEMBER_EMAIL}`)
  console.log('\n  시드된 데이터:')
  console.log(`  - 가족 구성원  : 2명 (CFO + MEMBER)`)
  console.log(`  - 자산/부채 계좌: 9개 (부동산·주식·연금·예금·부채)`)
  console.log(`  - 투자 종목    : 6개 (국내 3 + 해외 3)`)
  console.log(`  - 거래 내역    : ${txs.length}건 (6개월)`)
  console.log(`  - 순자산 이력  : 12개월`)
  console.log(`  - 예산 데이터  : 3개월`)
  console.log(`  - 시나리오     : 4개 + AI 채팅 3개`)
  console.log(`  - 가족 피드    : 5개 게시물`)
  console.log('\n  ⚠️  Clerk 계정이 등록되어 있어야 실제 로그인이 가능합니다.')
  console.log('     env에 DEMO_CFO_CLERK_ID / DEMO_MEMBER_CLERK_ID 를 설정하세요.\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

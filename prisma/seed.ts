import { PrismaClient, Role, Visibility, AccountType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 기존 데이터 정리
  await prisma.transaction.deleteMany()
  await prisma.account.deleteMany()
  await prisma.familyInvite.deleteMany()
  await prisma.user.deleteMany()
  await prisma.familyGroup.deleteMany()

  console.log('🌱 시드 데이터 생성 시작...')

  // 1. 가족 그룹
  const family = await prisma.familyGroup.create({
    data: { name: '우리집 돈독' },
  })

  // 2. 사용자 A (나) & 사용자 B (가족)
  const userA = await prisma.user.create({
    data: {
      email: 'zkznxk123@gmail.com',
      name: '한상빈',
      role: Role.CFO,
      familyId: family.id,
    },
  })

  const userB = await prisma.user.create({
    data: {
      email: 'family@family.com',
      name: '가족',
      role: Role.MEMBER,
      familyId: family.id,
    },
  })

  // 3. 계좌 (다양한 자산 유형)
  const sharedAccount = await prisma.account.create({
    data: {
      name: '가족 공동 통장',
      type: AccountType.CASH,
      balance: 45000000,
      isShared: true,
      familyId: family.id,
    },
  })

  await prisma.account.create({
    data: {
      name: '비상금 적금',
      type: AccountType.CASH,
      balance: 12000000,
      isShared: true,
      familyId: family.id,
    },
  })

  await prisma.account.create({
    data: {
      name: '국내주식 (삼성전자 외)',
      type: AccountType.INVESTMENT,
      balance: 38000000,
      isShared: true,
      familyId: family.id,
      userId: userA.id,
    },
  })

  await prisma.account.create({
    data: {
      name: 'ETF 포트폴리오',
      type: AccountType.INVESTMENT,
      balance: 22000000,
      isShared: true,
      familyId: family.id,
      userId: userA.id,
    },
  })

  await prisma.account.create({
    data: {
      name: '비트코인 + 이더리움',
      type: AccountType.CRYPTO,
      balance: 8500000,
      isShared: false,
      familyId: family.id,
      userId: userA.id,
    },
  })

  await prisma.account.create({
    data: {
      name: '강남 오피스텔',
      type: AccountType.REAL_ESTATE,
      balance: 320000000,
      isShared: true,
      familyId: family.id,
    },
  })

  await prisma.account.create({
    data: {
      name: 'STO 부동산 토큰',
      type: AccountType.STO,
      balance: 5000000,
      isShared: true,
      familyId: family.id,
      userId: userA.id,
    },
  })

  const personalB = await prisma.account.create({
    data: {
      name: '가족 개인 통장',
      type: AccountType.CASH,
      balance: 8000000,
      isShared: false,
      familyId: family.id,
      userId: userB.id,
    },
  })

  // 4. 테스트 거래 내역
  await prisma.transaction.createMany({
    data: [
      // ✅ 사용자 A(나)의 SHARED 지출 → 누구나 볼 수 있음
      {
        amount: -10000,
        date: new Date('2024-03-15'),
        description: '점심 식사',
        category: '식비',
        visibility: Visibility.SHARED,
        userId: userA.id,
        accountId: sharedAccount.id,
      },

      // 🔒 사용자 B(가족)의 PRIVATE 지출 → 내가 봤을 때 "🔒 개인 지출"로 마스킹
      {
        amount: -200000,
        date: new Date('2024-03-14'),
        description: '깜짝 선물',
        category: '쇼핑',
        visibility: Visibility.PRIVATE,
        userId: userB.id,
        accountId: personalB.id,
      },

      // ✅ 사용자 B(가족)의 SHARED 지출 → 내가 봤을 때 제목이 보여야 함
      {
        amount: -150000,
        date: new Date('2024-03-13'),
        description: '관리비',
        category: '주거',
        visibility: Visibility.SHARED,
        userId: userB.id,
        accountId: sharedAccount.id,
      },
    ],
  })

  console.log('✅ 시드 완료!')
  console.log('')
  console.log(`   사용자 A (나):   ${userA.id}`)
  console.log(`   사용자 B (가족): ${userB.id}`)
  console.log(`   가족 ID:        ${family.id}`)
  console.log('')
  console.log('🎯 테스트 기대 결과 (사용자 A 로그인 시):')
  console.log('   1. "점심 식사"  → ✅ 그대로 보임 (내 SHARED 지출)')
  console.log('   2. "깜짝 선물"  → 🔒 "개인 지출"로 마스킹 (B의 PRIVATE)')
  console.log('   3. "관리비"     → ✅ 그대로 보임 (B의 SHARED 지출)')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

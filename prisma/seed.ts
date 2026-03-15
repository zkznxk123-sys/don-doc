import { PrismaClient, Role, Visibility, AccountType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 기존 데이터 정리
  await prisma.transaction.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.familyGroup.deleteMany()

  console.log('🌱 시드 데이터 생성 시작...')

  // 1. 가족 그룹
  const family = await prisma.familyGroup.create({
    data: { name: '우리집 패밀리오피스' },
  })

  // 2. 아빠(CFO) & 엄마(MEMBER)
  const dad = await prisma.user.create({
    data: {
      email: 'dad@family.com',
      name: '아빠',
      role: Role.CFO,
      familyId: family.id,
    },
  })

  const mom = await prisma.user.create({
    data: {
      email: 'mom@family.com',
      name: '엄마',
      role: Role.MEMBER,
      familyId: family.id,
    },
  })

  // 3. 계좌
  const sharedAccount = await prisma.account.create({
    data: {
      name: '가족 생활비 통장',
      type: AccountType.CASH,
      balance: 5000000,
      isShared: true,
      familyId: family.id,
    },
  })

  const momPersonal = await prisma.account.create({
    data: {
      name: '엄마 개인 통장',
      type: AccountType.CASH,
      balance: 2000000,
      isShared: false,
      familyId: family.id,
      userId: mom.id,
    },
  })

  const dadPersonal = await prisma.account.create({
    data: {
      name: '아빠 개인 통장',
      type: AccountType.CASH,
      balance: 3000000,
      isShared: false,
      familyId: family.id,
      userId: dad.id,
    },
  })

  const investAccount = await prisma.account.create({
    data: {
      name: '가족 투자 계좌',
      type: AccountType.INVESTMENT,
      balance: 50000000,
      isShared: true,
      familyId: family.id,
    },
  })

  // 4. 거래 내역 — 선별적 투명성 테스트용
  await prisma.transaction.createMany({
    data: [
      // ── 아빠(CFO)의 SHARED 지출 ──
      {
        amount: -50000,
        date: new Date('2024-03-15'),
        description: '마트 장보기',
        category: '식비',
        visibility: Visibility.SHARED,
        userId: dad.id,
        accountId: sharedAccount.id,
      },
      {
        amount: -200000,
        date: new Date('2024-03-14'),
        description: '아이 학원비',
        category: '교육',
        visibility: Visibility.SHARED,
        userId: dad.id,
        accountId: sharedAccount.id,
      },
      {
        amount: -120000,
        date: new Date('2024-03-10'),
        description: '가족 외식',
        category: '식비',
        visibility: Visibility.SHARED,
        userId: dad.id,
        accountId: sharedAccount.id,
      },
      {
        amount: 5000000,
        date: new Date('2024-03-01'),
        description: '월급',
        category: '수입',
        visibility: Visibility.SHARED,
        userId: dad.id,
        accountId: sharedAccount.id,
      },

      // ── 아빠(CFO)의 PRIVATE 지출 ──
      {
        amount: -80000,
        date: new Date('2024-03-13'),
        description: '동창 모임 회비',
        category: '여가',
        visibility: Visibility.PRIVATE,
        userId: dad.id,
        accountId: dadPersonal.id,
      },

      // ── 엄마(MEMBER)의 SHARED 지출 ──
      {
        amount: -35000,
        date: new Date('2024-03-14'),
        description: '유치원 간식비',
        category: '교육',
        visibility: Visibility.SHARED,
        userId: mom.id,
        accountId: sharedAccount.id,
      },
      {
        amount: -15000,
        date: new Date('2024-03-12'),
        description: '세탁소',
        category: '생활',
        visibility: Visibility.SHARED,
        userId: mom.id,
        accountId: sharedAccount.id,
      },

      // ── 엄마(MEMBER)의 PRIVATE 지출 — 아빠 화면에서 마스킹 대상 ──
      {
        amount: -30000,
        date: new Date('2024-03-13'),
        description: '친구 생일 선물',
        category: '선물',
        visibility: Visibility.PRIVATE,
        userId: mom.id,
        accountId: momPersonal.id,
      },
      {
        amount: -55000,
        date: new Date('2024-03-11'),
        description: '네일 케어',
        category: '뷰티',
        visibility: Visibility.PRIVATE,
        userId: mom.id,
        accountId: momPersonal.id,
      },
      {
        amount: -120000,
        date: new Date('2024-03-09'),
        description: '요가 수업',
        category: '건강',
        visibility: Visibility.PRIVATE,
        userId: mom.id,
        accountId: momPersonal.id,
      },
    ],
  })

  console.log('✅ 시드 완료!')
  console.log(`   가족: ${family.name}`)
  console.log(`   아빠(CFO): ${dad.id}`)
  console.log(`   엄마(MEMBER): ${mom.id}`)
  console.log(`   가족ID: ${family.id}`)
  console.log('')
  console.log('🎯 테스트: 아빠 로그인 시 엄마의 PRIVATE 지출 3건이')
  console.log('   "🔒 개인 지출"로 마스킹되어야 합니다.')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

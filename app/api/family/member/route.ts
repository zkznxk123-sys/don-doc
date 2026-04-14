export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel, type AppRole } from '@/lib/roles'

/**
 * PATCH /api/family/member — 멤버 역할 변경 (CFO/CO_CFO만 가능)
 * body: { memberId: string, role: 'CO_CFO' | 'MEMBER' }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    if (!isCFOLevel(user.role) || !user.familyId) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
    }

    const { memberId, role } = await req.json() as { memberId: string; role: AppRole }

    // 변경 가능한 역할: CO_CFO ↔ MEMBER (CFO는 변경 불가 — 가족 생성자)
    if (role !== 'CO_CFO' && role !== 'MEMBER') {
      return NextResponse.json({ success: false, error: '유효하지 않은 역할입니다.' }, { status: 400 })
    }

    // 대상 멤버가 같은 가족인지 확인
    const target = await prisma.user.findFirst({
      where: { id: memberId, familyId: user.familyId },
    })
    if (!target) return NextResponse.json({ success: false, error: '멤버를 찾을 수 없습니다.' }, { status: 404 })

    // CFO(생성자)는 역할 변경 불가
    if (target.role === 'CFO') {
      return NextResponse.json({ success: false, error: '대표 CFO의 역할은 변경할 수 없습니다.' }, { status: 403 })
    }

    await prisma.user.update({ where: { id: memberId }, data: { role } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[PATCH /api/family/member] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}

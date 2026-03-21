export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

/** GET /api/family/info — 가족 정보 + 초대 코드 조회 */
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    if (!user.familyId) return NextResponse.json({ success: false, error: '가족 그룹이 없습니다.' }, { status: 403 })

    const family = await prisma.familyGroup.findUnique({
      where: { id: user.familyId },
      include: { users: true },
    })
    if (!family) return NextResponse.json({ success: false, error: '가족 그룹을 찾을 수 없습니다.' }, { status: 404 })

    let invite = await prisma.familyInvite.findFirst({
      where: { familyId: user.familyId, expiresAt: { gt: new Date() }, usedBy: null },
      orderBy: { createdAt: 'desc' },
    })

    if (!invite) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = ''
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
      invite = await prisma.familyInvite.create({
        data: { code, familyId: user.familyId, createdBy: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      })
    }

    return NextResponse.json({
      success: true,
      family: {
        id: family.id,
        name: family.name,
        members: family.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
        inviteCode: invite.code,
      },
    })
  } catch (e) {
    console.error('[GET /api/family/info] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}

/** PATCH /api/family/info — 가족 이름 수정 */
export async function PATCH(req: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    if (user.role !== 'CFO') return NextResponse.json({ success: false, error: 'CFO만 수정할 수 있습니다.' }, { status: 403 })
    if (!user.familyId) return NextResponse.json({ success: false, error: '가족 그룹이 없습니다.' }, { status: 403 })

    const { name } = await req.json()
    const trimmed = (name ?? '').trim()
    if (!trimmed) return NextResponse.json({ success: false, error: '가족 이름을 입력해주세요.' }, { status: 400 })
    if (trimmed.length > 30) return NextResponse.json({ success: false, error: '30자 이하로 입력해주세요.' }, { status: 400 })

    await prisma.familyGroup.update({ where: { id: user.familyId }, data: { name: trimmed } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[PATCH /api/family/info] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}

/**
 * 총자산 계산의 단일 입력 — 가족 계좌 조회 계약. (2026-09-16 팀 결정: 총자산 3중 불일치 통일)
 *
 * dashboard·wealth 라우트, 순자산 스냅샷, 인사이트(stats)가 전부 이 함수로 같은 모양의
 * 계좌를 읽고 lib/networth-calc.computeWealthSummary 한 곳에서 합산한다.
 *  - 최상위 계좌만(parentAccountId null) + 하위 계좌·보유 종목 수·연결 부채를 함께
 *  - 예수금(cashBalance)·CASH 하위 계좌 합산 규칙은 computeWealthSummary가 담당
 *  - PRIVATE 제외 여부는 호출 측이 computeWealthSummary의 excludePrivate로 결정
 *    (가족 합산 스냅샷·인사이트 = 제외, 대시보드 = 역할별 마스킹)
 *
 * 'use server' 파일이 아니다 — 내부 헬퍼를 엔드포인트로 노출하지 않기 위해.
 */

import { prisma } from '@/lib/prisma'
import type { WealthAccountRow } from '@/lib/networth-calc'

export async function loadWealthAccounts(familyId: string): Promise<WealthAccountRow[]> {
  return prisma.account.findMany({
    where: { familyId, parentAccountId: null },
    include: {
      linkedDebts: { select: { id: true, name: true, balance: true } },
      user: { select: { name: true } },
      subAccounts: {
        select: { id: true, name: true, balance: true, type: true },
        orderBy: { name: 'asc' },
      },
      realEstateDetail: {
        select: { complexName: true, bjdCode: true, area: true, floor: true, propertyType: true },
      },
      _count: { select: { holdings: true } },
    },
  })
}

import { ScreenClient } from './screen-client'
import { getAuthUser } from '@/lib/auth'
import { canUseResearchBeta } from '@/lib/feature-flags'

export const metadata = { title: '종목 검색 — 돈독' }

export default async function ScreenPage() {
  // 리서치 베타(딥다이브·ETF NAV)는 허용 계정에만 노출 — API 가드와 동일 판정(fail-closed)
  const user = await getAuthUser()
  const researchBeta = canUseResearchBeta(user?.email)
  return <ScreenClient researchBeta={researchBeta} />
}

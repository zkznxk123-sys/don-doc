import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { LandingPage } from '@/components/marketing/LandingPage'

export default async function Home() {
  // 공개 랜딩은 어떤 상황에도 떠야 한다 — 인프라 오류(getAuthUser rethrow)는 여기서만
  // 삼켜 비로그인 취급으로 랜딩을 그대로 노출(대시보드 진입 시점엔 error.tsx가 잡음).
  const user = await getAuthUser().catch(() => null)
  if (user) redirect('/dashboard')
  return <LandingPage />
}

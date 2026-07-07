import { notFound } from 'next/navigation'
import { LandingPage } from '@/components/marketing/LandingPage'

/**
 * 랜딩 프리뷰 — 로그인 상태에서도 랜딩(marketing)을 확인하는 개발 유틸.
 * "/"는 로그인 사용자를 /dashboard로 redirect하므로 랜딩 QA가 안 된다.
 * 프로덕션에선 notFound 가드로 비노출(design-2026-07-07-v2 §7 권고).
 */
export default function LandingPreview() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <LandingPage />
}

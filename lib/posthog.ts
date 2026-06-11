/**
 * PostHog 클라이언트 헬퍼 — capture·identify 통합 진입점.
 * spec: specs/posthog-metrics-h1-h3-20260611.md (vault 03_personal/projects/don-doc/)
 *
 * 사용:
 *   import { track, identifyUser } from '@/lib/posthog'
 *   await track('excel_upload_completed', { row_count: 120, ... })
 *
 * 정책:
 * - posthog-js는 SSR 안 됨 → 동적 import.
 * - NEXT_PUBLIC_POSTHOG_KEY 미설정이면 silent no-op (dev 환경).
 * - 모든 capture는 super property `product_line` 자동 첨부 (PostHogPageView 초기 register).
 */

import { getProductLine } from './feature-flags'

export async function track(event: string, properties?: Record<string, unknown>): Promise<void> {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  try {
    const { default: posthog } = await import('posthog-js')
    if (!posthog.__loaded) return
    posthog.capture(event, properties)
  } catch (e) {
    console.warn('[posthog] track failed:', e)
  }
}

export async function identifyUser(
  userId: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  try {
    const { default: posthog } = await import('posthog-js')
    if (!posthog.__loaded) return
    posthog.identify(userId, { product_line: getProductLine(), ...properties })
  } catch (e) {
    console.warn('[posthog] identify failed:', e)
  }
}

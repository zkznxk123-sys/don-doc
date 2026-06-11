/**
 * PostHog 클라이언트 헬퍼 — init·capture·identify 통합 진입점.
 * spec: specs/posthog-metrics-h1-h3-20260611.md (vault 03_personal/projects/don-doc/)
 *
 * 사용:
 *   import { track, identifyUser, capturePageView } from '@/lib/posthog'
 *   await track('excel_upload_completed', { row_count: 120, ... })
 *
 * 정책:
 * - posthog-js는 SSR 안 됨 → 동적 import.
 * - NEXT_PUBLIC_POSTHOG_KEY 미설정이면 silent no-op (dev 환경).
 * - init은 첫 호출 시 lazy 실행 — 호출 순서와 무관하게 어떤 capture도 드랍되지 않는다.
 * - 모든 capture는 super property `product_line` 자동 첨부 (init 직후 register).
 */

import type posthogJs from 'posthog-js'
import { getProductLine } from './feature-flags'

let clientPromise: Promise<typeof posthogJs | null> | null = null

/** posthog 인스턴스를 반환. 미초기화면 init까지 수행. key 없으면 null. */
export function getPostHogClient(): Promise<typeof posthogJs | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return Promise.resolve(null)

  if (!clientPromise) {
    clientPromise = import('posthog-js')
      .then(({ default: posthog }) => {
        if (!posthog.__loaded) {
          posthog.init(key, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
            capture_pageview: false,
            capture_pageleave: true,
          })
          // super property — 모든 event에 자동 첨부 (build-time product line)
          posthog.register({ product_line: getProductLine() })
        }
        return posthog
      })
      .catch((e) => {
        console.warn('[posthog] init failed:', e)
        return null
      })
  }
  return clientPromise
}

export async function track(event: string, properties?: Record<string, unknown>): Promise<void> {
  try {
    const posthog = await getPostHogClient()
    posthog?.capture(event, properties)
  } catch (e) {
    console.warn('[posthog] track failed:', e)
  }
}

export async function capturePageView(url: string): Promise<void> {
  try {
    const posthog = await getPostHogClient()
    posthog?.capture('$pageview', { $current_url: url })
  } catch (e) {
    console.warn('[posthog] pageview failed:', e)
  }
}

export async function identifyUser(
  userId: string,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const posthog = await getPostHogClient()
    posthog?.identify(userId, { product_line: getProductLine(), ...properties })
  } catch (e) {
    console.warn('[posthog] identify failed:', e)
  }
}

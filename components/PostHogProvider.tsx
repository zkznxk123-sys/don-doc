'use client'

import { useEffect } from 'react'

/** PostHog를 클라이언트에서만 동적으로 로드 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/** 클라이언트 전용 PostHog 초기화 컴포넌트 */
export function PostHogPageView() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return

    import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
          capture_pageview: false,
          capture_pageleave: true,
        })
      }
    })
  }, [])

  return null
}

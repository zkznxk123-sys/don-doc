'use client'

import { useEffect } from 'react'
import { getPostHogClient } from '@/lib/posthog'

/** 마운트 시 PostHog를 미리 init — capture는 lib/posthog.ts가 lazy init하므로 warm-up 용도 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    getPostHogClient()
  }, [])

  return <>{children}</>
}

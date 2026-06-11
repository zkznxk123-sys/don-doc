'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useEffect } from 'react'
import { identifyUser } from '@/lib/posthog'

export function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isSignedIn, user } = useUser()

  // user 식별 — Clerk id로 distinct_id 통합. posthog-js는 같은 id 재호출 시 no-op.
  useEffect(() => {
    if (!isSignedIn || !user) return
    identifyUser(user.id, {
      email: user.primaryEmailAddress?.emailAddress,
      signup_at: user.createdAt?.toISOString(),
    })
  }, [isSignedIn, user])

  useEffect(() => {
    if (!pathname) return
    import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) return
      let url = window.origin + pathname
      if (searchParams.toString()) url += `?${searchParams.toString()}`
      posthog.capture('$pageview', { $current_url: url })
    })
  }, [pathname, searchParams])

  return null
}

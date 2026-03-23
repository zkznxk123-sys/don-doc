'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: false, // 수동으로 처리 (App Router 대응)
    capture_pageleave: true,
  })
}

/** Clerk 유저 정보를 PostHog에 연결 */
function PostHogIdentify() {
  const { userId } = useAuth()
  const { user } = useUser()
  const ph = usePostHog()

  useEffect(() => {
    if (userId && user) {
      ph.identify(userId, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      })
    } else {
      ph.reset()
    }
  }, [userId, user, ph])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogIdentify />
      {children}
    </PHProvider>
  )
}

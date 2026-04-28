'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

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

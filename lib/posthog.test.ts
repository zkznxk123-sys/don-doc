/**
 * posthog lazy init 게이트 회귀 테스트.
 * 배경: `242f6ec` — init이 영영 안 불려 모든 capture가 silent no-op이던 버그.
 * 측정은 실패해도 에러가 안 보이는 영역이라 init 경유를 명시적으로 고정한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ENV_KEY = 'NEXT_PUBLIC_POSTHOG_KEY'

const posthogMock = vi.hoisted(() => ({
  __loaded: false,
  init: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
}))

vi.mock('posthog-js', () => ({ default: posthogMock }))

describe('posthog lazy init', () => {
  let originalKey: string | undefined

  beforeEach(() => {
    originalKey = process.env[ENV_KEY]
    posthogMock.__loaded = false
    posthogMock.init.mockClear()
    posthogMock.register.mockClear()
    posthogMock.capture.mockClear()
    posthogMock.identify.mockClear()
    vi.resetModules() // module-level clientPromise 캐시 초기화
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = originalKey
    }
  })

  it('key 미설정 — null 반환, init 안 함, track도 silent no-op', async () => {
    delete process.env[ENV_KEY]
    const { getPostHogClient, track } = await import('./posthog')
    expect(await getPostHogClient()).toBeNull()
    await track('any_event')
    expect(posthogMock.init).not.toHaveBeenCalled()
    expect(posthogMock.capture).not.toHaveBeenCalled()
  })

  it('key 설정 — init + product_line super property register', async () => {
    process.env[ENV_KEY] = 'phc_test'
    const { getPostHogClient } = await import('./posthog')
    const client = await getPostHogClient()
    expect(client).not.toBeNull()
    expect(posthogMock.init).toHaveBeenCalledTimes(1)
    expect(posthogMock.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ capture_pageview: false })
    )
    expect(posthogMock.register).toHaveBeenCalledWith(
      expect.objectContaining({ product_line: expect.stringMatching(/^(full|lite)$/) })
    )
  })

  it('중복 호출 — init은 1회 (promise 캐시)', async () => {
    process.env[ENV_KEY] = 'phc_test'
    const { getPostHogClient } = await import('./posthog')
    await Promise.all([getPostHogClient(), getPostHogClient()])
    await getPostHogClient()
    expect(posthogMock.init).toHaveBeenCalledTimes(1)
  })

  it('track — Provider 마운트 없이 단독 호출해도 init을 경유해 capture된다 (242f6ec 회귀)', async () => {
    process.env[ENV_KEY] = 'phc_test'
    const { track } = await import('./posthog')
    await track('excel_upload_completed', { row_count: 3 })
    expect(posthogMock.init).toHaveBeenCalledTimes(1)
    expect(posthogMock.capture).toHaveBeenCalledWith('excel_upload_completed', { row_count: 3 })
  })

  it('identifyUser — product_line 자동 첨부', async () => {
    process.env[ENV_KEY] = 'phc_test'
    const { identifyUser } = await import('./posthog')
    await identifyUser('user_1', { email: 'a@b.c' })
    expect(posthogMock.identify).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ email: 'a@b.c', product_line: expect.any(String) })
    )
  })

  it('capturePageView — $pageview를 init 경유로 capture', async () => {
    process.env[ENV_KEY] = 'phc_test'
    const { capturePageView } = await import('./posthog')
    await capturePageView('http://localhost/dashboard')
    expect(posthogMock.capture).toHaveBeenCalledWith('$pageview', {
      $current_url: 'http://localhost/dashboard',
    })
  })
})

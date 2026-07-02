import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const ENV_KEY = 'NEXT_PUBLIC_PRODUCT_LINE'

describe('feature-flags', () => {
  let originalValue: string | undefined

  beforeEach(() => {
    originalValue = process.env[ENV_KEY]
  })

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = originalValue
    }
  })

  it('미설정 시 full 라인이 default', async () => {
    delete process.env[ENV_KEY]
    const { getProductLine, isFull, isLite } = await import('./feature-flags')
    expect(getProductLine()).toBe('full')
    expect(isFull()).toBe(true)
    expect(isLite()).toBe(false)
  })

  it("'full' 명시도 동일", async () => {
    process.env[ENV_KEY] = 'full'
    const { getProductLine } = await import('./feature-flags')
    expect(getProductLine()).toBe('full')
  })

  it("'lite' 설정 시 lite 라인", async () => {
    process.env[ENV_KEY] = 'lite'
    const { isLite, isFull } = await import('./feature-flags')
    expect(isLite()).toBe(true)
    expect(isFull()).toBe(false)
  })

  it('잘못된 값은 full로 fallback', async () => {
    process.env[ENV_KEY] = 'unknown-value'
    const { getProductLine } = await import('./feature-flags')
    expect(getProductLine()).toBe('full')
  })

  it('isRouteBlockedInLite — lite에서만 차단', async () => {
    process.env[ENV_KEY] = 'lite'
    const { isRouteBlockedInLite } = await import('./feature-flags')
    expect(isRouteBlockedInLite('/dashboard/scenario')).toBe(true)
    expect(isRouteBlockedInLite('/dashboard/family')).toBe(true)
    expect(isRouteBlockedInLite('/dashboard/feed')).toBe(true)
    expect(isRouteBlockedInLite('/dashboard/feed/123')).toBe(true)
    expect(isRouteBlockedInLite('/dashboard/screen')).toBe(true)
    expect(isRouteBlockedInLite('/dashboard/ipo')).toBe(true)   // 2026-07-02 미노출 결정
    expect(isRouteBlockedInLite('/dashboard/cashflow')).toBe(false)
    expect(isRouteBlockedInLite('/dashboard')).toBe(false)
  })

  it('isRouteBlockedInLite — full에서는 모두 통과', async () => {
    process.env[ENV_KEY] = 'full'
    const { isRouteBlockedInLite } = await import('./feature-flags')
    expect(isRouteBlockedInLite('/dashboard/scenario')).toBe(false)
    expect(isRouteBlockedInLite('/dashboard/family')).toBe(false)
    expect(isRouteBlockedInLite('/dashboard/feed')).toBe(false)
    expect(isRouteBlockedInLite('/dashboard/ipo')).toBe(false)
  })

  it('blockIfLite — lite 빌드에서 JSON body 포함 404 Response 반환', async () => {
    process.env[ENV_KEY] = 'lite'
    const { blockIfLite } = await import('./feature-flags')
    const result = blockIfLite()
    expect(result).not.toBeNull()
    expect(result?.status).toBe(404)
    // 빈 body면 클라이언트의 무조건 .json() 파싱이 SyntaxError로 터진다
    const body = await result?.json()
    expect(body.success).toBe(false)
  })

  it('blockIfLite — full 빌드에서 null 반환 (통과)', async () => {
    process.env[ENV_KEY] = 'full'
    const { blockIfLite } = await import('./feature-flags')
    expect(blockIfLite()).toBeNull()
  })
})

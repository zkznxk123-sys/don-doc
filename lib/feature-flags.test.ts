import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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
    expect(isRouteBlockedInLite('/dashboard/ipo')).toBe(false)  // 2026-07-12: 전면 차단 해제 — cohort 해금(isIpoBlockedForUser)
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

  // ── cohort 엔타이틀먼트 (웨지 역방향 게이트) ──

  it('parseCohort — 알려진 cohort만 파싱, 나머지 null (fail-safe)', async () => {
    const { parseCohort } = await import('./feature-flags')
    expect(parseCohort({ cohort: 'ipo-spac' })).toBe('ipo-spac')
    expect(parseCohort({ cohort: 'unknown' })).toBeNull()
    expect(parseCohort({ other: 'x' })).toBeNull()
    expect(parseCohort(null)).toBeNull()
    expect(parseCohort(undefined)).toBeNull()
    expect(parseCohort('ipo-spac')).toBeNull() // 객체 아니면 null
  })

  // 2026-08-10 전략 전환: IPO cohort 게이트(canUseIpo·isIpoBlockedForUser·blockIpoIfNotEntitled)
  // 제거 → 관련 테스트 삭제. parseCohort는 존치(아래 별도 검증 유지).
})

describe('canUseResearchBeta — 리서치 베타 per-user 게이트 (fail-closed)', () => {
  const KEY = 'RESEARCH_BETA_EMAILS'
  const orig = process.env[KEY]
  afterEach(() => { if (orig === undefined) delete process.env[KEY]; else process.env[KEY] = orig })

  it('env 미설정이면 전원 차단 (fail-closed)', async () => {
    vi.resetModules()
    delete process.env[KEY]
    const m = await import('./feature-flags')
    expect(m.canUseResearchBeta('anyone@example.com')).toBe(false)
    expect(m.canUseResearchBeta(null)).toBe(false)
  })

  it('등재 계정만 허용 — 대소문자·공백 무시', async () => {
    vi.resetModules()
    process.env[KEY] = ' Owner@Example.com , second@example.com '
    const m = await import('./feature-flags')
    expect(m.canUseResearchBeta('owner@example.com')).toBe(true)
    expect(m.canUseResearchBeta('SECOND@EXAMPLE.COM')).toBe(true)
    expect(m.canUseResearchBeta('other@example.com')).toBe(false)
    expect(m.canUseResearchBeta(undefined)).toBe(false)
  })

  it('미허용이면 404 JSON 차단 응답', async () => {
    vi.resetModules()
    process.env[KEY] = 'owner@example.com'
    const m = await import('./feature-flags')
    expect(m.blockResearchBetaIfNotAllowed('owner@example.com')).toBeNull()
    const blocked = m.blockResearchBetaIfNotAllowed('other@example.com')
    expect(blocked?.status).toBe(404)
  })
})

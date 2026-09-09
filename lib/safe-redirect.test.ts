import { describe, it, expect } from 'vitest'
import { safeRedirect } from './safe-redirect'

const BASE = 'https://dondoc.app/api/auth/logout'

describe('safeRedirect — open redirect 차단', () => {
  it('같은 origin 의 상대경로는 그대로 통과', () => {
    expect(safeRedirect('/dashboard', BASE)).toBe('/dashboard')
    expect(safeRedirect('/dashboard?tab=assets#top', BASE)).toBe('/dashboard?tab=assets#top')
  })

  it('절대 URL 은 차단', () => {
    expect(safeRedirect('https://evil.com', BASE)).toBe('/sign-in')
    expect(safeRedirect('http://evil.com/path', BASE)).toBe('/sign-in')
  })

  it('프로토콜 상대 URL 은 차단', () => {
    expect(safeRedirect('//evil.com', BASE)).toBe('/sign-in')
  })

  // 2026-09-09 실측 회귀 — 접두사 검사(startsWith('/') && !startsWith('//'))를 통과해
  // https://evil.com 으로 나가던 우회. WHATWG 파서가 특수 스킴에서 \ 를 / 로 취급한다.
  it('백슬래시 우회는 차단 (접두사 검사가 뚫렸던 지점)', () => {
    expect(safeRedirect('/\\evil.com', BASE)).toBe('/sign-in')
    expect(safeRedirect('/\\/evil.com', BASE)).toBe('/sign-in')
    expect(safeRedirect('\\\\evil.com', BASE)).toBe('/sign-in')
  })

  it('같은 호스트를 흉내낸 서브도메인·유저인포는 차단', () => {
    expect(safeRedirect('https://dondoc.app.evil.com', BASE)).toBe('/sign-in')
    expect(safeRedirect('https://evil.com/@dondoc.app', BASE)).toBe('/sign-in')
    expect(safeRedirect('https://dondoc.app@evil.com', BASE)).toBe('/sign-in')
  })

  it('빈 값·파싱 불가는 fallback', () => {
    expect(safeRedirect(null, BASE)).toBe('/sign-in')
    expect(safeRedirect('', BASE)).toBe('/sign-in')
  })

  it('fallback 은 호출부가 정할 수 있다', () => {
    expect(safeRedirect('https://evil.com', BASE, '/login')).toBe('/login')
  })

  it('다른 스킴(javascript:·data:)은 차단', () => {
    expect(safeRedirect('javascript:alert(1)', BASE)).toBe('/sign-in')
    expect(safeRedirect('data:text/html,<script>alert(1)</script>', BASE)).toBe('/sign-in')
  })
})

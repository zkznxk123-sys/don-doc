import { describe, it, expect } from 'vitest'
import { sanitizePreferences, mergePreferences } from './user-preferences'

describe('sanitizePreferences — 개인 설정 검증', () => {
  it('유효 키만 통과, 알 수 없는 키 제거', () => {
    expect(sanitizePreferences({ assetThreshold: 500000, defaultVisibility: 'SHARED', evil: 'x' }))
      .toEqual({ assetThreshold: 500000, defaultVisibility: 'SHARED' })
  })

  it('비정상 값 거부 (음수·NaN·잘못된 enum·비객체)', () => {
    expect(sanitizePreferences({ assetThreshold: -1 })).toEqual({})
    expect(sanitizePreferences({ assetThreshold: NaN })).toEqual({})
    expect(sanitizePreferences({ defaultVisibility: 'PUBLIC' })).toEqual({})
    expect(sanitizePreferences(null)).toEqual({})
    expect(sanitizePreferences('str')).toEqual({})
  })

  it('소수점 임계값은 내림', () => {
    expect(sanitizePreferences({ assetThreshold: 123.9 })).toEqual({ assetThreshold: 123 })
  })
})

describe('mergePreferences — 부분 패치 병합', () => {
  it('패치 키만 덮어쓰고 기존 키 보존', () => {
    expect(mergePreferences({ assetThreshold: 100000 }, { defaultVisibility: 'SHARED' }))
      .toEqual({ assetThreshold: 100000, defaultVisibility: 'SHARED' })
  })

  it('무효 패치는 기존 값 유지', () => {
    expect(mergePreferences({ assetThreshold: 100000 }, { assetThreshold: -5 }))
      .toEqual({ assetThreshold: 100000 })
  })
})

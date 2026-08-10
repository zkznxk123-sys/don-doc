import { describe, it, expect } from 'vitest'
import { normalizeMerchant, buildPrefIndex, lookupPref, preferenceKey } from './category-learning'

describe('normalizeMerchant — 가맹점 토큰 추출', () => {
  it('공백 구분 지점/호점 제거', () => {
    expect(normalizeMerchant('스타벅스 강남2호점')).toBe('스타벅스')
    expect(normalizeMerchant('스타벅스 역삼점')).toBe('스타벅스')
  })
  it('붙은 지점명은 사전 없이는 꼬리 마커만 제거(한계)', () => {
    // "스타벅스강남점"→"스타벅스강남" (강남은 사전 없이 못 뗌) — 향후 가맹점 사전으로 보강
    expect(normalizeMerchant('스타벅스강남점')).toBe('스타벅스강남')
  })
  it('괄호·법인격·페이 노이즈 제거', () => {
    expect(normalizeMerchant('쿠팡(쿠페이)')).toBe('쿠팡')
    expect(normalizeMerchant('(주)무신사')).toBe('무신사')
  })
  it('구분자·전표번호 제거', () => {
    expect(normalizeMerchant('카카오_택시_선승인')).toBe('카카오')
    expect(normalizeMerchant('까를로커피 12345')).toBe('까를로커피')
  })
  it('브랜드 내 숫자는 보존(2자리 이하)', () => {
    expect(normalizeMerchant('GS25 역삼')).toBe('gs25')
  })
  it('정규화 불가하면 빈 문자열', () => {
    expect(normalizeMerchant('12345')).toBe('')
    expect(normalizeMerchant('')).toBe('')
  })
})

describe('lookupPref — 완전일치 → 가맹점 정규화', () => {
  const prefs = [
    { keyword: '스타벅스 강남2호점', categoryId: 'cat_food' },  // 레거시 full-desc 저장
    { keyword: '쿠팡', categoryId: 'cat_shop' },                // 정규화 키 저장
  ]
  const idx = buildPrefIndex(prefs)

  it('완전일치', () => {
    expect(lookupPref('스타벅스 강남2호점', idx)).toBe('cat_food')
  })
  it('변형도 가맹점 정규화로 매칭 (레거시 키가 정규화돼 인덱싱됨)', () => {
    expect(lookupPref('스타벅스 역삼점', idx)).toBe('cat_food')
    expect(lookupPref('(주)스타벅스코리아 판교', idx)).toBe('cat_food')
  })
  it('정규화 키 저장분도 변형 매칭', () => {
    expect(lookupPref('쿠팡(쿠페이)', idx)).toBe('cat_shop')
    expect(lookupPref('쿠팡 로켓배송', idx)).toBe('cat_shop')
  })
  it('학습에 없으면 null', () => {
    expect(lookupPref('배달의민족', idx)).toBeNull()
  })
})

describe('preferenceKey — 저장 키', () => {
  it('정규화 가맹점으로 저장', () => {
    expect(preferenceKey('스타벅스 강남2호점')).toBe('스타벅스')
  })
  it('정규화 불가면 설명 전체 소문자', () => {
    expect(preferenceKey('12345')).toBe('12345')
  })
})

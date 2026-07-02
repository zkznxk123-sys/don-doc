/**
 * board-data 순수 유틸 테스트 — maskAccountNo(표시용 마스킹).
 * (computeAllocation은 자금배분 탭 폐지·가용현금 필드 제거와 함께 삭제 — 2026-07-02)
 */
import { describe, it, expect } from 'vitest'
import { maskAccountNo } from './board-data'

describe('maskAccountNo — 표시용 계좌번호 마스킹', () => {
  it('앞 3자리·뒤 4자리만 노출, 구분자 보존', () => {
    expect(maskAccountNo('123-45-678901')).toBe('123-**-**8901')
  })

  it('구분자 없는 번호도 동일 규칙', () => {
    expect(maskAccountNo('1234567890')).toBe('123***7890')
  })

  it('7자리 이하는 그대로(마스킹 의미 없음)', () => {
    expect(maskAccountNo('123-4567')).toBe('123-4567')
    expect(maskAccountNo('1234')).toBe('1234')
  })
})

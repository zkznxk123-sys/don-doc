import { describe, it, expect } from 'vitest'
import { classifyPaymentMethod, isPaymentMethodType } from './payment-method-calc'

describe('classifyPaymentMethod — 뱅샐 결제수단명 → 계좌 타입', () => {
  it.each([
    '네이버 현대카드', '삼성카드 SFC & MILEAGE PLATINUM (스카이패스)', 'KB국민행복카드', '토스뱅크 체크카드',
    '토스뱅크 모임카드', '한화투자증권 패밀리 삼성카드 (할인형)', '현대백화점카드 더현대 클래식', '롯데백화점 리빙 by Lola',
    '네이버페이 간편결제', '네이버페이 간편결제(머니)', '네이버페이 간편결제(포인트)', '카카오페이 간편결제', '토스 간편결제',
  ])('결제 채널 "%s" → PAYMENT', name => {
    expect(classifyPaymentMethod(name)).toBe('PAYMENT')
  })

  it.each([
    'KB국민ONE통장-보통예금', '신한 주거래 우대통장(저축예금)', '토스뱅크 통장', '플러스박스', '현금',
    '네이버페이 머니', '카카오페이 머니', '토스머니', '급여', '기본 계좌',
  ])('돈이 머무는 "%s" → CASH', name => {
    expect(classifyPaymentMethod(name)).toBe('CASH')
  })

  it('빈 이름은 CASH', () => { expect(classifyPaymentMethod('  ')).toBe('CASH') })
  it('isPaymentMethodType', () => { expect(isPaymentMethodType('PAYMENT')).toBe(true); expect(isPaymentMethodType('CASH')).toBe(false) })
})

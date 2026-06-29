/**
 * schedule-notice 어댑터 테스트. 픽스처는 서초감자 소통방 실제 공지에서 발췌.
 */
import { describe, it, expect } from 'vitest'
import {
  isScheduleNotice, parseScheduleNotice, mergeEventsToOfferings, resolveYear,
} from './schedule-notice'

// 6/25 실제 공지 (종목 채워진 일간형)
const DAILY_FILLED = `6월 25일 목요일 공모주 일정
상장: x
청약: 레몬헬스케어(KB)
환불: 한국제16호스팩(한국)
이체: x

오늘은 화요일에 청약한 한국제16호스팩의 환불이 있습니다.
이 환불금을 활용하여 오늘 레몬헬스케어도 청약 해주세요!`

// 1/5 실제 공지 (방학 = 전부 x)
const DAILY_EMPTY = `1월 5일 월요일 공모주 일정
상장: x
청약: x
환불: x
이체: x

이번주는 공모주 일정이 없습니다!`

// 주간형 (실제 [1월 5일 ~ 9일 ...] 구조, 값만 데모로 채움)
const WEEKLY = `[1월 5일 ~ 9일 공모주 일정 안내]

월요일
상장: x
청약: 가나다전자(NH)
환불: x
이체: x

화요일
상장: x
청약: x
환불: 가나다전자(NH)
이체: x

수요일
상장: 마바사스팩(미래)
청약: x
환불: x
이체: x`

// "톡게시판 '공지':" 접두 변형
const WEEKLY_PREFIXED = `톡게시판 '공지': [1월 5일 ~ 9일 공모주 일정 안내]

월요일
청약: 가나다전자(NH)`

describe('isScheduleNotice', () => {
  it('일간 공지를 인식', () => expect(isScheduleNotice(DAILY_FILLED)).toBe(true))
  it('방학 공지도 공지로 인식', () => expect(isScheduleNotice(DAILY_EMPTY)).toBe(true))
  it('주간 공지를 인식', () => expect(isScheduleNotice(WEEKLY)).toBe(true))
  it('접두 붙은 공지도 인식', () => expect(isScheduleNotice(WEEKLY_PREFIXED)).toBe(true))
  it('일반 잡담은 공지 아님', () =>
    expect(isScheduleNotice('오늘 레몬헬스케어 청약 다들 하셨나요?')).toBe(false))
})

describe('parseScheduleNotice — 일간', () => {
  const events = parseScheduleNotice({ text: DAILY_FILLED, receivedAt: '2026-06-25 06:31:25' })

  it('청약·환불 2건만 추출(상장/이체는 x)', () => {
    expect(events).toHaveLength(2)
  })
  it('청약 = 레몬헬스케어(KB), 날짜 확정', () => {
    const sub = events.find(e => e.kind === 'SUBSCRIPTION')!
    expect(sub).toMatchObject({ stockName: '레몬헬스케어', brokers: ['KB'], date: '2026-06-25' })
  })
  it('환불 = 한국제16호스팩(한국)', () => {
    const ref = events.find(e => e.kind === 'REFUND')!
    expect(ref).toMatchObject({ stockName: '한국제16호스팩', brokers: ['한국'], date: '2026-06-25' })
  })
})

describe('parseScheduleNotice — 다증권사(실제 케이뱅크 포맷)', () => {
  it('괄호 안 콤마는 증권사 구분 — 한 종목으로 유지', () => {
    const events = parseScheduleNotice({
      text: '2월 23일 월요일 공모주 일정\n청약: 케이뱅크(NH, 삼성, 신한)',
      receivedAt: '2026-02-23 08:00:00',
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ stockName: '케이뱅크', brokers: ['NH', '삼성', '신한'] })
  })
  it('서로 다른 종목 2건은 괄호 밖 콤마로 분리', () => {
    const events = parseScheduleNotice({
      text: '3월 1일 월요일 공모주 일정\n청약: 가(NH), 나(삼성)',
      receivedAt: '2026-03-01 08:00:00',
    })
    expect(events.map(e => e.stockName)).toEqual(['가', '나'])
  })
})

describe('parseScheduleNotice — 방학', () => {
  it('전부 x면 이벤트 0건', () => {
    expect(parseScheduleNotice({ text: DAILY_EMPTY, receivedAt: '2026-01-05 07:20:04' })).toHaveLength(0)
  })
})

describe('parseScheduleNotice — 주간', () => {
  const events = parseScheduleNotice({ text: WEEKLY, receivedAt: '2026-01-04 10:21:29' })

  it('요일별 날짜가 주 시작일 기준으로 매핑', () => {
    const mon = events.find(e => e.kind === 'SUBSCRIPTION')!  // 월요일 청약
    expect(mon.date).toBe('2026-01-05')
    const wed = events.find(e => e.kind === 'LISTING')!       // 수요일 상장
    expect(wed.date).toBe('2026-01-07')
  })
  it('스팩은 merge 시 SPAC으로 분류', () => {
    const offerings = mergeEventsToOfferings(events)
    expect(offerings.find(o => o.name === '마바사스팩')!.kind).toBe('SPAC')
  })
})

describe('parseScheduleNotice — 접두 변형', () => {
  it("톡게시판 '공지': 접두를 떼고 파싱", () => {
    const events = parseScheduleNotice({ text: WEEKLY_PREFIXED, receivedAt: '2026-01-04 10:21:51' })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ stockName: '가나다전자', brokers: ['NH'], date: '2026-01-05' })
  })
})

describe('resolveYear — 연말 롤오버', () => {
  it('12월에 올린 1월 공지 → +1년', () =>
    expect(resolveYear(1, '2025-12-29 09:00:00')).toBe(2026))
  it('같은 달이면 그대로', () =>
    expect(resolveYear(6, '2026-06-25 06:31:25')).toBe(2026))
})

describe('mergeEventsToOfferings — 다일 누적', () => {
  it('서로 다른 날 청약/환불/상장이 한 종목으로 접힘', () => {
    const day1 = parseScheduleNotice({
      text: '6월 23일 화요일 공모주 일정\n청약: 레몬헬스케어(KB)',
      receivedAt: '2026-06-23 07:00:00',
    })
    const day2 = parseScheduleNotice({
      text: '6월 25일 목요일 공모주 일정\n환불: 레몬헬스케어(KB)',
      receivedAt: '2026-06-25 06:31:25',
    })
    const offerings = mergeEventsToOfferings([...day1, ...day2])
    expect(offerings).toHaveLength(1)
    expect(offerings[0]).toMatchObject({
      name: '레몬헬스케어', brokers: ['KB'],
      subStart: '2026-06-23', refundDate: '2026-06-25',
    })
  })
})

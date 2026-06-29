/**
 * calendar-sync 순수 함수 테스트 (buildCalendarEvents, renderAppleScript).
 * osascript 실행은 부작용·권한 의존이라 테스트 안 함 — CLI --dry-run + osacompile로 검증.
 */
import { describe, it, expect } from 'vitest'
import { buildCalendarEvents, renderAppleScript } from './calendar-sync'
import type { ScheduleOffering } from './types'

const LEMON: ScheduleOffering = {
  name: '레몬헬스케어', kind: 'IPO', brokers: ['KB'],
  subStart: '2026-06-25', subEnd: '2026-06-25',
  refundDate: '2026-06-29', listingDate: '2026-07-03',
}
const KBANK: ScheduleOffering = {
  name: '케이뱅크', kind: 'IPO', brokers: ['NH', '삼성', '신한'],
  subStart: '2026-02-23', refundDate: '2026-02-25', listingDate: '2026-03-05',
}

describe('buildCalendarEvents', () => {
  it('채워진 날짜 필드마다 이벤트 생성(청약·환불·상장)', () => {
    const ev = buildCalendarEvents([LEMON])
    expect(ev.map(e => e.key)).toEqual([
      '레몬헬스케어|청약', '레몬헬스케어|환불', '레몬헬스케어|상장·매도',
    ])
  })
  it('summary에 다증권사 표기', () => {
    const ev = buildCalendarEvents([KBANK])
    expect(ev[0].summary).toContain('케이뱅크 (NH,삼성,신한)')
  })
  it('description에 멱등 태그 포함', () => {
    const ev = buildCalendarEvents([LEMON])
    expect(ev[0].description).toContain('[ipo-sync:레몬헬스케어|청약]')
  })
  it('from 이전 날짜는 제외', () => {
    const ev = buildCalendarEvents([LEMON], { from: '2026-06-28' })
    // 청약(6/25)은 빠지고 환불(6/29)·상장(7/3)만
    expect(ev.map(e => e.key)).toEqual(['레몬헬스케어|환불', '레몬헬스케어|상장·매도'])
  })
  it('날짜 없는 필드는 이벤트 없음', () => {
    const ev = buildCalendarEvents([{ name: '저스텍', kind: 'IPO', brokers: ['삼성'], subStart: '2026-06-19' }])
    expect(ev).toHaveLength(1)
    expect(ev[0].key).toBe('저스텍|청약')
  })
})

describe('renderAppleScript', () => {
  const script = renderAppleScript(buildCalendarEvents([LEMON]), 'HaAnn')

  it('날짜 핸들러와 캘린더 tell 포함', () => {
    expect(script).toContain('on _mkdate(y, m, d, hh, mm, ss)')
    expect(script).toContain('tell calendar "HaAnn"')
  })
  it('numeric date setter 사용(locale 안전)', () => {
    expect(script).toContain('set sd to my _mkdate(2026, 6, 25, 0, 0, 0)')
    expect(script).toContain('set ed to my _mkdate(2026, 6, 25, 23, 59, 59)')
  })
  it('upsert: 태그로 기존 이벤트 탐색 후 분기', () => {
    expect(script).toContain('every event whose description contains "[ipo-sync:레몬헬스케어|청약]"')
    expect(script).toContain('make new event at end of events with properties')
  })
  it('큰따옴표 이스케이프', () => {
    const s = renderAppleScript(
      [{ key: 'X|청약', summary: '청약 "테스트"', date: '2026-01-02', description: 't' }], 'HaAnn')
    expect(s).toContain('\\"테스트\\"')
  })
})

/**
 * 일정 공지 어댑터 — 운영자가 매일/매주 올리는 "공모주 일정"을 이벤트로 정규화.
 *
 * 지원 포맷 2종 (서초감자 소통방 실제 공지 기준):
 *
 *  ① 일간:
 *     6월 25일 목요일 공모주 일정
 *     상장: x
 *     청약: 레몬헬스케어(KB)
 *     환불: 한국제16호스팩(한국)
 *     이체: x
 *
 *  ② 주간:
 *     [1월 5일 ~ 9일 공모주 일정 안내]
 *     월요일
 *     상장: x ...
 *     화요일
 *     ...
 *
 * 헤더에 연도가 없어 메시지 수신 시각(receivedAt)으로 연도를 추론한다(연말→연초 롤오버 처리).
 * 값이 x/-/없음이면 이벤트 없음. 종목은 "이름(증권사)" 또는 콤마/슬래시로 다건.
 */
import {
  type IpoScheduleEvent, type ScheduleNoticeInput, type ScheduleOffering,
  LABEL_TO_KIND,
} from './types'

const WEEKDAY_OFFSET: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 }

// "톡게시판 '공지':" 같은 접두 제거
const PREFIX_RE = /^\s*톡게시판\s*['"]?공지['"]?\s*[:：]\s*/

const DAILY_HEADER_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*[월화수목금토일]요일\s*공모주\s*일정/
const WEEKLY_HEADER_RE = /\[?\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*~\s*(?:\d{1,2}\s*월\s*)?\d{1,2}\s*일\s*공모주\s*일정\s*안내/
const WEEKDAY_LINE_RE = /^\s*([월화수목금토일])요일\s*$/
const LABEL_LINE_RE = /^\s*(상장|청약|환불|이체)\s*[:：]\s*(.*)$/
const EMPTY_VALUE_RE = /^(x|X|-|–|없음|없습니다|없어요|없네요|0)$/

/** "YYYY-MM-DD" 포맷. */
function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** receivedAt + 공지 월로 연도 추론. 12월에 올린 1월 공지 → +1년. */
export function resolveYear(noticeMonth: number, receivedAt: string): number {
  const m = (receivedAt ?? '').match(/(\d{4})-(\d{1,2})/)
  const baseY = m ? parseInt(m[1]) : new Date().getFullYear()
  const baseM = m ? parseInt(m[2]) : noticeMonth
  if (baseM - noticeMonth >= 6) return baseY + 1   // 12월 공지 → 1월 일정
  if (noticeMonth - baseM >= 6) return baseY - 1   // (역방향 방어)
  return baseY
}

/** (y,m,d)에 n일 더한 날짜를 "YYYY-MM-DD"로. 월/연 경계는 UTC Date로 안전 처리. */
function addDays(y: number, m: number, d: number, n: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/**
 * 증권사명으로 그럴듯한 토큰만 통과. 운영자가 괄호 안에 끼워넣는 자유텍스트
 * ("화요일 매도시" 등)를 거른다. 증권사명은 공백 없는 짧은 단일 토큰.
 */
function isPlausibleBroker(b: string): boolean {
  if (!b || b.length > 6 || /\s/.test(b)) return false
  return !/요일|매도|매수|환불|상장|청약|주의|필수|시$/.test(b)
}

/**
 * 콤마/슬래시로 종목을 나누되, **괄호 안 콤마는 건드리지 않는다**.
 * "케이뱅크(NH, 삼성, 신한)" 는 1개, "A(NH), B(삼성)" 는 2개로 분리.
 */
function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const c of s) {
    if (c === '(' || c === '（') { depth++; cur += c }
    else if (c === ')' || c === '）') { depth = Math.max(0, depth - 1); cur += c }
    else if (depth === 0 && (c === ',' || c === '，' || c === '/' || c === '·')) { out.push(cur); cur = '' }
    else cur += c
  }
  if (cur.trim()) out.push(cur)
  return out
}

/** 라벨 값 문자열 → 이벤트들. 종목당 증권사 다건은 brokers[]로. */
function parseValue(rawVal: string, kind: IpoScheduleEvent['kind'], date: string): IpoScheduleEvent[] {
  const v = rawVal.trim()
  if (!v || EMPTY_VALUE_RE.test(v)) return []
  return splitTopLevel(v)
    .map(s => s.trim())
    .filter(Boolean)
    .map(item => {
      const pm = item.match(/^(.+?)\s*[(（]\s*(.+?)\s*[)）]\s*$/)
      const brokers = pm
        ? pm[2].split(/\s*[,，/·]\s*/).map(b => b.trim()).filter(isPlausibleBroker)
        : []
      return { date, kind, stockName: (pm ? pm[1] : item).trim(), brokers, raw: item }
    })
    .filter(e => e.stockName.length > 0)
}

/** 일정 공지인가? (헤더 + 라벨 최소 1개) */
export function isScheduleNotice(text: string): boolean {
  const t = text.replace(PREFIX_RE, '')
  const hasHeader = DAILY_HEADER_RE.test(t) || WEEKLY_HEADER_RE.test(t)
  if (!hasHeader) return false
  return t.split(/\r?\n/).some(l => LABEL_LINE_RE.test(l))
}

/**
 * 공지 텍스트 → IpoScheduleEvent[].
 * 일정이 전부 x("방학")면 빈 배열(공지이긴 함).
 */
export function parseScheduleNotice(input: ScheduleNoticeInput): IpoScheduleEvent[] {
  const text = input.text.replace(PREFIX_RE, '')
  const lines = text.split(/\r?\n/)
  const events: IpoScheduleEvent[] = []

  const weekly = WEEKLY_HEADER_RE.exec(text)
  if (weekly) {
    const startMonth = parseInt(weekly[1])
    const startDay = parseInt(weekly[2])
    const year = resolveYear(startMonth, input.receivedAt)
    let currentDate: string | null = null
    for (const line of lines) {
      const wd = WEEKDAY_LINE_RE.exec(line)
      if (wd) { currentDate = addDays(year, startMonth, startDay, WEEKDAY_OFFSET[wd[1]]); continue }
      const lab = LABEL_LINE_RE.exec(line)
      if (lab && currentDate) events.push(...parseValue(lab[2], LABEL_TO_KIND[lab[1]], currentDate))
    }
    return events
  }

  const daily = DAILY_HEADER_RE.exec(text)
  if (daily) {
    const month = parseInt(daily[1])
    const day = parseInt(daily[2])
    const year = resolveYear(month, input.receivedAt)
    const date = fmt(year, month, day)
    for (const line of lines) {
      const lab = LABEL_LINE_RE.exec(line)
      if (lab) events.push(...parseValue(lab[2], LABEL_TO_KIND[lab[1]], date))
    }
    return events
  }

  return events
}

/**
 * 이벤트들을 종목 단위로 접어 부분 Offering으로. 여러 날의 공지를 누적하면
 * 한 종목의 청약~환불~상장 일정이 점진적으로 채워진다.
 */
export function mergeEventsToOfferings(events: IpoScheduleEvent[]): ScheduleOffering[] {
  const byName = new Map<string, ScheduleOffering>()
  for (const e of events) {
    const key = e.stockName.replace(/\s+/g, '')
    let o = byName.get(key)
    if (!o) {
      o = { name: e.stockName, kind: /스팩/.test(e.stockName) ? 'SPAC' : 'IPO', brokers: [] }
      byName.set(key, o)
    }
    for (const b of e.brokers) if (!o.brokers.includes(b)) o.brokers.push(b)
    switch (e.kind) {
      case 'SUBSCRIPTION':
        if (!o.subStart || e.date < o.subStart) o.subStart = e.date
        if (!o.subEnd || e.date > o.subEnd) o.subEnd = e.date
        break
      case 'REFUND':   o.refundDate = e.date; break
      case 'LISTING':  o.listingDate = e.date; break
      case 'TRANSFER': o.transferDate = e.date; break
    }
  }
  return [...byName.values()]
}

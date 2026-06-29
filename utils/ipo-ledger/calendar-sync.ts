/**
 * 공모주 일정 → iCloud 캘린더 동기화.
 *
 * ScheduleOffering[] (schedule-notice 어댑터 출력) → 캘린더 이벤트 →
 * macOS Calendar.app AppleScript(osascript)로 upsert. iCloud HaAnn 등
 * Google Calendar MCP가 못 만지는 캘린더에 직접 쓴다.
 *
 * 멱등성: 각 이벤트 description에 [ipo-sync:종목|종류] 태그를 심고, 같은 태그가
 * 있으면 날짜만 갱신(operator의 일정 연기 대응), 없으면 생성. 재실행해도 중복 X.
 *
 * 패턴 출처: vault `reference-icloud-calendar-applescript.md` (numeric date setter,
 * UID/태그 식별, 권한: 시스템설정→개인정보보호→자동화→Calendar).
 */
import { execFileSync } from 'node:child_process'
import type { ScheduleOffering } from './types'

export interface CalendarEvent {
  key: string          // 멱등 키 "종목|종류" — description 태그로 박힘
  summary: string      // 캘린더 제목
  date: string         // "YYYY-MM-DD"
  description: string  // 태그 포함
}

export interface BuildOptions {
  /** 이 날짜(YYYY-MM-DD) 이상만 생성. 기본 무제한(과거 포함). */
  from?: string
}

/** 종목 1개 → 캘린더 이벤트들(채워진 날짜 필드만). 순수 함수. */
export function buildCalendarEvents(offerings: ScheduleOffering[], opts: BuildOptions = {}): CalendarEvent[] {
  const from = opts.from
  const out: CalendarEvent[] = []
  const brokerStr = (o: ScheduleOffering) => (o.brokers.length ? ` (${o.brokers.join(',')})` : '')

  const push = (o: ScheduleOffering, kind: string, date: string | undefined, summary: string, note: string) => {
    if (!date) return
    if (from && date < from) return
    const key = `${o.name}|${kind}`
    out.push({
      key, summary, date,
      description: [note, `[ipo-sync:${key}]`].filter(Boolean).join(' · '),
    })
  }

  for (const o of offerings) {
    const meta = `${o.kind}${brokerStr(o)} · 환불 ${o.refundDate ?? '-'} · 상장 ${o.listingDate ?? '-'}`
    push(o, '청약', o.subStart, `📈 청약 ${o.name}${brokerStr(o)}`, meta)
    push(o, '환불', o.refundDate, `💰 환불 ${o.name}${brokerStr(o)}`, meta)
    push(o, '상장·매도', o.listingDate, `🔔 상장·매도 ${o.name}${brokerStr(o)}`, meta)
    push(o, '이체', o.transferDate, `↔️ 이체 ${o.name}${brokerStr(o)}`, meta)
  }
  return out
}

/** AppleScript 문자열 리터럴 이스케이프. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** 이벤트들 → upsert AppleScript. 순수 함수(osacompile로 문법 검증 가능). */
export function renderAppleScript(events: CalendarEvent[], calendarName: string): string {
  const blocks = events.map(e => {
    const [y, m, d] = e.date.split('-').map(Number)
    const tag = `[ipo-sync:${e.key}]`
    return `    set sd to my _mkdate(${y}, ${m}, ${d}, 0, 0, 0)
    set ed to my _mkdate(${y}, ${m}, ${d}, 23, 59, 59)
    set _ms to (every event whose description contains "${esc(tag)}")
    if (count of _ms) > 0 then
      set _ev to item 1 of _ms
      set start date of _ev to sd
      set end date of _ev to ed
      set summary of _ev to "${esc(e.summary)}"
      set description of _ev to "${esc(e.description)}"
    else
      make new event at end of events with properties {summary:"${esc(e.summary)}", start date:sd, end date:ed, allday event:true, description:"${esc(e.description)}"}
    end if`
  }).join('\n')

  return `on _mkdate(y, m, d, hh, mm, ss)
  set dt to (current date)
  set day of dt to 1
  set year of dt to y
  set month of dt to m
  set day of dt to d
  set hours of dt to hh
  set minutes of dt to mm
  set seconds of dt to ss
  return dt
end _mkdate

tell application "Calendar"
  tell calendar "${esc(calendarName)}"
${blocks}
  end tell
end tell
return "ipo-sync ok: ${events.length} events"`
}

/** 실제 동기화 실행(macOS 전용). 생성/갱신 개수 메시지 반환. */
export function syncToICloud(events: CalendarEvent[], calendarName = 'HaAnn'): string {
  if (events.length === 0) return 'ipo-sync: 대상 이벤트 없음'
  const script = renderAppleScript(events, calendarName)
  return execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim()
}

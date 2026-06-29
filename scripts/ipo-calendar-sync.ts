/**
 * 공모주 일정 → iCloud 캘린더 동기화 CLI.
 *
 * 카톡 일정 공지(CSV) → schedule-notice 어댑터 → 캘린더 이벤트 upsert.
 *
 * 사용:
 *   npx tsx scripts/ipo-calendar-sync.ts --csv <카톡.csv>           # dry-run(기본)
 *   npx tsx scripts/ipo-calendar-sync.ts --csv <카톡.csv> --apply   # 실제 동기화
 *   옵션: --calendar HaAnn  --from 2026-06-29  --all(과거 포함)  --user 서초감자
 *
 * dry-run은 이벤트 목록 + 생성된 AppleScript 문법검증(osacompile)만, 캘린더 변경 X.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { isScheduleNotice, parseScheduleNotice, mergeEventsToOfferings } from '../utils/ipo-ledger/schedule-notice'
import { buildCalendarEvents, renderAppleScript, syncToICloud } from '../utils/ipo-ledger/calendar-sync'

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def
}
const has = (name: string) => process.argv.includes(`--${name}`)

/** 카톡 CSV 미니 파서(따옴표·멀티라인·"" 이스케이프). */
function parseCsv(s: string): string[][] {
  const out: string[][] = []
  let row: string[] = [], field = '', inQ = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); out.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field || row.length) { row.push(field); out.push(row) }
  return out
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function main() {
  const csv = arg('csv')
  if (!csv) { console.error('필요: --csv <카톡 CSV 경로>'); process.exit(1) }
  const calendar = arg('calendar', '공모주_현금흐름')!
  const userFilter = arg('user', '서초감자')!
  const from = has('all') ? undefined : arg('from', todayISO())
  const apply = has('apply')

  const records = parseCsv(fs.readFileSync(csv, 'utf8'))
  const header = records[0]
  const di = header.indexOf('Date'), ui = header.indexOf('User'), mi = header.indexOf('Message')

  const events = []
  let noticeCount = 0
  for (let k = 1; k < records.length; k++) {
    const r = records[k]
    const user = r[ui] ?? '', text = r[mi] ?? '', date = r[di] ?? ''
    if (!user.includes(userFilter)) continue
    if (!isScheduleNotice(text)) continue
    noticeCount++
    events.push(...parseScheduleNotice({ text, receivedAt: date }))
  }

  const offerings = mergeEventsToOfferings(events)
  const calEvents = buildCalendarEvents(offerings, { from })

  console.log(`공지 ${noticeCount}건 → 종목 ${offerings.length}개 → 캘린더 이벤트 ${calEvents.length}건`)
  console.log(`캘린더="${calendar}"  from=${from ?? '(전체)'}  mode=${apply ? 'APPLY' : 'DRY-RUN'}\n`)
  for (const e of calEvents) console.log(`  ${e.date}  ${e.summary}`)

  if (calEvents.length === 0) { console.log('\n동기화할 이벤트 없음.'); return }

  if (!apply) {
    // 문법 검증: osacompile로 컴파일만(실행 X) → 캘린더 변경 없음
    const script = renderAppleScript(calEvents, calendar)
    const f = path.join(os.tmpdir(), 'ipo-sync-dryrun.applescript')
    fs.writeFileSync(f, script)
    try {
      execFileSync('osacompile', ['-o', path.join(os.tmpdir(), 'ipo-sync-dryrun.scpt'), f], { stdio: 'pipe' })
      console.log(`\n✅ DRY-RUN: AppleScript 문법 검증 통과 (${f})`)
      console.log('   실제 반영하려면 --apply 추가.')
    } catch (err: any) {
      console.error('\n❌ AppleScript 컴파일 실패:\n', err.stderr?.toString() ?? err.message)
      process.exit(1)
    }
    return
  }

  console.log('\n' + syncToICloud(calEvents, calendar))
}

main()

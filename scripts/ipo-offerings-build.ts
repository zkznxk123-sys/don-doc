/**
 * 카톡 일정 공지(CSV) → schedule-notice 어댑터 → 실 종목/일정 데이터 생성.
 *
 * 산출물: components/ipo/offerings.generated.ts (보드가 import).
 * 새 공지가 쌓이면 이 스크립트만 다시 돌리면 보드가 갱신된다.
 *
 *   npx tsx scripts/ipo-offerings-build.ts --csv <카톡.csv>
 *   옵션: --user 서초감자  --out components/ipo/offerings.generated.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { isScheduleNotice, parseScheduleNotice, mergeEventsToOfferings } from '../utils/ipo-ledger/schedule-notice'

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def
}

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
  const userFilter = arg('user', '서초감자')!
  const out = arg('out', 'components/ipo/offerings.generated.ts')!

  const records = parseCsv(fs.readFileSync(csv, 'utf8'))
  const header = records[0]
  const di = header.indexOf('Date'), ui = header.indexOf('User'), mi = header.indexOf('Message')

  const events = []
  for (let k = 1; k < records.length; k++) {
    const r = records[k]
    if (!(r[ui] ?? '').includes(userFilter)) continue
    if (!isScheduleNotice(r[mi] ?? '')) continue
    events.push(...parseScheduleNotice({ text: r[mi] ?? '', receivedAt: r[di] ?? '' }))
  }

  // 일정이 1개라도 채워진 종목만, 청약 시작일 순
  const offerings = mergeEventsToOfferings(events)
    .filter(o => o.subStart || o.refundDate || o.listingDate)
    .sort((a, b) => ((a.subStart ?? a.listingDate ?? '') < (b.subStart ?? b.listingDate ?? '') ? -1 : 1))

  const body = `// AUTO-GENERATED — 편집 금지. 재생성: npx tsx scripts/ipo-offerings-build.ts --csv <카톡.csv>
import type { UpcomingOffering } from './board-data'

export const GENERATED_AT = '${todayISO()}'
export const SOURCE = ${JSON.stringify(path.basename(csv))}

/** schedule-notice 어댑터가 실 카톡 공지에서 추출한 종목·일정. */
export const GENERATED_OFFERINGS: UpcomingOffering[] = ${JSON.stringify(offerings, null, 2)}
`
  const outPath = path.resolve(out)
  fs.writeFileSync(outPath, body)
  console.log(`✅ ${offerings.length}개 종목 → ${out} (생성 ${todayISO()})`)
  const upcoming = offerings.filter(o => (o.subStart ?? o.refundDate ?? o.listingDate ?? '') >= todayISO())
  console.log(`   다가올(오늘 이후): ${upcoming.length}개`)
}

main()

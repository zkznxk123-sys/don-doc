/**
 * 공모주 일정 생성 — 38커뮤니케이션(38.co.kr) 청약·상장 페이지에서 직접.
 *
 * IPO_calander(Google Apps Script)와 동일 소스. 카톡 CSV 스냅샷을 대체해
 * don-doc 일정을 살아있는 1차 소스로 만든다. 재실행만 하면 최신 일정 반영.
 *
 *   npx tsx scripts/ipo-schedule-build.ts
 * 산출물: components/ipo/offerings.generated.ts (앱이 그대로 소비)
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const URL_CHEONGYAK = 'http://www.38.co.kr/html/fund/index.htm?o=kk'  // 공모주 청약일정
const URL_SANGJANG = 'http://www.38.co.kr/html/fund/index.htm?o=nw'   // 신규상장

const BROKER_MAP: Record<string, string> = {
  '한국투자증권': '한국', '미래에셋증권': '미래', 'NH투자증권': 'NH', '삼성증권': '삼성',
  '신한투자증권': '신한', 'KB증권': 'KB', '대신증권': '대신', '키움증권': '키움',
  '유진투자증권': '유진', '교보증권': '교보', '하나증권': '하나', '현대차증권': '현대차',
  '신영증권': '신영', '한화투자증권': '한화', 'DB금융투자': 'DB', 'DB증권': 'DB',
  '메리츠증권': '메리츠', 'IBK투자증권': 'IBK', '유안타증권': '유안타', 'BNK투자증권': 'BNK',
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchEucKr(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return new TextDecoder('euc-kr').decode(Buffer.from(await res.arrayBuffer()))
}

const strip = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
const cellsOf = (row: string) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1])
const companyOf = (cell: string) => {
  const a = cell.match(/<a[^>]*>([\s\S]*?)<\/a>/)
  return strip(a ? a[1] : cell)
}
const shortenBrokers = (s: string) =>
  s.split(/[,，]/).map(b => { const c = b.trim(); return BROKER_MAP[c] ?? c }).filter(Boolean)

interface Offering {
  name: string; kind: 'IPO' | 'SPAC'; brokers: string[]
  subStart?: string; subEnd?: string; refundDate?: string; listingDate?: string
}

async function main() {
  const offerings = new Map<string, Offering>()
  const get = (name: string): Offering => {
    let o = offerings.get(name)
    if (!o) { o = { name, kind: /스팩/.test(name) ? 'SPAC' : 'IPO', brokers: [] }; offerings.set(name, o) }
    return o
  }

  // 청약: YYYY.MM.DD ~ MM.DD
  const kk = await fetchEucKr(URL_CHEONGYAK)
  for (const row of kk.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const c = cellsOf(row)
    if (c.length < 6) continue
    const dm = strip(c[1]).match(/(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})/)
    if (!dm) continue
    const name = companyOf(c[0]); if (!name) continue
    const [, y, sm, sd, em, ed] = dm
    const o = get(name)
    o.subStart = `${y}-${sm}-${sd}`
    o.subEnd = `${y}-${em}-${ed}`
    o.brokers = shortenBrokers(strip(c[5]))
  }

  // 상장: YYYY/MM/DD
  const nw = await fetchEucKr(URL_SANGJANG)
  for (const row of nw.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const c = cellsOf(row)
    if (c.length < 5) continue
    const dm = strip(c[1]).match(/(\d{4})\/(\d{2})\/(\d{2})/)
    if (!dm) continue
    const name = companyOf(c[0]); if (!name) continue
    get(name).listingDate = `${dm[1]}-${dm[2]}-${dm[3]}`
  }

  const list = [...offerings.values()]
    .filter(o => o.subStart || o.listingDate)
    .sort((a, b) => ((a.subStart ?? a.listingDate ?? '') < (b.subStart ?? b.listingDate ?? '') ? -1 : 1))

  const body = `// AUTO-GENERATED — 편집 금지. 재생성: npx tsx scripts/ipo-schedule-build.ts
import type { UpcomingOffering } from './board-data'

export const GENERATED_AT = '${todayISO()}'
export const SOURCE = '38커뮤니케이션 (38.co.kr) 청약·상장'

/** 38.co.kr에서 추출한 공모주·스팩 청약/상장 일정. (환불일은 38 미제공) */
export const GENERATED_OFFERINGS: UpcomingOffering[] = ${JSON.stringify(list, null, 2)}
`
  fs.writeFileSync(path.resolve('components/ipo/offerings.generated.ts'), body)
  const upcoming = list.filter(o => (o.subStart ?? o.listingDate ?? '') >= todayISO()).length
  console.log(`✅ ${list.length}종목 → offerings.generated.ts (${todayISO()}) · 다가올 ${upcoming}`)
}

main()

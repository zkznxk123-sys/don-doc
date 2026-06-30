/**
 * DART(opendart) 증권신고서 enrichment — 38 미제공 필드 자동 수집.
 *
 * - 시가총액·유통금액·유통가능비율: 증권신고서(지분증권) 본문 "상장일 유통가능" 표 파싱
 *   (유통가능주식수 + 비율 → 시총=공모가×총주식, 유통금액=공모가×유통주식).
 * - 환매청구권: estkRs 구조화 API(일반청약자환매청구권).
 *
 * corpCode.xml(29MB)은 /tmp에 7일 캐시. document.xml은 UTF-8 zip(fflate 해제).
 * 키: don-doc .env.local DART_API_KEY.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { unzipSync } from 'fflate'

const dec = new TextDecoder('utf-8')
const BASE = 'https://opendart.fss.or.kr/api'

async function fetchBuf(url: string): Promise<Uint8Array> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

/** .env.local에서 DART_API_KEY 읽기. */
export function loadDartKey(): string | null {
  try {
    const env = fs.readFileSync(path.resolve('.env.local'), 'utf8')
    return env.match(/^DART_API_KEY=(.+)$/m)?.[1]?.trim().replace(/['"]/g, '') ?? null
  } catch { return null }
}

let corpMap: Map<string, string> | null = null
async function loadCorpMap(key: string): Promise<Map<string, string>> {
  if (corpMap) return corpMap
  const cache = path.join(os.tmpdir(), 'dart_corpcode.xml')
  let xml: string
  if (fs.existsSync(cache) && Date.now() - fs.statSync(cache).mtimeMs < 7 * 864e5) {
    xml = fs.readFileSync(cache, 'utf8')
  } else {
    const zip = unzipSync(await fetchBuf(`${BASE}/corpCode.xml?crtfc_key=${key}`))
    xml = dec.decode(Object.values(zip)[0])
    fs.writeFileSync(cache, xml)
  }
  const m = new Map<string, string>()
  for (const blk of xml.match(/<list>[\s\S]*?<\/list>/g) ?? []) {
    const nm = blk.match(/<corp_name>(.*?)<\/corp_name>/)?.[1]?.trim()
    const cc = blk.match(/<corp_code>(.*?)<\/corp_code>/)?.[1]
    if (nm && cc && !m.has(nm)) m.set(nm, cc)
  }
  corpMap = m
  return m
}

async function secregRcepts(key: string, cc: string): Promise<string[]> {
  const j = JSON.parse(dec.decode(await fetchBuf(`${BASE}/list.json?crtfc_key=${key}&corp_code=${cc}&bgn_de=20260101&end_de=20261231&page_count=100`)))
  return (j.list ?? [])
    .filter((it: any) => String(it.report_nm).includes('증권신고서(지분증권)'))
    .map((it: any) => it.rcept_no as string)
}

/** 증권신고서 본문 "상장일 유통가능" 표 → 유통비율·유통금액·시총. */
async function parseCirculation(key: string, rcept: string, ipoPrice?: number) {
  let t: string
  try {
    const zip = unzipSync(await fetchBuf(`${BASE}/document.xml?crtfc_key=${key}&rcept_no=${rcept}`))
    t = Object.values(zip).map(b => dec.decode(b)).join(' ')
  } catch { return null }
  const i = t.indexOf('상장일 유통가능')
  if (i < 0) return null
  const flat = t.slice(i, i + 300).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const mm = flat.match(/([\d,]{5,})\s*([\d.]+)\s*%/)
  if (!mm) return null
  const shares = parseInt(mm[1].replace(/,/g, ''), 10)
  const ratio = parseFloat(mm[2])
  if (!shares || !ratio) return null
  const out: { floatRatio: number; floatAmountEok?: number; marketCapEok?: number } = { floatRatio: Math.round(ratio * 100) / 100 }
  if (ipoPrice) {
    out.floatAmountEok = Math.round((ipoPrice * shares) / 1e8)
    out.marketCapEok = Math.round((ipoPrice * (shares / (ratio / 100))) / 1e8)
  }
  return out
}

/** estkRs 일반청약자환매청구권 → O/X. */
async function redemptionRight(key: string, cc: string): Promise<boolean | undefined> {
  try {
    const j = JSON.parse(dec.decode(await fetchBuf(`${BASE}/estkRs.json?crtfc_key=${key}&corp_code=${cc}&bgn_de=20260101&end_de=20261231`)))
    const grp = (j.group ?? []).find((g: any) => g.title === '일반청약자환매청구권')
    const row = grp?.list?.[0]
    if (!row) return undefined
    return !(row.exprc === '-' && row.grtcnt === '-')
  } catch { return undefined }
}

interface Enrichable {
  name: string; ipoPrice?: number
  marketCapEok?: number; floatAmountEok?: number; floatRatio?: number; redemptionRight?: boolean
}

/** 수요예측 완료(공모가 확정) 종목만 DART enrichment. 실패는 건너뜀. */
export async function enrichFromDart(offerings: Enrichable[], key: string): Promise<number> {
  const corp = await loadCorpMap(key)
  let enriched = 0
  for (const o of offerings) {
    if (!o.ipoPrice) continue   // 수요예측 전이면 유통 표 의미 없음
    const cc = corp.get(o.name)
    if (!cc) continue
    try {
      for (const r of await secregRcepts(key, cc)) {
        const c = await parseCirculation(key, r, o.ipoPrice)
        if (c) { Object.assign(o, c); enriched++; break }
      }
      const rr = await redemptionRight(key, cc)
      if (rr !== undefined) o.redemptionRight = rr
    } catch { /* 개별 실패 무시 */ }
  }
  return enriched
}

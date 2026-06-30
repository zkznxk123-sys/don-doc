/**
 * 스팩 전체 유니버스 생성 — KRX 상장법인목록에서 이름에 "스팩" 포함 종목 추출.
 * KRX 종목코드(예: 0130D0)는 네이버 시세 API와 동일 포맷 → 시세 조회에 바로 사용.
 *
 *   npx tsx scripts/ipo-spac-universe-build.ts
 * 산출물: components/ipo/spac-universe.generated.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const URL = 'https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function main() {
  const res = await fetch(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage' },
  })
  if (!res.ok) { console.error('KRX fetch 실패', res.status); process.exit(1) }
  const html = new TextDecoder('euc-kr').decode(Buffer.from(await res.arrayBuffer()))

  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
  const spacs: { name: string; code: string; market: string }[] = []
  for (const [, r] of rows) {
    const cols = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map(m => m[1].replace(/<[^>]*>|&nbsp;/g, '').trim())
    if (cols.length >= 3 && cols[0].includes('스팩')) {
      spacs.push({ name: cols[0], code: cols[2], market: cols[1] })
    }
  }
  spacs.sort((a, b) => (a.name < b.name ? -1 : 1))

  const body = `// AUTO-GENERATED — 편집 금지. 재생성: npx tsx scripts/ipo-spac-universe-build.ts
// 출처: KRX 상장법인목록(kind.krx.co.kr). 코드는 네이버 시세 API 호환.

export interface SpacUniverseItem { name: string; code: string; market: string }

export const SPAC_UNIVERSE_AT = '${todayISO()}'
export const SPAC_UNIVERSE: SpacUniverseItem[] = ${JSON.stringify(spacs, null, 2)}
`
  const out = path.resolve('components/ipo/spac-universe.generated.ts')
  fs.writeFileSync(out, body)
  console.log(`✅ 스팩 ${spacs.length}종목 → components/ipo/spac-universe.generated.ts (${todayISO()})`)
}

main()

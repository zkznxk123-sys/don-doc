/**
 * KIS ETF 구성종목시세[국내주식-073] 호출 공통 클라이언트.
 * 국내·해외 ETF 모두 output1(요약: 시장가·NAV·CU좌수)을 주고, 국내만 output2(구성종목 상위30)를 준다.
 * ⚠️ 이 API는 "모의투자 미지원" — 실전 앱키 필요(모의 앱키는 output2 0건).
 *    KIS_REAL_APP_KEY/SECRET 우선, 없으면 실전 모드(KIS_IS_MOCK!=='true')의 KIS_APP_KEY.
 */

const BASE = 'https://openapi.koreainvestment.com:9443'

let cached: { token: string; expMs: number } | null = null

function realKeys(): { key: string; secret: string } | null {
  const key = process.env.KIS_REAL_APP_KEY || (process.env.KIS_IS_MOCK !== 'true' ? process.env.KIS_APP_KEY : '')
  const secret = process.env.KIS_REAL_APP_SECRET || (process.env.KIS_IS_MOCK !== 'true' ? process.env.KIS_APP_SECRET : '')
  return key && secret ? { key, secret } : null
}

async function token(): Promise<string | null> {
  const k = realKeys()
  if (!k) return null
  if (cached && cached.expMs > Date.now() + 60_000) return cached.token
  try {
    const res = await fetch(`${BASE}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: k.key, appsecret: k.secret }),
      cache: 'no-store',
    })
    const j = await res.json()
    if (!j.access_token) return null
    cached = { token: j.access_token, expMs: Date.now() + (j.expires_in ?? 86400) * 1000 }
    return cached.token
  } catch {
    return null
  }
}

export interface KisEtfSnapshot {
  output1: Record<string, string>          // 요약(시장가·NAV·CU좌수·구성종목수 등)
  output2: Array<Record<string, string>>   // 구성종목(국내 상위30, 해외 0건)
}

/** ETF 종목코드로 073 조회. 실전 키 없거나 실패 시 null. */
export async function fetchEtfSnapshot(etfCode: string): Promise<KisEtfSnapshot | null> {
  const t = await token()
  if (!t) return null
  try {
    const url = new URL(`${BASE}/uapi/etfetn/v1/quotations/inquire-component-stock-price`)
    url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J')
    url.searchParams.set('FID_INPUT_ISCD', etfCode)
    url.searchParams.set('FID_COND_SCR_DIV_CODE', '11216')
    const res = await fetch(url, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${t}`,
        appkey: realKeys()!.key,
        appsecret: realKeys()!.secret,
        tr_id: 'FHKST121600C0',
        custtype: 'P',
      },
      cache: 'no-store',
    })
    const j = await res.json()
    if (j.rt_cd !== '0') return null
    return { output1: j.output1 ?? {}, output2: Array.isArray(j.output2) ? j.output2 : [] }
  } catch {
    return null
  }
}

export function hasRealKis(): boolean {
  return realKeys() !== null
}

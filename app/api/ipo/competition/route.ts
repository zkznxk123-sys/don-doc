export const dynamic = 'force-dynamic'

/**
 * 공모주 청약경쟁률 프록시 (38.co.kr, 키 없음).
 * 브라우저 CORS·EUC-KR 우회용 서버 라우트. 공개 데이터만 읽음. 배정 계산기에서 호출.
 *
 * POST { no38?: string, name?: string } → { competition, integrated, asOf, source, basis }
 *  - competition = 비례경쟁률(계산기 입력값). integrated = 통합경쟁률(참고).
 *  - 마감 후 상세(o=v)의 확정 경쟁률을 읽는다. 청약 진행 중 실시간은 다음 실 청약 때 o=r 파싱 추가 예정.
 *  - asOf = 서버가 38을 읽은 시각(ISO). 값 못 찾으면 competition=null.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { blockIpoIfNotEntitled } from '@/lib/feature-flags'

const HEADERS = { Referer: 'http://www.38.co.kr/', 'User-Agent': 'Mozilla/5.0' }

/** EUC-KR HTML 디코드. ICU 없으면 latin1 폴백(한글 깨지지만 숫자 파싱은 유지). */
function decode(buf: ArrayBuffer): string {
  try { return new TextDecoder('euc-kr').decode(buf) }
  catch { return new TextDecoder('latin1').decode(buf) }
}

/** "1510.57:1 (비례 3021:1)" → { integrated: 1510.57, competition: 3021 }. 비례 없으면 통합값 사용. */
function parseCompetition(html: string): { competition: number | null; integrated: number | null } {
  const idx = html.indexOf('청약경쟁률')
  if (idx < 0) return { competition: null, integrated: null }
  const text = html.slice(idx, idx + 400).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
  const num = (s?: string) => (s ? Number(s.replace(/,/g, '')) : null)
  const prop = text.match(/비례\s*([\d,]+(?:\.\d+)?)\s*:\s*1/)
  const integ = text.match(/([\d,]+(?:\.\d+)?)\s*:\s*1/)
  const integrated = num(integ?.[1])
  const competition = num(prop?.[1]) ?? integrated   // 비례 우선, 없으면 통합
  return {
    competition: Number.isFinite(competition as number) ? competition : null,
    integrated: Number.isFinite(integrated as number) ? integrated : null,
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()       // 무인증 오픈 프록시 남용 차단
  if (!user?.familyId) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  // lite에선 cohort(초대) 보유자만 IPO API 사용 (2026-07-12 해금형 통합)
  const blocked = blockIpoIfNotEntitled(user.cohort)
  if (blocked) return blocked

  let body: { no38?: string; name?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const no38 = typeof body.no38 === 'string' ? body.no38.replace(/[^\d]/g, '') : ''
  if (!no38) return NextResponse.json({ error: 'no38 필요 — 38 상세 id 없는 종목은 자동 조회 불가' }, { status: 400 })

  const asOf = new Date().toISOString()
  try {
    const r = await fetch(`http://www.38.co.kr/html/fund/?o=v&no=${no38}`, { headers: HEADERS, cache: 'no-store' })
    if (!r.ok) return NextResponse.json({ competition: null, integrated: null, asOf, source: '38.co.kr', basis: 'confirmed', error: `38 응답 ${r.status}` }, { status: 502 })
    const html = decode(await r.arrayBuffer())
    const { competition, integrated } = parseCompetition(html)
    return NextResponse.json({ competition, integrated, asOf, source: '38.co.kr', basis: 'confirmed' })
  } catch {
    return NextResponse.json({ competition: null, integrated: null, asOf, source: '38.co.kr', basis: 'confirmed', error: '38 조회 실패' }, { status: 502 })
  }
}

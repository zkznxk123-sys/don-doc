export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

// 최근 실거래 데이터에서 단지명 목록 추출 (RTMSDataSvcAptTradeDev 재활용)
// GET /api/realestate/complexes?bjdCode=11140
// 응답: [{ name: '서울역센트럴자이', code: '' }]

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bjdCode = req.nextUrl.searchParams.get('bjdCode')
  if (!bjdCode) return NextResponse.json({ complexes: [] })

  const apiKey = process.env.MOLIT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'MOLIT_API_KEY 미설정' }, { status: 500 })

  const BASE_URL = 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev'
  const encodedKey = encodeURIComponent(decodeURIComponent(apiKey))

  // 최근 6개월 조회해서 단지명 수집
  const yearMonths: string[] = []
  const now = new Date()
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    yearMonths.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const nameSet = new Set<string>()

  await Promise.all(yearMonths.map(async (ym) => {
    try {
      const params = new URLSearchParams({
        LAWD_CD:   bjdCode,
        DEAL_YMD:  ym,
        numOfRows: '100',
        pageNo:    '1',
      })
      const res = await fetch(`${BASE_URL}?serviceKey=${encodedKey}&${params}`)
      const text = await res.text()

      const items = Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g))
      for (const [, xml] of items) {
        const name = xml.match(/<aptNm>([^<]*)<\/aptNm>/)?.[1]?.trim()
        if (name) nameSet.add(name)
      }
    } catch { /* 월별 실패 무시 */ }
  }))

  const complexes = Array.from(nameSet).sort().map(name => ({ name, code: '' }))
  console.log(`[complexes] bjdCode:${bjdCode} 수집 단지수:${complexes.length}`)

  return NextResponse.json({ complexes })
}

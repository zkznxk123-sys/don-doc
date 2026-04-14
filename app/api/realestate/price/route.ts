export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// 국토교통부 아파트 매매 실거래가 조회
// GET /api/realestate/price?bjdCode=11680&complexName=래미안원베일리&area=84&months=24

interface MolitItem {
  아파트: string
  전용면적: string
  거래금액: string
  년: string
  월: string
  일: string
  층: string
  법정동: string
}

function parsePrice(str: string): number {
  return parseInt(str.replace(/,/g, '').trim(), 10) * 10000 // 만원 → 원
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const bjdCode     = searchParams.get('bjdCode')
  const complexName = searchParams.get('complexName')
  const areaStr     = searchParams.get('area')
  const months      = parseInt(searchParams.get('months') ?? '24', 10)

  if (!bjdCode || !complexName) {
    return NextResponse.json({ error: 'bjdCode, complexName 필수' }, { status: 400 })
  }

  const apiKey = process.env.MOLIT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'MOLIT_API_KEY 미설정' }, { status: 500 })

  const targetArea = areaStr ? parseFloat(areaStr) : null

  // 최근 N개월 조회
  const yearMonths: string[] = []
  const now = new Date()
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    yearMonths.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const BASE_URL = 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'

  const results: { yearMonth: string; price: number; area: number; floor: number }[] = []

  // 월별 병렬 조회 (최대 6개월씩 나눠서)
  const chunks: string[][] = []
  for (let i = 0; i < yearMonths.length; i += 6) {
    chunks.push(yearMonths.slice(i, i + 6))
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (ym) => {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        LAWD_CD:    bjdCode,
        DEAL_YMD:   ym,
        numOfRows:  '100',
        pageNo:     '1',
      })
      try {
        const res = await fetch(`${BASE_URL}?${params}`)
        const text = await res.text()

        // XML 파싱 (간단 정규식)
        const items = Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g))
        for (const [, itemXml] of items) {
          const get = (tag: string) => {
            const m = itemXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
            return m ? m[1].trim() : ''
          }
          const name = get('아파트')
          // 단지명 유사 매칭 (공백/특수문자 제거 후 포함 여부)
          const normalize = (s: string) => s.replace(/[\s\-·]/g, '')
          if (!normalize(name).includes(normalize(complexName)) &&
              !normalize(complexName).includes(normalize(name))) continue

          const area  = parseFloat(get('전용면적') || '0')
          const price = parsePrice(get('거래금액') || '0')
          const floor = parseInt(get('층') || '0', 10)

          // 면적 필터: ±10㎡ 이내
          if (targetArea && Math.abs(area - targetArea) > 10) continue
          if (price <= 0) continue

          results.push({ yearMonth: ym, price, area, floor })
        }
      } catch (e) {
        console.error(`[molit] ${ym}`, e)
      }
    }))
  }

  // 월별 중앙값 집계
  const byMonth: Record<string, number[]> = {}
  for (const r of results) {
    if (!byMonth[r.yearMonth]) byMonth[r.yearMonth] = []
    byMonth[r.yearMonth].push(r.price)
  }

  const history = Object.entries(byMonth)
    .map(([yearMonth, prices]) => {
      prices.sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const median = prices.length % 2 === 0
        ? (prices[mid - 1] + prices[mid]) / 2
        : prices[mid]
      return { yearMonth, price: Math.round(median), count: prices.length }
    })
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))

  return NextResponse.json({ success: true, history, rawCount: results.length })
}

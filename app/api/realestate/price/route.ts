export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// 국토교통부 아파트 매매 실거래가 상세 조회 (RTMSDataSvcAptTradeDev)
// GET /api/realestate/price?bjdCode=11680&complexName=래미안원베일리&area=84&months=24

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

  // 상세 자료 엔드포인트 — 영문 태그 사용 (aptNm, excluUseAr, dealAmount, floor)
  const BASE_URL = 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev'
  // 공공데이터포털 키: 디코딩/인코딩 두 형태 모두 안전하게 처리
  const encodedKey = encodeURIComponent(decodeURIComponent(apiKey))

  const results: { yearMonth: string; price: number; area: number; floor: number }[] = []

  // 월별 병렬 조회 (6개월씩 청크)
  const chunks: string[][] = []
  for (let i = 0; i < yearMonths.length; i += 6) {
    chunks.push(yearMonths.slice(i, i + 6))
  }

  const normalize = (s: string) => s.replace(/[\s\-·]/g, '')

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (ym) => {
      const params = new URLSearchParams({
        LAWD_CD:   bjdCode,
        DEAL_YMD:  ym,
        numOfRows: '100',
        pageNo:    '1',
      })
      const url = `${BASE_URL}?serviceKey=${encodedKey}&${params}`
      try {
        const res = await fetch(url)
        const text = await res.text()

        // resultCode 000 = 정상, 그 외 오류
        const codeMatch = text.match(/<resultCode>([^<]*)<\/resultCode>/)
        const resultCode = codeMatch?.[1]?.trim()
        if (resultCode && resultCode !== '000' && resultCode !== '00') {
          const msgMatch = text.match(/<resultMsg>([^<]*)<\/resultMsg>/)
          console.error(`[molit price] ${ym} 오류 code:${resultCode} msg:${msgMatch?.[1]}`)
          return
        }

        const items = Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g))

        for (const [, itemXml] of items) {
          const get = (tag: string) =>
            itemXml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))?.[1]?.trim() ?? ''

          // 상세 API 영문 필드명
          const name  = get('aptNm')
          const area  = parseFloat(get('excluUseAr') || '0')
          const price = parsePrice(get('dealAmount') || '0')
          const floor = parseInt(get('floor') || '0', 10)

          // 단지명 유사 매칭
          if (!normalize(name).includes(normalize(complexName)) &&
              !normalize(complexName).includes(normalize(name))) continue

          // 면적 필터: ±10㎡ 이내
          if (targetArea && Math.abs(area - targetArea) > 10) continue
          if (price <= 0) continue

          // "202305" → "2023-05" 형식으로 변환 (차트/DB 통일 형식)
          const ymFormatted = `${ym.slice(0, 4)}-${ym.slice(4)}`
          results.push({ yearMonth: ymFormatted, price, area, floor })
        }
      } catch (e) {
        console.error(`[molit price] ${ym}`, e)
      }
    }))
  }

  console.log(`[molit price] 최종 rawCount: ${results.length}, complex: ${complexName}`)

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
      return {
        yearMonth,
        price:    Math.round(median),
        priceMin: prices[0],
        priceMax: prices[prices.length - 1],
        count:    prices.length,
      }
    })
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))

  return NextResponse.json({ success: true, history, rawCount: results.length })
}

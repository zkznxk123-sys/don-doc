/**
 * DART (전자공시) OpenAPI 통합.
 * - Yahoo가 한국 종목 PER/PBR 일부 missing → DART 재무제표로 보강
 * - 사용자가 발급한 DART_API_KEY env var 필요
 * - 키 없으면 graceful fail (Yahoo 단독 동작)
 *
 * Endpoints:
 *  - /api/list.json — stock_code로 corp_code 검색 (공시 리스트 1건만 받아도 충분)
 *  - /api/fnlttSinglAcntAll.json — 단일 회사 재무제표
 */

const DART_BASE = 'https://opendart.fss.or.kr/api'

export interface DartFundamental {
  stockCode: string
  corpCode: string
  corpName: string
  /** 당기순이익 (천원 단위) */
  netIncome: number | null
  /** 자본총계 (천원 단위) — PBR 계산에 사용 */
  totalEquity: number | null
  /** 매출액 */
  revenue: number | null
  /** 영업이익 */
  operatingIncome: number | null
  /** 시가총액 (DART에서 직접 안 줌, Yahoo 시총과 함께 계산) */
  /** 직접 계산된 PER (시총/순이익) */
  per: number | null
  /** 직접 계산된 PBR (시총/자본총계) */
  pbr: number | null
  /** ROE % (당기순이익/자본총계 × 100) */
  roe: number | null
  /** 보고서 종류 — 11011=사업보고서, 11012=반기보고서, 11013=1분기, 11014=3분기 */
  reportCode: string
  reportYear: number
  reportMonth: number  // 1-12
}

interface DartFinancialItem {
  rcept_no?: string
  reprt_code?: string
  bsns_year?: string
  corp_code?: string
  sj_div?: string       // 'BS' = 재무상태표, 'IS' = 손익계산서
  sj_nm?: string
  account_id?: string
  account_nm?: string   // 계정명 (한글)
  thstrm_nm?: string
  thstrm_amount?: string  // 당기 금액
  frmtrm_amount?: string  // 전기 금액
  bfefrmtrm_amount?: string
  ord?: string
  currency?: string
}

// in-memory cache: stockCode → corpCode (서버 instance 살아있는 동안 유지)
const corpCodeCache = new Map<string, { corpCode: string; corpName: string; ts: number }>()
const FUNDAMENTAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function isKoreanStockCode(code: string): boolean {
  // 6자리 숫자 (KR 종목코드)
  return /^\d{6}$/.test(code)
}

function getApiKey(): string | null {
  return process.env.DART_API_KEY ?? null
}

/**
 * stock_code(6자리)로 corp_code(8자리) 검색.
 * DART의 list.json endpoint는 stock_code 필터 + 공시 1건만 받아도 corp_code 알아낼 수 있음.
 * 없으면 null.
 */
export async function getDartCorpCode(stockCode: string): Promise<{ corpCode: string; corpName: string } | null> {
  if (!isKoreanStockCode(stockCode)) return null

  const cached = corpCodeCache.get(stockCode)
  if (cached && Date.now() - cached.ts < FUNDAMENTAL_CACHE_TTL_MS) {
    return { corpCode: cached.corpCode, corpName: cached.corpName }
  }

  const key = getApiKey()
  if (!key) return null

  try {
    // corp_code 없이 stock_code 검색은 3개월 한도. 최근 3개월로 제한.
    const today = new Date()
    const threeMonthsAgo = new Date(today)
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

    const url = `${DART_BASE}/list.json?crtfc_key=${key}&stock_code=${stockCode}&bgn_de=${fmt(threeMonthsAgo)}&end_de=${fmt(today)}&page_count=1`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== '000' || !data.list?.length) return null

    const first = data.list[0]
    const corpCode = first.corp_code
    const corpName = first.corp_name
    if (!corpCode) return null

    corpCodeCache.set(stockCode, { corpCode, corpName, ts: Date.now() })
    return { corpCode, corpName }
  } catch (e) {
    console.warn('[getDartCorpCode]', stockCode, e)
    return null
  }
}

/**
 * 가장 최근 사업보고서/분기보고서 재무제표 가져옴.
 * 사업보고서(11011) > 3분기(11014) > 반기(11012) > 1분기(11013) 순으로 시도.
 */
async function fetchLatestFinancials(corpCode: string): Promise<{ items: DartFinancialItem[]; year: number; reportCode: string; reportMonth: number } | null> {
  const key = getApiKey()
  if (!key) return null

  const now = new Date()
  const candidates: { year: number; code: string; month: number }[] = []
  // 최근 2년 × 4가지 보고서를 시점 순으로 시도 (가장 최근부터)
  for (let y = now.getFullYear(); y >= now.getFullYear() - 1; y--) {
    candidates.push({ year: y, code: '11011', month: 12 })  // 사업보고서 (전년 12월)
    candidates.push({ year: y, code: '11014', month: 9 })   // 3분기
    candidates.push({ year: y, code: '11012', month: 6 })   // 반기
    candidates.push({ year: y, code: '11013', month: 3 })   // 1분기
  }

  for (const c of candidates) {
    try {
      const url = `${DART_BASE}/fnlttSinglAcntAll.json?crtfc_key=${key}&corp_code=${corpCode}&bsns_year=${c.year}&reprt_code=${c.code}&fs_div=CFS`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const data = await res.json()
      if (data.status !== '000' || !data.list?.length) continue
      return { items: data.list as DartFinancialItem[], year: c.year, reportCode: c.code, reportMonth: c.month }
    } catch {
      continue
    }
  }
  return null
}

function pickAmount(items: DartFinancialItem[], accountIds: string[]): number | null {
  for (const id of accountIds) {
    const found = items.find(it => it.account_id === id || it.account_nm === id)
    if (found?.thstrm_amount) {
      const n = parseFloat(found.thstrm_amount.replace(/,/g, ''))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

/**
 * 한국 종목의 fundamental을 DART에서 가져와 정리.
 * marketCap(KRW) 인자 — Yahoo에서 받은 시총. PER/PBR 계산에 사용.
 * - 키 없거나 KR 종목 아니면 null
 * - 재무제표 못 찾으면 null
 */
export async function getKoreanFundamentalFromDart(
  stockCode: string,
  marketCap: number | null,
): Promise<DartFundamental | null> {
  if (!isKoreanStockCode(stockCode)) return null
  const key = getApiKey()
  if (!key) return null

  const corp = await getDartCorpCode(stockCode)
  if (!corp) return null

  const fin = await fetchLatestFinancials(corp.corpCode)
  if (!fin) return null

  // 손익계산서: 매출액 / 영업이익 / 당기순이익
  // 재무상태표: 자본총계
  // DART account_id 또는 한글 account_nm 둘 중 매칭
  const revenue = pickAmount(fin.items, ['ifrs-full_Revenue', 'ifrs_Revenue', '매출액', '수익(매출액)'])
  const operatingIncome = pickAmount(fin.items, ['dart_OperatingIncomeLoss', '영업이익', '영업이익(손실)'])
  const netIncome = pickAmount(fin.items, ['ifrs-full_ProfitLoss', 'ifrs_ProfitLoss', '당기순이익', '당기순이익(손실)'])
  const totalEquity = pickAmount(fin.items, ['ifrs-full_Equity', 'ifrs_Equity', '자본총계'])

  let per: number | null = null
  let pbr: number | null = null
  let roe: number | null = null

  if (marketCap != null && netIncome != null && netIncome !== 0) {
    // 분기보고서면 연환산 (annualize) — 사업보고서 11011은 그대로
    const annualizedNet = fin.reportCode === '11011' ? netIncome : netIncome * (12 / fin.reportMonth)
    if (annualizedNet > 0) per = marketCap / annualizedNet
  }
  if (marketCap != null && totalEquity != null && totalEquity > 0) {
    pbr = marketCap / totalEquity
  }
  if (netIncome != null && totalEquity != null && totalEquity > 0) {
    const annualizedNet = fin.reportCode === '11011' ? netIncome : netIncome * (12 / fin.reportMonth)
    roe = (annualizedNet / totalEquity) * 100
  }

  return {
    stockCode,
    corpCode: corp.corpCode,
    corpName: corp.corpName,
    netIncome,
    totalEquity,
    revenue,
    operatingIncome,
    per,
    pbr,
    roe,
    reportCode: fin.reportCode,
    reportYear: fin.year,
    reportMonth: fin.reportMonth,
  }
}

export function isDartConfigured(): boolean {
  return !!getApiKey()
}

/**
 * 국내상장 해외 ETF 어댑터 — 추종지수 근사(야간 미국 실시간 반영).
 * baseNav(전일 확정 NAV, KIS 073 output1) × (지수 현재/전일) × (환율 현재/전일).
 * 국내상장 해외 ETF는 대부분 지수 실물복제라 구성종목 가중합 ≈ 지수 → 야간 추정에 실용적.
 *
 * ⚠️ ETF→지수 매핑은 주요 종목만. 신규 종목은 여기 한 줄 추가(코드→Yahoo 지수·환율 심볼).
 *    KRX PDF 루트가 복구되면 전체 구성종목 정밀 합산으로 대체 가능(registry 우선순위).
 */
import type { EtfNavSource } from '../types'
import { estimateNavFromIndexProxy, computePremiumPct } from '../nav'
import { fetchEtfSnapshot } from './kis-client'

const num = (s?: string) => (s == null || s === '' ? undefined : Number(String(s).replace(/,/g, '')))

/** ETF 종목코드 → 추종지수 Yahoo 심볼(+환율). */
export const INDEX_MAP: Record<string, { index: string; fx?: string; label: string }> = {
  '360750': { index: '^GSPC', fx: 'USDKRW=X', label: 'S&P500' },        // TIGER 미국S&P500
  '379800': { index: '^GSPC', fx: 'USDKRW=X', label: 'S&P500' },        // KODEX 미국S&P500
  '449180': { index: '^GSPC', fx: 'USDKRW=X', label: 'S&P500' },        // PLUS 미국S&P500
  '379810': { index: '^NDX',  fx: 'USDKRW=X', label: '나스닥100' },      // KODEX 미국나스닥100
  '133690': { index: '^NDX',  fx: 'USDKRW=X', label: '나스닥100' },      // TIGER 미국나스닥100
  '381180': { index: '^SOX',  fx: 'USDKRW=X', label: '필라델피아반도체' }, // TIGER 미국필라델피아반도체나스닥
}

/** 국내상장 해외 ETF 여부 — 매핑 존재로 판별. */
export function isOverseasEtf(code: string): boolean {
  return code in INDEX_MAP
}

async function yahooQuote(symbol: string): Promise<{ now: number; prevClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
    if (!res.ok) return null
    const meta = (await res.json())?.chart?.result?.[0]?.meta
    const now = meta?.regularMarketPrice
    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose
    if (!now || !prevClose) return null
    return { now, prevClose }
  } catch {
    return null
  }
}

export const indexProxySource: EtfNavSource = {
  id: 'index-proxy',
  supports: (etf) => etf.kind === 'overseas' && etf.code in INDEX_MAP,
  async estimateNav(etf) {
    const m = INDEX_MAP[etf.code]
    if (!m) return null
    const [idx, fx, snap] = await Promise.all([
      yahooQuote(m.index),
      m.fx ? yahooQuote(m.fx) : Promise.resolve(null),
      fetchEtfSnapshot(etf.code), // baseNav·시장가 (실전 KIS)
    ])
    if (!idx || !snap) return null
    const o1 = snap.output1
    const baseNav = num(o1.prdy_clpr_nav) ?? num(o1.nav)
    if (baseNav == null) return null
    const marketPrice = num(o1.stck_prpr) ?? null
    const nav = estimateNavFromIndexProxy({
      baseNav, indexNow: idx.now, indexPrevClose: idx.prevClose, fxNow: fx?.now, fxPrevClose: fx?.prevClose,
    })
    return {
      etfCode: etf.code,
      name: etf.name,
      kind: 'overseas',
      estimatedNav: nav,
      marketPrice,
      premiumPct: marketPrice != null ? computePremiumPct(marketPrice, nav) : null,
      currency: 'KRW',
      coverage: 'proxy',
      source: 'index-proxy',
      asOf: new Date().toISOString(),
      note: `${m.label} 지수 근사(야간 미국 실시간·환율 반영). 정밀 구성종목 아님`,
    }
  },
}

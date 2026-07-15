/**
 * 국내 ETF 어댑터 — KIS 073.
 * NAV는 output1.nav(KIS가 전체 구성종목 현재가로 계산한 실시간 iNAV)를 정본으로 쓴다.
 * output2(상위30)는 표시/참고용 — 상위30만 수동 합산하면 스케일업 오차(7%+)가 나므로 NAV엔 안 씀.
 * KRX 복구로 전체 구성종목이 확보되면 그땐 nav.ts로 자체 합산(full) 가능.
 */
import type { EtfNavSource, EtfConstituent } from '../types'
import { computePremiumPct } from '../nav'
import { fetchEtfSnapshot, hasRealKis } from './kis-client'

const num = (s?: string) => (s == null || s === '' ? undefined : Number(String(s).replace(/,/g, '')))

export const kisDomesticSource: EtfNavSource = {
  id: 'kis-domestic',
  supports: (etf) => etf.kind === 'domestic' && hasRealKis(),
  async estimateNav(etf) {
    const snap = await fetchEtfSnapshot(etf.code)
    if (!snap) return null
    const o1 = snap.output1
    const nav = num(o1.nav) ?? null                 // KIS 실시간 iNAV(전체 구성종목 기반)
    if (nav == null) return null
    const totalCount = num(o1.etf_cnfg_issu_cnt) ?? snap.output2.length
    const marketPrice = num(o1.stck_prpr) ?? null

    // 상위30은 표시/검증용 (NAV 계산엔 미사용)
    const topHoldings: EtfConstituent[] = snap.output2.map(r => ({
      ticker: r.stck_shrn_iscd,
      name: r.hts_kor_isnm,
      market: 'KR',
      valuationKrw: num(r.etf_vltn_amt),
      weight: num(r.etf_cnfg_issu_rlim),
    }))

    return {
      etfCode: etf.code,
      name: etf.name,
      kind: 'domestic',
      estimatedNav: nav,
      marketPrice,
      premiumPct: marketPrice != null ? computePremiumPct(marketPrice, nav) : null,
      currency: 'KRW',
      coverage: 'full',                             // KIS nav는 전체 구성 기반
      source: 'kis-domestic',
      asOf: new Date().toISOString(),
      note: `KIS 실시간 NAV(전체 ${totalCount}종목 기반). 상위 ${topHoldings.length}종목 보유내역 제공`,
      topHoldings,
    }
  },
}

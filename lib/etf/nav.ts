/**
 * ETF 추정 NAV 계산 — 순수 함수(소스 독립·테스트 가능).
 * 두 계산 경로: ① 구성종목 평가금액 합산(국내·해외 PDF), ② 추종지수 근사(해외 야간).
 */
import type { EtfComposition } from './types'

/**
 * 구성종목 평가금액 합산 → 1좌당 추정 NAV.
 * - full: Σ평가금액 / CU좌수.
 * - partial(상위 N종목만): 커버된 비중으로 스케일업해 전체 추정.
 *   예) 상위 30종목이 비중 80%면 전체 ≈ Σ평가금액 / 0.80.
 */
export function estimateNavFromComposition(comp: EtfComposition): { nav: number | null; note?: string } {
  const { constituents, cuUnitShares, coverage } = comp
  if (!cuUnitShares || cuUnitShares <= 0) return { nav: null, note: 'CU 좌수 미상' }

  let coveredValuation = 0
  let coveredWeight = 0
  for (const c of constituents) {
    if (c.valuationKrw != null) coveredValuation += c.valuationKrw
    if (c.weight != null) coveredWeight += c.weight
  }
  if (coveredValuation <= 0) return { nav: null, note: '구성종목 평가금액 없음' }

  let total = coveredValuation
  let note: string | undefined
  if (coverage === 'partial') {
    const wFrac = coveredWeight / 100
    if (wFrac > 0.5 && wFrac <= 1) {
      total = coveredValuation / wFrac
      note = `상위 ${constituents.length}종목(비중 ${Math.round(wFrac * 100)}%)으로 전체 추정`
    } else {
      note = `부분 커버리지(비중 ${Math.round(coveredWeight)}%) — 과소 추정 가능`
    }
  }
  return { nav: total / cuUnitShares, note }
}

/**
 * 추종지수 근사 → 1좌당 추정 NAV (국내상장 해외 ETF 야간용).
 * 기준NAV(전일 확정) × (지수 현재/전일) × (환율 현재/전일).
 * 지수 실물복제 ETF는 구성종목 가중합 ≈ 지수라, 야간 미국 실시간 반영에 실용적.
 */
export function estimateNavFromIndexProxy(params: {
  baseNav: number          // 전일 확정 NAV(원)
  indexNow: number
  indexPrevClose: number
  fxNow?: number           // USDKRW 현재
  fxPrevClose?: number     // USDKRW 전일종가
}): number | null {
  const { baseNav, indexNow, indexPrevClose, fxNow, fxPrevClose } = params
  if (!baseNav || !indexPrevClose) return null
  let ratio = indexNow / indexPrevClose
  if (fxNow && fxPrevClose) ratio *= fxNow / fxPrevClose
  return baseNav * ratio
}

/** 시장가 대비 괴리율(%). 양수=프리미엄(시장가가 NAV보다 비쌈). */
export function computePremiumPct(marketPrice: number, nav: number | null): number | null {
  if (!nav || nav <= 0) return null
  return (marketPrice / nav - 1) * 100
}

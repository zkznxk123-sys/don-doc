/**
 * ETF NAV 소스 registry — 우선순위 순으로 첫 성공을 반환(폴백 체인).
 * 우선순위: KRX(전체 정밀) → KIS(국내 상위30) → 지수근사(해외).
 * KRX 복구 시 supports가 true가 되면 자동으로 최우선 승격 — 하위 코드 변경 불필요.
 */
import type { EtfNavSource, EtfKind, EtfNavResult } from './types'
import { krxSource } from './sources/krx'
import { kisDomesticSource } from './sources/kis-domestic'
import { indexProxySource, isOverseasEtf } from './sources/index-proxy'

const SOURCES: EtfNavSource[] = [krxSource, kisDomesticSource, indexProxySource]

/** 국내 vs 국내상장 해외 판별(해외 지수 매핑 존재 여부). */
export function classifyEtf(code: string): EtfKind {
  return isOverseasEtf(code) ? 'overseas' : 'domestic'
}

/** 추정 NAV — 소스 폴백 체인. 모두 실패하면 null. */
export async function estimateEtfNav(etf: { code: string; name?: string }): Promise<EtfNavResult | null> {
  const kind = classifyEtf(etf.code)
  for (const src of SOURCES) {
    if (!src.supports({ code: etf.code, kind })) continue
    try {
      const r = await src.estimateNav({ code: etf.code, kind, name: etf.name })
      if (r && r.estimatedNav != null) return r
    } catch {
      // 다음 소스로 폴백
    }
  }
  return null
}

/**
 * ETF 추정 NAV(iNAV) — 타입 + 소스 어댑터 인터페이스.
 *
 * 배경: 국내 ETF는 장 마감 후 구성종목 종가, 국내상장 해외 ETF는 해외 구성종목(또는 추종지수)
 * 실시간으로 1좌당 순자산가치를 추정한다. 데이터 소스가 여럿(KRX PDF·KIS·지수근사)이라
 * 소스를 갈아끼울 수 있게 어댑터로 분리 — 소스 확정 전에도 계산·UI를 독립적으로 개발.
 */

export type EtfKind = 'domestic' | 'overseas' // 국내 / 국내상장 해외
export type NavCoverage = 'full' | 'partial' | 'proxy' // 전체 구성종목 / 일부(상위N) / 지수근사

/** ETF 1좌 구성 1종목. */
export interface EtfConstituent {
  ticker: string          // 종목코드(국내 6자리) 또는 해외 티커
  name: string
  market: 'KR' | 'US'     // 현재가 조회 시장
  /** 평가금액(원) — 소스가 직접 주면 이 값이 우선(현재가×수량 재계산 불필요). */
  valuationKrw?: number
  /** CU(설정단위)당 보유 수량. 평가금액이 없을 때 현재가×수량으로 계산. */
  shares?: number
  weight?: number         // 구성 비중(%) — 근사·검증용
}

/** 소스가 반환하는 ETF 구성 스냅샷. */
export interface EtfComposition {
  etfCode: string
  name?: string
  kind: EtfKind
  cuUnitShares: number    // CU 단위 증권 수(발행좌수 환산용). 0이면 미상.
  constituents: EtfConstituent[]
  coverage: NavCoverage
  source: string
  asOf: string            // ISO
}

/** 추정 NAV 계산 결과. */
export interface EtfNavResult {
  etfCode: string
  name?: string
  kind: EtfKind
  estimatedNav: number | null  // 1좌당 추정 순자산가치(원). 계산 불가 시 null.
  marketPrice?: number | null  // 시장가(원) — 괴리 판단용
  premiumPct?: number | null   // (시장가/추정NAV - 1)×100. 양수=프리미엄
  currency: 'KRW'
  coverage: NavCoverage
  source: string
  asOf: string
  note?: string           // 근사·부분 커버리지 등 주의 문구
  topHoldings?: EtfConstituent[]  // 상위 보유종목(표시용, NAV 계산과 별개일 수 있음)
}

/**
 * ETF NAV 소스 어댑터. 우선순위 순으로 supports() 첫 매치가 estimateNav()를 담당.
 * estimateNav는 실패/미구현 시 null을 반환(다음 소스로 폴백).
 */
export interface EtfNavSource {
  readonly id: string
  /** 이 소스가 해당 ETF를 처리할 수 있는가. */
  supports(etf: { code: string; kind: EtfKind }): boolean
  /** 추정 NAV 계산. 데이터 취득 실패·미구현이면 null. */
  estimateNav(etf: { code: string; kind: EtfKind; name?: string }): Promise<EtfNavResult | null>
}

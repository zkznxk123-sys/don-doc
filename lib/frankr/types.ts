// 플랭커(부동산계산기.com) API 타입 정의
// 문서: https://dev.fran.kr/docs
// Base URL: https://calcapi.fran.kr/v1
// 인증: HTTP Header에 clientID, clientSecret 포함

// ── 공통 응답 ─────────────────────────────────────────────────────
// 응답은 항목별 라인 배열 형태 (적요/값/비고)
export interface FrankrResultRow {
  적요: string
  값?: string    // 보유세·양도세·증여세
  금액?: string  // 취득세·상속세
  비고?: string
  옵션?: string
}

export interface FrankrResponse {
  success: boolean
  data?: FrankrResultRow[]
  basis?: string | null  // 비과세 사유 등 HTML 설명 (e.g. 종부세 공제액 초과 안 할 경우)
  error?: string
  cached?: boolean
}

export type FrankrCalcType =
  | 'property'     // 보유세 (재산세 + 종합부동산세) ✓ /property
  | 'acquisition'  // 취득세 ✓ /acquisition
  | 'transfer'     // 양도세 ✓ /transfer
  | 'give'         // 증여세 ✓ /give
  | 'inherit'      // 상속세 ✓ /inherit

// ── 보유세 (재산세 + 종부세) ─────────────────────────────────────
// endpoint: POST https://calcapi.fran.kr/v1/property
export interface PropertyTaxParams {
  property: {
    amount: number        // 공시가격 (만원 단위)
    share?: number        // 지분비율 (1~99%)
    preCityTax?: number   // 전년도 도시지역분 (만원)
    preSynthTax?: number  // 전년도 종부세 (만원)
    conArea?: 'Y' | 'N'  // 조정대상지역 여부
    cityArea?: 'Y' | 'N' // 도시지역 여부
  }[]
  oneHouse?: 'Y' | 'N'          // 1세대1주택자
  baseYear?: string              // 기준연도 (YYYY)
  synthTaxFairRate?: string      // 종부세 공정시장가액비율 (0~100)
  propTaxFairRate?: string       // 재산세 공정시장가액비율 (기본 60)
  synthTaxDeduct?: string        // 종부세 공제금액 (기본 110000 = 11억)
  corporation?: 'Y' | 'N'       // 법인 여부
  longHold?: 'Y' | 'N'          // 장기보유 여부
  long?: number                  // 보유 기간 (연)
  oldAge?: 'Y' | 'N'            // 고령자 여부
  age?: string                   // 나이
  temp721?: 'Y' | 'N'           // 7.21 대책 적용
}

// ── 취득세 ────────────────────────────────────────────────────────
// endpoint: POST https://calcapi.fran.kr/v1/acquisition
export interface AcquisitionTaxParams {
  realEstateType: 'house' | 'officetel' | 'framLand' | string // 부동산 구분
  how: 'buy' | 'inherit' | 'give' | 'new'  // 취득 구분 (매매/상속/증여/신축)
  amount: number              // 취득가액 (만원 단위)
  standardPrice?: number      // 시가표준액 (만원 단위)
  cultivation?: 'Y' | 'N'    // 자경농지
  areaType?: '40' | '60' | '85' | 'big'  // 면적 구분
  own?: 'one' | 'two' | 'three' | 'more' // 주택 보유 건수
  corporation?: 'Y' | 'N'    // 법인
  license?: 'Y' | 'N'        // 임대사업자 최초분양
  conArea?: 'Y' | 'N'        // 조정대상지역
  extravagance?: 'Y' | 'N'   // 별장·고급주택 등 중과세 대상
  heavyTaxExclude?: 'Y' | 'N' // 중과세 배제
  spauseChildGive?: 'Y' | 'N' // 1주택자 배우자·직계비속 증여
  firstOfLife?: 'Y' | 'N'    // 생애 최초 구입 주택
}

// ── 양도세 ────────────────────────────────────────────────────────
// endpoint: POST https://calcapi.fran.kr/v1/transfer
export interface TransferTaxParams {
  realEstateType: 'house' | 'right' | 'uni' | string // 부동산 구분 (주택/권리/단독 등)
  buyAmt: number              // 취득가액 (만원 단위)
  sellAmt: number             // 양도가액 (만원 단위)
  buyDate: number             // 취득일자 (YYYYMMDD)
  sellDate: number            // 양도일자 (YYYYMMDD)
  approveDate?: number        // 조정대상지역 지정일자 (YYYYMMDD)
  cost?: number               // 필요경비 (만원 단위)
  unionPrice?: number         // 조합원입주권 가치 (만원 단위)
  unionCost?: number          // 조합원입주권 필요경비 (만원 단위)
  oneHouseDate?: string       // 최종 1주택일자 (YYYYMMDD)
  own?: 'one' | 'two'         // 주택 보유수
  conArea?: 'Y' | 'N'         // 조정대상지역
  realLive?: 'Y' | 'N'        // 2년 이상 거주
  liveYear?: number           // 거주 기간 (2~10년)
  rentBusiness?: 'Y' | 'N'   // 임대사업자
  longRentExemption?: 'Y' | 'N' // 조세특례제한
  baseDeduct?: 'Y' | 'N'     // 기본 공제
  adjustUnit?: 'm' | string   // 양도차익 조정단위
  diffAdjust?: number         // 양도차익 조정수치 (만원 단위)
  jointOwnership?: 'Y' | 'N' // 공동명의
  jointRate?: number          // 공동명의비율 (1~9)
  noOneHouse?: 'Y' | 'N'     // 1세대1주택자 미적용
  noHeavyTax?: 'Y' | 'N'     // 중과세 미적용
  forcelongDeduct?: 'Y' | 'N' // 장기보유특별공제 강제 적용
  longDeductCustomRate?: number // 장기보유특별공제 임의 비율 (0~1)
  temp721?: 'Y' | 'N'         // 2022년 세제개편안 임시 적용
}

// ── 증여세 ────────────────────────────────────────────────────────
// endpoint: POST https://calcapi.fran.kr/v1/give
export interface GiftTaxParams {
  amount: number              // 취득가액 (만원 단위)
  pastAmount?: number         // 과거 증여 가산액 (만원 단위)
  commission?: number         // 수수료 등 (만원 단위)
  dept?: string               // 부채 부담액 (만원 단위)
  taxFree?: string            // 비과세액 (만원 단위)
  giver?: 'spouse' | 'parent' | 'child' | 'relative' // 증여자
  minor?: 'Y' | 'N'          // 미성년자 여부
  jump?: 'Y' | 'N'           // 세대를 건너뛴 증여
  payBehalf?: 'Y' | 'N'      // 증여세 대납
}

// ── 상속세 ────────────────────────────────────────────────────────
// endpoint: POST https://calcapi.fran.kr/v1/inherit
export interface InheritanceTaxParams {
  amount: number                    // 상속가액 (만원 단위)
  pastAmt?: number                  // 과거 증여 가산액 (만원 단위)
  cost?: number                     // 장례비용 등 (만원 단위)
  commission?: number               // 수수료 등 (만원 단위)
  dept?: number                     // 부채 부담액 (만원 단위)
  cohabitAmt?: number               // 동거주택가액 (만원 단위)
  financialInheritAmt?: number      // 금융상속금액 (만원 단위)
  synthLimitDeduct?: number         // 종합한도 차감액 (만원 단위)
  spouse?: 'Y' | 'I' | 'N'         // 배우자 (Y: 있음 / I: 있으나 상속 안 받음 / N: 없음)
  spouseInheritAmt?: number         // 배우자 상속금액 (만원 단위)
  deductChild?: number              // 자녀 수
  deductOld?: number                // 고령자 수
  descendant?: number               // 직계비속 수
  ascendant?: number                // 직계존속 수
  minorInherit?: 'Y' | 'N'         // 미성년자 상속
  generationSkip?: 'Y' | 'N'       // 세대를 건너뛴 상속
  generationSkipAmt?: number        // 세대생략상속액 (만원 단위)
  minorList?: { age: number }[]     // 미성년자 목록
  disableList?: { sex: 'F' | 'M'; age: number }[] // 장애인 목록
}

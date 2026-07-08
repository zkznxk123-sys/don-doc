/**
 * 공모주 청약 보드 — 뷰 타입 + 파생 계산 유틸.
 *
 * 종목·일정은 38.co.kr 어댑터가 생성(offerings.generated).
 * 전체 데이터 엔티티 설계: vault `공모주-청약원장-데이터모델-스펙.md`.
 */

export type SubStatus = 'PLANNED' | 'SUBMITTED' | 'ALLOCATED' | 'UNALLOCATED' | 'SOLD' | 'MISSED'

/** 청약 1건 = 명의 × 증권사 × 종목. */
export interface LedgerRow {
  offering: string
  kind: 'IPO' | 'SPAC'
  person: string
  broker: string
  subType: '균등' | '비례'
  deposit: number          // 증거금(원)
  allocatedShares: number  // 배정 주수 (미정 0)
  refundAmount: number     // 환불 예정/완료액
  refunded: boolean        // 환불금·배정주 회수 완료
  status: SubStatus
  realizedPnl?: number     // 매도 실현손익(세후)
  subStart: string         // "YYYY-MM-DD"
  refundDate?: string
  listingDate?: string
}

/** 다가올 일정(종목 단위) — 어댑터 ScheduleOffering에서 옴. */
export interface UpcomingOffering {
  name: string
  kind: 'IPO' | 'SPAC'
  brokers: string[]
  subStart?: string
  subEnd?: string
  refundDate?: string
  listingDate?: string
  transferDate?: string
  // ── 종목 기본정보(38 상세페이지 자동) ──
  ipoPrice?: number          // 확정공모가(원)
  priceBand?: string         // 희망공모가밴드 "17,800~20,700"
  offerAmountEok?: number    // 공모금액(억원)
  shares?: number            // 총공모주식수
  shareType?: string         // 신주/구주 "신주 100%"
  instCompetition?: number   // 기관경쟁률 (예: 1146.41 → 1146:1)
  instCount?: number         // 수요예측 참여기관 수(건)
  lockupRatio?: number       // 의무보유확약 비율(%)
  lockupBreakdown?: { d15?: number; m1?: number; m3?: number; m6?: number } // 확약 기간별 비율(%)
  publicFloatRatio?: number  // 공모주주 유통비율(%) — 기존주주 = floatRatio − publicFloatRatio
  // ── DART 증권신고서 자동(estkRs/본문 유통표) ──
  marketCapEok?: number      // 시가총액(억) = 공모가×총상장주식수
  floatAmountEok?: number    // 유통금액(억) = 공모가×유통가능주식수
  floatRatio?: number        // 상장일 유통가능비율(%)
  redemptionRight?: boolean  // 환매청구권 유무
  // ── 청약 조건(38) — 배정 계산기 입력 ──
  allotShares?: number       // 일반청약자 배정주식수 (균등물량 = ×50%)
  subLimit?: string          // 청약한도 "10,000~12,000"
  depositRate?: number       // 청약증거금률(%) 기본 50
  minSubShares?: number      // 최소청약수량(주) 기본 10
  subCompetition?: number    // 비례경쟁률(38 최종, 청약 마감 후). 당일 실시간은 증권사 앱 수동
  no38?: string              // 38 상세 id — 계산기에서 경쟁률 실시간 조회용
}

export const STATUS_META: Record<SubStatus, { label: string; tone: string }> = {
  PLANNED:     { label: '청약예정', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  SUBMITTED:   { label: '청약완료', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  ALLOCATED:   { label: '배정', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  UNALLOCATED: { label: '미배정', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300' },
  SOLD:        { label: '매도완료', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  MISSED:      { label: '놓침', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
}

/**
 * 다가올 일정 = 어댑터가 실 카톡 공지에서 생성한 데이터(offerings.generated.ts).
 * 재생성: npx tsx scripts/ipo-offerings-build.ts --csv <카톡.csv>
 */
export { GENERATED_OFFERINGS as OFFERINGS, GENERATED_AT, SOURCE } from './offerings.generated'

/** 종목명 → 일정. 내역 카드 헤더가 실 일정을 끌어쓰게. */
import { GENERATED_OFFERINGS } from './offerings.generated'
export const OFFERING_BY_NAME: Map<string, UpcomingOffering> =
  new Map(GENERATED_OFFERINGS.map(o => [o.name, o]))

// ─────────────────────────────────────────────────────────────
// 계좌 축 — 공모주 = 멀티계좌 운용 게임. 계좌가 모든 것의 축.
// ─────────────────────────────────────────────────────────────

export type ReadinessState = 'OK' | 'PENDING' | 'EXPIRED'

/** 계좌 = 명의 × 증권사. 준비상태(통증 1위)가 핵심. */
export interface Account {
  id: string
  person: string
  broker: string
  accountNo?: string         // 계좌번호
  bankLinked?: boolean       // 은행제휴 계좌(연계). true=은행제휴(20일 제한 없음), false/undefined=비대면 일반(20일 1개)
  readiness: {
    cdd: ReadinessState     // 고객확인(CDD/EDD)
    otp: ReadinessState     // OTP 등록
    cert: ReadinessState    // 공동인증서
    limit: ReadinessState   // 한도제한 해제
  }
}

export const READINESS_LABELS: { key: keyof Account['readiness']; label: string }[] = [
  { key: 'cdd', label: 'CDD' },
  { key: 'otp', label: 'OTP' },
  { key: 'cert', label: '인증서' },
  { key: 'limit', label: '한도' },
]

export const READINESS_TONE: Record<ReadinessState, string> = {
  OK:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  EXPIRED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

/** 한 계좌에 지금 머무는 돈 — 청약 내역에서 도출(묶임/환불대기/보유주). */
export interface AccountMoney {
  locked: number        // 묶인 증거금(청약완료·환불 전)
  refundPending: number // 환불·원금 회수 대기(배정 후 미회수)
  heldShares: number    // 미매도 배정주
  total: number         // locked+refundPending
}

export function accountMoney(acct: Account, ledger: LedgerRow[]): AccountMoney {
  let locked = 0, refundPending = 0, heldShares = 0
  for (const r of ledger) {
    if (r.person !== acct.person || r.broker !== acct.broker) continue
    if (r.status === 'SUBMITTED') locked += r.deposit
    if (r.status === 'ALLOCATED') { heldShares += r.allocatedShares; if (!r.refunded) refundPending += r.refundAmount }
    // 미배정 = 배정 0 → 증거금 전액 환불. 회수 전이면 환불 대기.
    if (r.status === 'UNALLOCATED' && !r.refunded) refundPending += r.refundAmount
  }
  return { locked, refundPending, heldShares, total: locked + refundPending }
}

/** 계좌의 준비 미비 항목 수. 0이면 청약 가능. */
export function readinessIssues(acct: Account): number {
  return Object.values(acct.readiness).filter(s => s !== 'OK').length
}

/**
 * 계좌번호 마스킹 — 앞 3자리·뒤 4자리만 노출, 구분자(-) 보존.
 * 카드에 평문 전체가 찍히면 스크린샷·화면 공유 때 유출되므로 표시용으로만 가림.
 * (원본은 수정 폼에서 그대로 확인)
 */
export function maskAccountNo(no: string): string {
  const total = no.replace(/\D/g, '').length
  if (total <= 7) return no                  // 너무 짧으면 마스킹 의미 없음
  let idx = 0
  return no.replace(/\d/g, d => {
    const keep = idx < 3 || idx >= total - 4
    idx++
    return keep ? d : '*'
  })
}

// ─────────────────────────────────────────────────────────────
// 스팩 시세 — 시총 버킷별·가격 낮은순 스크리너.
// 스팩은 만기 시 2,000원+이자 상환이 사실상 floor → 2,000 근처/미만이 차익 후보.
// ─────────────────────────────────────────────────────────────

export const SPAC_BASELINE = 2_000   // 상환 기준가(원)

export interface Spac {
  id: string
  name: string
  marketCapEok: number    // 시가총액(억원)
  price: number           // 현재가(원)
  maturityDate?: string   // 존속기한(만기) "YYYY-MM-DD"
  code?: string           // 종목코드(네이버 실시간 시세용). 없으면 종목명으로 자동 해석
  live?: boolean          // 마지막 갱신이 실시간 시세였나
  quotedAt?: string       // 마지막 시세 갱신 시각(ISO)
  // ── 보유현황(선택) — 관심 종목을 실제 보유하면 채움 ──
  shares?: number         // 보유 주식수
  avgCost?: number        // 매수 평균단가(원)
}

export const SPAC_BUCKETS: { key: string; label: string; max: number }[] = [
  { key: 'small', label: '소형 (~100억)', max: 100 },
  { key: 'mid', label: '중형 (100~200억)', max: 200 },
  { key: 'large', label: '대형 (200억~)', max: Infinity },
]

export function spacBucket(cap: number) {
  return SPAC_BUCKETS.find(b => cap < b.max) ?? SPAC_BUCKETS[SPAC_BUCKETS.length - 1]
}

/** 버킷별로 묶고, 각 버킷 안에서 가격 낮은순 정렬. */
export function groupSpacsByCap(spacs: Spac[]): { bucket: typeof SPAC_BUCKETS[number]; items: Spac[] }[] {
  return SPAC_BUCKETS.map(bucket => ({
    bucket,
    items: spacs.filter(s => spacBucket(s.marketCapEok).key === bucket.key)
      .sort((a, b) => a.price - b.price),
  })).filter(g => g.items.length > 0)
}


/** D-day 계산. 음수면 지남. */
export function ddays(dateStr: string, today: Date): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target - now) / 86_400_000)
}

export function ddayLabel(n: number): string {
  if (n === 0) return 'D-DAY'
  return n > 0 ? `D-${n}` : `D+${-n}`
}

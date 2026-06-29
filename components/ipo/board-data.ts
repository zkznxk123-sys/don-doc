/**
 * 공모주 청약 원장 보드 — 뷰 타입 + 데모 데이터.
 *
 * 종목·일정은 schedule-notice 어댑터가 실 카톡에서 뽑은 실제 값(2026-06 기준),
 * 명의별 청약/배정/환불 내역은 화면 시연용 데모. (실데이터 연결 전 단계)
 * 전체 원장 엔티티 설계: vault `공모주-청약원장-데이터모델-스펙.md`.
 */

export type SubStatus = 'PLANNED' | 'SUBMITTED' | 'ALLOCATED' | 'SOLD' | 'MISSED'

/** 청약 1건 = 명의 × 증권사 × 종목. */
export interface LedgerRow {
  offering: string
  kind: 'IPO' | 'SPAC'
  person: string
  broker: string
  subType: '균등' | '비례' | '균등+비례'
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
}

export const STATUS_META: Record<SubStatus, { label: string; tone: string }> = {
  PLANNED:   { label: '청약예정', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  SUBMITTED: { label: '청약완료', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  ALLOCATED: { label: '배정·보유', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  SOLD:      { label: '매도완료', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  MISSED:    { label: '놓침', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
}

/** 시연용 명의. */
export const DEMO_PERSONS = ['본인', '배우자', '자녀'] as const

/**
 * 다가올 일정 = 어댑터가 실 카톡 공지에서 생성한 데이터(offerings.generated.ts).
 * 재생성: npx tsx scripts/ipo-offerings-build.ts --csv <카톡.csv>
 */
export { GENERATED_OFFERINGS as OFFERINGS, GENERATED_AT, SOURCE } from './offerings.generated'

/** 종목명 → 일정. 원장 카드 헤더가 실 일정을 끌어쓰게. */
import { GENERATED_OFFERINGS } from './offerings.generated'
export const OFFERING_BY_NAME: Map<string, UpcomingOffering> =
  new Map(GENERATED_OFFERINGS.map(o => [o.name, o]))

/** 청약 원장 데모 — 명의별 내역. */
export const DEMO_LEDGER: LedgerRow[] = [
  // 스트라드비젼 — 상장(6/30) 임박, 본인 매도완료 / 배우자 보유
  { offering: '스트라드비젼', kind: 'IPO', person: '본인', broker: 'KB', subType: '비례', deposit: 5_000_000, allocatedShares: 10, refundAmount: 4_100_000, refunded: true, status: 'SOLD', realizedPnl: 182_000, subStart: '2026-06-19', refundDate: '2026-06-23', listingDate: '2026-06-30' },
  { offering: '스트라드비젼', kind: 'IPO', person: '배우자', broker: 'KB', subType: '균등', deposit: 1_250_000, allocatedShares: 1, refundAmount: 1_150_000, refunded: false, status: 'ALLOCATED', subStart: '2026-06-19', refundDate: '2026-06-23', listingDate: '2026-06-30' },

  // 매드업 — 상장(7/1) 대기, 본인·자녀 배정 보유(미매도)
  { offering: '매드업', kind: 'IPO', person: '본인', broker: '미래', subType: '균등', deposit: 1_500_000, allocatedShares: 2, refundAmount: 1_300_000, refunded: false, status: 'ALLOCATED', subStart: '2026-06-10', refundDate: '2026-06-26', listingDate: '2026-07-01' },
  { offering: '매드업', kind: 'IPO', person: '자녀', broker: '미래', subType: '균등', deposit: 1_500_000, allocatedShares: 1, refundAmount: 1_400_000, refunded: false, status: 'ALLOCATED', subStart: '2026-06-10', refundDate: '2026-06-26', listingDate: '2026-07-01' },

  // 레몬헬스케어 — 청약완료, 환불(6/29) 대기
  { offering: '레몬헬스케어', kind: 'IPO', person: '본인', broker: 'KB', subType: '균등+비례', deposit: 3_200_000, allocatedShares: 0, refundAmount: 0, refunded: false, status: 'SUBMITTED', subStart: '2026-06-25', refundDate: '2026-06-29', listingDate: '2026-07-03' },
  { offering: '레몬헬스케어', kind: 'IPO', person: '배우자', broker: 'KB', subType: '균등', deposit: 1_250_000, allocatedShares: 0, refundAmount: 0, refunded: false, status: 'SUBMITTED', subStart: '2026-06-25', refundDate: '2026-06-29', listingDate: '2026-07-03' },

  // 레메디 — 청약예정(7/2)
  { offering: '레메디', kind: 'IPO', person: '본인', broker: 'KB', subType: '균등', deposit: 0, allocatedShares: 0, refundAmount: 0, refunded: false, status: 'PLANNED', subStart: '2026-07-02' },
  { offering: '레메디', kind: 'IPO', person: '배우자', broker: 'KB', subType: '균등', deposit: 0, allocatedShares: 0, refundAmount: 0, refunded: false, status: 'PLANNED', subStart: '2026-07-02' },

  // 한국제16호스팩 — 자녀 깜빡(놓침) 예시
  { offering: '한국제16호스팩', kind: 'SPAC', person: '자녀', broker: '한국', subType: '균등', deposit: 0, allocatedShares: 0, refundAmount: 0, refunded: false, status: 'MISSED', subStart: '2026-06-23', refundDate: '2026-06-25' },
]

// ─────────────────────────────────────────────────────────────
// 계좌 축 — 공모주 = 멀티계좌 운용 게임. 계좌가 모든 것의 축.
// ─────────────────────────────────────────────────────────────

export type ReadinessState = 'OK' | 'PENDING' | 'EXPIRED'

/** 계좌 = 명의 × 증권사. 준비상태(통증 1위) + 가용현금 보유. */
export interface Account {
  id: string
  person: string
  broker: string
  type: '종합' | 'CMA'
  cash: number   // 가용현금 잔액(원)
  readiness: {
    cdd: ReadinessState     // 고객확인(CDD/EDD)
    otp: ReadinessState     // OTP 등록
    cert: ReadinessState    // 공동인증서
    limit: ReadinessState   // 한도제한 해제
    mail: ReadinessState    // 우편물 거부
  }
}

export const READINESS_LABELS: { key: keyof Account['readiness']; label: string }[] = [
  { key: 'cdd', label: 'CDD' },
  { key: 'otp', label: 'OTP' },
  { key: 'cert', label: '인증서' },
  { key: 'limit', label: '한도' },
  { key: 'mail', label: '우편물' },
]

export const READINESS_TONE: Record<ReadinessState, string> = {
  OK:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  EXPIRED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

/** 계좌 데모 — 명의×증권사. 일부러 준비 미비(만료·대기)를 섞어 통증을 드러냄. */
export const DEMO_ACCOUNTS: Account[] = [
  { id: 'me-kb',   person: '본인',  broker: 'KB',  type: '종합', cash: 8_000_000, readiness: { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK', mail: 'OK' } },
  { id: 'me-mr',   person: '본인',  broker: '미래', type: '종합', cash: 1_500_000, readiness: { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK', mail: 'OK' } },
  { id: 'sp-kb',   person: '배우자', broker: 'KB',  type: '종합', cash: 2_000_000, readiness: { cdd: 'PENDING', otp: 'OK', cert: 'OK', limit: 'OK', mail: 'OK' } },
  { id: 'sp-ss',   person: '배우자', broker: '삼성', type: '종합', cash: 3_000_000, readiness: { cdd: 'OK', otp: 'EXPIRED', cert: 'OK', limit: 'OK', mail: 'OK' } },
  { id: 'ch-mr',   person: '자녀',  broker: '미래', type: '종합', cash: 1_000_000, readiness: { cdd: 'OK', otp: 'OK', cert: 'PENDING', limit: 'PENDING', mail: 'OK' } },
  { id: 'ch-hk',   person: '자녀',  broker: '한국', type: '종합', cash: 0,         readiness: { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'PENDING', mail: 'PENDING' } },
]

/** 한 계좌에 지금 머무는 돈 — 원장에서 도출(가용/묶임/환불대기/보유주). */
export interface AccountMoney {
  cash: number          // 가용현금
  locked: number        // 묶인 증거금(청약완료·환불 전)
  refundPending: number // 환불·원금 회수 대기(배정 후 미회수)
  heldShares: number    // 미매도 배정주
  total: number         // cash+locked+refundPending
}

export function accountMoney(acct: Account, ledger: LedgerRow[] = DEMO_LEDGER): AccountMoney {
  let locked = 0, refundPending = 0, heldShares = 0
  for (const r of ledger) {
    if (r.person !== acct.person || r.broker !== acct.broker) continue
    if (r.status === 'SUBMITTED') locked += r.deposit
    if (r.status === 'ALLOCATED') { heldShares += r.allocatedShares; if (!r.refunded) refundPending += r.refundAmount }
  }
  return { cash: acct.cash, locked, refundPending, heldShares, total: acct.cash + locked + refundPending }
}

/** 계좌의 준비 미비 항목 수. 0이면 청약 가능. */
export function readinessIssues(acct: Account): number {
  return Object.values(acct.readiness).filter(s => s !== 'OK').length
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

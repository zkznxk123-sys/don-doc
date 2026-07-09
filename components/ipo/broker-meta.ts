/**
 * 증권사 마스터 — 계좌 개설·인증 메타(갭 플래너·개설 가이드가 참조).
 * 시드는 구조 + 대형사 공통 기본값. 증권사별 세부(자녀개설 방식·개설/로그인 팁)는
 * 카톡방 crowd 지식으로 점진 보정(사실 확인된 것만). 정확성 미확인 항목은 '확인'으로 둔다.
 */

export interface BrokerMeta {
  broker: string
  nonFace: boolean                       // 비대면(앱) 개설 가능
  twentyDayRule: boolean                 // 비대면 20영업일 1계좌 제한 적용
  minorOpen: '비대면' | '방문' | '확인'   // 자녀(미성년) 계좌 개설 방식
  minorNote?: string
  tips: string[]                         // 개설·인증·로그인 팁(보정 자리)
}

// 대형 증권사 공통 — 대체로 비대면 개설 + 20영업일 룰. 자녀개설은 증권사별로 달라 '확인' 기본.
const DEFAULT: Omit<BrokerMeta, 'broker'> = {
  nonFace: true, twentyDayRule: true, minorOpen: '확인', tips: [],
}

// 확인된 증권사별 예외만 여기에 누적(카톡 팁 → 사실 검증 후).
const OVERRIDES: Record<string, Partial<Omit<BrokerMeta, 'broker'>>> = {}

// 자주 등장하는 IPO 주관사(entry-forms BROKERS와 정렬).
const NAMES = ['KB', 'NH', '삼성', '한국', '미래', '신한', '키움', '유안타', '하나', '대신', '유진', '교보', '한화', '현대차', '메리츠', 'DB', '신영', 'BNK', '토스', 'LS']

export const BROKER_META: Record<string, BrokerMeta> = Object.fromEntries(
  NAMES.map(n => [n, { broker: n, ...DEFAULT, ...OVERRIDES[n] }]),
)

/** 계좌/주관사 표기 편차(예: '삼성' vs '삼성증권') 흡수 — 부분매칭으로 메타 조회. */
export function brokerMeta(name: string): BrokerMeta | undefined {
  if (BROKER_META[name]) return BROKER_META[name]
  const hit = Object.keys(BROKER_META).find(k => name.includes(k) || k.includes(name))
  return hit ? BROKER_META[hit] : undefined
}

/** 개설 전략 공통 팁 — 사실 기반(증권사 무관). 플래너 상단 안내. */
export const OPEN_STRATEGY_TIPS: string[] = [
  '비대면 계좌 개설은 전 금융권 통틀어 20영업일에 1개 제한 — 다가올 종목 주관사 순으로 개설 순서를 잡으세요.',
  '은행 연계·기존 증권계좌를 활용하면 20영업일 제한을 피할 수 있어요.',
  '미성년(자녀) 계좌는 증권사마다 방식이 달라요(방문/비대면). 개설 전 해당 증권사 확인.',
]

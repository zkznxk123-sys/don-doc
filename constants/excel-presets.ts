// ━━ 타입 ━━
export type FieldKey = 'date' | 'description' | 'amount' | 'withdraw' | 'deposit' | 'category'

export interface ColMap {
  date: string | null
  description: string | null
  amount: string | null     // 부호 포함 단일 금액 열
  withdraw: string | null   // 출금 전용 열
  deposit: string | null    // 입금 전용 열
  category: string | null
}

export interface ExcelPreset {
  id: string
  name: string
  description: string
  /** 이 프리셋을 판별하는 대표 헤더들 */
  signatures: string[]
  /** 일치해야 하는 최소 signature 수 */
  minScore: number
  /** 필드별 후보 컬럼 이름 (앞에서부터 첫 번째 매칭) */
  columnMap: Record<FieldKey, string[]>
}

// ━━ 프리셋 정의 ━━
export const EXCEL_PRESETS: ExcelPreset[] = [
  {
    id: 'banksalad',
    name: '뱅크샐러드',
    description: '뱅크샐러드 가계부 내역 내보내기',
    // 실제 헤더: 날짜 | 시간 | 타입 | 대분류 | 소분류 | 내용 | 금액 | 화폐 | 결제수단 | 메모
    signatures: ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '결제수단'],
    minScore: 5,
    columnMap: {
      date:        ['날짜'],
      description: ['내용'],
      amount:      ['금액'],
      withdraw:    [],
      deposit:     [],
      category:    ['대분류'],
    },
  },
  {
    id: 'shinhan',
    name: '신한은행',
    description: '신한은행 거래내역 내보내기',
    signatures: ['거래일자', '적요', '출금금액', '입금금액', '잔액'],
    minScore: 3,
    columnMap: {
      date:        ['거래일자'],
      description: ['적요', '거래내역'],
      amount:      [],
      withdraw:    ['출금금액'],
      deposit:     ['입금금액'],
      category:    ['분류', '카테고리'],
    },
  },
  {
    id: 'kookmin',
    name: 'KB국민은행',
    description: 'KB국민은행 거래내역 조회',
    signatures: ['거래일시', '거래구분', '거래금액', '잔액'],
    minScore: 3,
    columnMap: {
      date:        ['거래일시', '거래일자'],
      description: ['거래구분', '적요'],
      amount:      ['거래금액'],
      withdraw:    [],
      deposit:     [],
      category:    ['분류', '카테고리'],
    },
  },
  {
    id: 'kakao',
    name: '카카오페이',
    description: '카카오페이 결제내역 내보내기',
    signatures: ['결제일', '가맹점명', '결제금액', '결제수단'],
    minScore: 2,
    columnMap: {
      date:        ['결제일'],
      description: ['가맹점명', '상점명'],
      amount:      ['결제금액'],
      withdraw:    [],
      deposit:     [],
      category:    ['카테고리', '분류'],
    },
  },
  {
    id: 'hana',
    name: '하나은행',
    description: '하나은행 거래내역 조회',
    signatures: ['거래일자', '구분', '출금액', '입금액', '잔액'],
    minScore: 3,
    columnMap: {
      date:        ['거래일자'],
      description: ['구분', '적요', '거래내역'],
      amount:      [],
      withdraw:    ['출금액'],
      deposit:     ['입금액'],
      category:    ['분류', '카테고리'],
    },
  },
  {
    id: 'woori',
    name: '우리은행',
    description: '우리은행 거래내역 조회',
    signatures: ['거래일', '거래시간', '출금액', '입금액', '잔액', '거래점'],
    minScore: 3,
    columnMap: {
      date:        ['거래일'],
      description: ['적요', '거래내역'],
      amount:      [],
      withdraw:    ['출금액'],
      deposit:     ['입금액'],
      category:    ['분류', '카테고리'],
    },
  },
]

// ━━ 범용 폴백 매핑 ━━
const GENERIC_MAP: Record<FieldKey, string[]> = {
  date:        ['날짜', '거래일', '거래일시', '거래일자', 'date', '일자', '거래날짜'],
  description: ['내용', '적요', '거래내역', '메모', '거래명', '거래 내역', 'description', '상호', '가맹점', '가맹점명'],
  amount:      ['금액', '거래금액', '금액(원)', 'amount', '거래액', '원화금액'],
  withdraw:    ['출금', '출금액', '출금(원)', '지출', '출금금액'],
  deposit:     ['입금', '입금액', '입금(원)', '수입', '입금금액'],
  category:    ['카테고리', '분류', 'category', '구분'],
}

// ━━ 공개 함수 ━━

/**
 * 헤더 목록을 분석해 가장 적합한 프리셋을 반환.
 * 일치하는 프리셋이 없으면 null 반환 (→ 범용 감지 사용).
 */
export function detectPreset(headers: string[]): ExcelPreset | null {
  const norm = (s: string) => s.trim().toLowerCase()
  const normHeaders = headers.map(norm)

  let best: ExcelPreset | null = null
  let bestScore = -1

  for (const preset of EXCEL_PRESETS) {
    const score = preset.signatures.filter(sig =>
      normHeaders.includes(norm(sig))
    ).length
    if (score >= preset.minScore && score > bestScore) {
      bestScore = score
      best = preset
    }
  }

  return best
}

/**
 * 프리셋(또는 범용 패턴)을 사용해 실제 헤더에서 ColMap을 구성.
 */
export function buildColMap(headers: string[], preset: ExcelPreset | null): ColMap {
  const norm = (s: string) => s.trim().toLowerCase()
  const normHeaders = headers.map(norm)
  const candidates = preset ? preset.columnMap : GENERIC_MAP

  const find = (keys: string[]): string | null => {
    for (const k of keys) {
      const idx = normHeaders.indexOf(norm(k))
      if (idx !== -1) return headers[idx]
    }
    return null
  }

  return {
    date:        find(candidates.date),
    description: find(candidates.description),
    amount:      find(candidates.amount),
    withdraw:    find(candidates.withdraw),
    deposit:     find(candidates.deposit),
    category:    find(candidates.category),
  }
}

/**
 * 뱅크샐러드 엑셀 전용 파서
 *
 * 실제 파일 구조 기준:
 * - 시트: "가계부 내역" (또는 헤더 자동 탐색)
 * - 헤더: 날짜 | 시간 | 타입 | 대분류 | 소분류 | 내용 | 금액 | 화폐 | 결제수단 | 메모
 * - 날짜/시간: Excel serial number
 * - 타입: "지출" | "수입" | "이체" (이체는 skip)
 */

import * as XLSX from 'xlsx'
import type { BulkTransactionRow } from '@/lib/actions/transaction'

// ━━ 타입 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BanksaladRow extends BulkTransactionRow {
  /** 뱅샐 원본 분류 (대분류 > 소분류), 추후 카테고리 일괄 매핑 UI에 활용 */
  banksaladCategory: string
  /** 결제수단 (표시용) */
  paymentMethod: string
  /** 거래 시각 (HH:MM) */
  time: string
  /** 메모 */
  memo: string
}

export interface AccountBalance {
  name: string
  balance: number
  type: 'CASH' | 'INVESTMENT' | 'PENSION' | 'REAL_ESTATE' | 'DEBT'
}

export interface ParseBanksaladResult {
  rows: BanksaladRow[]
  /** 이체 등 skip된 행 수 */
  skippedCount: number
  /** 전체 데이터 행 수 (skip 포함) */
  totalCount: number
  /** 헤더가 발견된 시트명 */
  sheetName: string
  /** 뱅샐현황 시트에서 파싱한 계좌 잔액 목록 */
  accountBalances: AccountBalance[]
}

// ━━ 상수 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 뱅크샐러드 판별 시트명 후보 */
const BANKSALAD_SHEET_KEYWORDS = ['가계부', '내역']

/** 뱅크샐러드 헤더 판별 시그니처 (이 중 4개 이상 존재하면 매칭) */
const BANKSALAD_HEADER_SIGNATURE = ['날짜', '시간', '타입', '내용', '금액', '대분류', '결제수단']

/** 항상 skip할 소분류 */
const SKIP_MINOR = new Set(['내계좌이체'])

/** 뱅크샐러드 대분류 → 앱 카테고리 매핑 */
const CATEGORY_MAP: Record<string, string> = {
  '식비':         '식비',
  '카페/간식':    '식비',
  '주거/통신':    '주거',
  '교통/차량':    '교통',
  '의류/미용':    '쇼핑',
  '쇼핑':         '쇼핑',
  '의료/건강':    '건강',
  '문화/여가':    '여가',
  '여행/숙박':    '여가',
  '생활':         '생활',
  '교육/학습':    '교육',
  '급여':         '수입',
  '사업수입':     '수입',
  '금융수입':     '수입',
  '기타수입':     '수입',
  '보험금':       '기타',
  '금융':         '기타',
  '용돈':         '생활',
}

// ━━ 내부 유틸 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function mapCategory(대분류: string, 소분류: string): string {
  return CATEGORY_MAP[대분류] ?? CATEGORY_MAP[소분류] ?? '기타'
}

/**
 * Excel serial number → "YYYY-MM-DD"
 * (날짜와 시간이 분리된 뱅샐 포맷 전용)
 */
function excelSerialToDate(serial: unknown): string {
  const n = typeof serial === 'number' ? serial : parseFloat(String(serial))
  if (!n || isNaN(n)) return ''
  const d = XLSX.SSF.parse_date_code(Math.floor(n))
  if (!d) return ''
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}

/**
 * Excel time decimal → "HH:MM"
 * (0.766... = 18:23)
 */
function excelTimeToHHMM(serial: unknown): string {
  const t = typeof serial === 'number' ? serial : parseFloat(String(serial))
  if (!t || isNaN(t) || t <= 0) return '00:00'
  const totalMin = Math.round(t * 24 * 60)
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return raw
  const str = String(raw ?? '').replace(/[,\s원+]/g, '')
  const n = parseFloat(str)
  return isNaN(n) ? 0 : n
}

// ━━ 공개 함수 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 뱅크샐러드 헤더 행 탐색
 * 처음 30행 이내에서 시그니처 헤더가 4개 이상 포함된 행 인덱스 반환.
 * 없으면 -1 반환.
 */
export function findBanksaladHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map(c => String(c ?? '').trim())
    const matched = BANKSALAD_HEADER_SIGNATURE.filter(sig => cells.includes(sig)).length
    if (matched >= 4) return i
  }
  return -1
}

/**
 * 워크북에서 뱅크샐러드 시트 + 헤더 행 자동 탐색.
 * 1) 시트명에 '가계부'/'내역' 포함 → 그 시트에서 헤더 탐색
 * 2) 없으면 모든 시트 순회하며 헤더 탐색
 */
export function detectBanksaladSheet(wb: XLSX.WorkBook): {
  ws: XLSX.WorkSheet | null
  sheetName: string
  headerRowIndex: number
} {
  // 1. 시트명 우선 탐색
  const targetName = wb.SheetNames.find(n =>
    BANKSALAD_SHEET_KEYWORDS.some(kw => n.includes(kw))
  )

  if (targetName) {
    const ws = wb.Sheets[targetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true })
    const hi = findBanksaladHeaderRow(rows)
    // 헤더 못 찾아도 해당 시트 우선 사용 (row 0이 헤더일 가능성)
    return { ws, sheetName: targetName, headerRowIndex: hi >= 0 ? hi : 0 }
  }

  // 2. 모든 시트에서 헤더 탐색
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true })
    const hi = findBanksaladHeaderRow(rows)
    if (hi >= 0) return { ws, sheetName: name, headerRowIndex: hi }
  }

  return { ws: null, sheetName: '', headerRowIndex: -1 }
}

/**
 * 뱅크샐러드 워크시트 → BanksaladRow[] 변환
 *
 * - "이체" 타입 행은 skip
 * - 금액은 뱅샐 원본 그대로 (지출=음수, 수입=양수)
 * - 날짜: YYYY-MM-DD / 시간: HH:MM (별도 필드)
 * - category: 대분류 기반 자동 매핑 + banksaladCategory에 원본 보존
 */
export function parseBanksaladSheet(
  ws: XLSX.WorkSheet,
  headerRowIndex: number,
  familyNames: string[] = []
): Omit<ParseBanksaladResult, 'sheetName' | 'accountBalances'> {
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
  })

  // 헤더 → 컬럼 인덱스 맵
  const headerRow = (allRows[headerRowIndex] ?? []).map(c => String(c ?? '').trim())
  const col = (name: string) => headerRow.indexOf(name)

  const IDX = {
    date:       col('날짜'),
    time:       col('시간'),
    type:       col('타입'),
    major:      col('대분류'),
    minor:      col('소분류'),
    content:    col('내용'),
    amount:     col('금액'),
    payment:    col('결제수단'),
    memo:       col('메모'),
  }

  const dataRows = allRows
    .slice(headerRowIndex + 1)
    .filter(r => r.some(c => c !== '' && c !== null && c !== undefined))

  let skippedCount = 0
  const rows: BanksaladRow[] = []

  for (const raw of dataRows) {
    const 타입 = String(IDX.type >= 0 ? raw[IDX.type] : '').trim()
    const 소분류 = String(IDX.minor >= 0 ? raw[IDX.minor] : '').trim()
    const content = String(IDX.content >= 0 ? raw[IDX.content] : '').trim()

    // 이체 필터링:
    // - 소분류가 "내계좌이체"이면 항상 제외
    // - 내용에 가족 이름이 포함된 이체(가족 간 송금)도 제외
    // - 그 외 이체(외부 송금 등)는 포함
    if (타입 === '이체') {
      const isInternal = SKIP_MINOR.has(소분류)
      // 한글 이름만 이체 필터링에 사용 (영문 ID/닉네임은 은행 명세서와 매칭 안 됨)
      const hasFamilyName = familyNames.some(n => n.length >= 2 && /[가-힣]/.test(n) && content.includes(n))
      if (isInternal || hasFamilyName) {
        skippedCount++
        continue
      }
    }

    const dateStr = excelSerialToDate(IDX.date >= 0 ? raw[IDX.date] : '')
    if (!dateStr) { skippedCount++; continue }  // 날짜 없으면 skip

    const time = excelTimeToHHMM(IDX.time >= 0 ? raw[IDX.time] : 0)
    const amount = parseAmount(IDX.amount >= 0 ? raw[IDX.amount] : 0)

    const 대분류 = String(IDX.major >= 0 ? raw[IDX.major] : '').trim()
    const banksaladCategory = [대분류, 소분류].filter(Boolean).join(' > ')

    rows.push({
      date:               dateStr,
      time,
      description:        String(IDX.content >= 0 ? raw[IDX.content] : '').trim(),
      amount,
      category:           mapCategory(대분류, 소분류),
      visibility:         'SHARED',
      banksaladCategory,
      paymentMethod:      String(IDX.payment >= 0 ? raw[IDX.payment] : '').trim(),
      memo:               String(IDX.memo >= 0 ? raw[IDX.memo] : '').trim(),
    })
  }

  return { rows, skippedCount, totalCount: dataRows.length }
}

// ━━ 자산 유형 → AccountType 매핑 ━━
type AssetAccountType = 'CASH' | 'INVESTMENT' | 'PENSION' | 'REAL_ESTATE' | 'DEBT'

const ASSET_TYPE_MAP: Record<string, AssetAccountType> = {
  '자유입출금': 'CASH',
  '신탁':       'CASH',
  '현금':       'CASH',
  '저축성':     'CASH',
  '전자금융':   'CASH',
  '투자성':     'INVESTMENT',
  '연금':       'PENSION',
  '부동산':     'REAL_ESTATE',
  '부채':       'DEBT',
  '대출':       'DEBT',
  '신용카드':   'DEBT',
}

function resolveAssetType(label: string): AssetAccountType {
  for (const [key, val] of Object.entries(ASSET_TYPE_MAP)) {
    if (label.includes(key)) return val
  }
  return 'CASH'
}

/**
 * 뱅샐현황 시트에서 계좌명 + 잔액 파싱
 * - "항목|상품명||금액" 헤더 행 탐색
 * - col[0]: 자산 유형 (비어있으면 직전 유형 유지)
 * - col[1]: 계좌명
 * - col[3]: 잔액 (숫자)
 * - "총자산" 행에서 파싱 종료
 */
export function parseBanksaladSummary(wb: XLSX.WorkBook): AccountBalance[] {
  const summarySheet = wb.SheetNames.find(n => n.includes('현황') || n.includes('뱅샐'))
  if (!summarySheet) return []

  const ws = wb.Sheets[summarySheet]
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true })

  // 헤더 행 탐색: "항목" + "상품명" + "금액" 포함
  let headerRow = -1
  for (let i = 0; i < Math.min(allRows.length, 60); i++) {
    const cells = allRows[i].map(c => String(c ?? '').trim())
    if (cells.includes('항목') && cells.includes('상품명') && cells.includes('금액')) {
      headerRow = i
      break
    }
  }
  if (headerRow < 0) return []

  const result: AccountBalance[] = []
  let currentType: AssetAccountType = 'CASH'

  for (let i = headerRow + 1; i < allRows.length; i++) {
    const row = allRows[i]
    const col0 = String(row[0] ?? '').trim()
    const col1 = String(row[1] ?? '').trim()
    const col3 = row[3]

    // 종료 시그널
    if (col0 === '총자산' || col0 === '순자산' || col0 === '총부채') break

    // 자산 유형 업데이트 (부채/대출 섹션 포함)
    if (col0 && col0 !== '') currentType = resolveAssetType(col0)

    // 계좌명 + 숫자 잔액이 있는 행만 수집
    const balance = typeof col3 === 'number' ? col3 : parseFloat(String(col3 ?? '').replace(/,/g, ''))
    if (col1 && !isNaN(balance) && balance !== 0) {
      result.push({ name: col1, balance: Math.abs(balance), type: currentType })
    }
  }

  return result
}

/** XLSX WorkBook에서 뱅크샐러드 파일 여부 판단 + 파싱 원스텝 */
export function tryParseBanksalad(wb: XLSX.WorkBook, familyNames: string[] = []): ParseBanksaladResult | null {
  const { ws, sheetName, headerRowIndex } = detectBanksaladSheet(wb)
  if (!ws || headerRowIndex < 0) return null

  const result = parseBanksaladSheet(ws, headerRowIndex, familyNames)
  const accountBalances = parseBanksaladSummary(wb)
  return { ...result, sheetName, accountBalances }
}

/** 뱅크샐러드 카테고리 매핑 테이블 (추후 UI 매핑에 활용) */
export const BANKSALAD_CATEGORY_MAP = CATEGORY_MAP

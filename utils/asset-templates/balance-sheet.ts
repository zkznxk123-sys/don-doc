/**
 * 대차대조표(자산-부채 2D) 템플릿 어댑터.
 *
 * 한 시트에 자산(좌)·부채(우)가 나란히. 자산: 대분류|중분류|항목|금액(원),
 * 부채: 대분류|항목|금액(원). 중분류(현금/투자/은퇴자산)가 타입을 직접 줌.
 * 병합셀(대분류·중분류는 그룹 첫 행만)은 carry-forward로 채운다.
 *
 * 주의: 같은 워크북의 "월별/분기별" 시트는 순자산 *시계열*(다른 데이터)이라
 * 제외 — 상세 대차대조표는 "금액(원)" 헤더 셀로 식별한다(시계열엔 없음).
 */
import * as XLSX from 'xlsx'
import {
  type AssetRow, type AssetTemplateAdapter, type AssetParseResult, type AssetType,
  classifyType, num, isSummaryLabel, extractYearMonth, isExampleSheet,
} from './types'

const clean = (s: unknown) => String(s ?? '').replace(/\s/g, '')

/** 자산 섹션(대분류/중분류) → 타입. 모호하면 항목명으로 classify. */
function assetType(major: string, mid: string, name: string, amount: number): { type: AssetType; uncertain: boolean } {
  const sec = clean(mid) || clean(major)
  if (/현금/.test(sec)) return { type: 'CASH', uncertain: false }
  if (/투자/.test(sec)) return { type: 'INVESTMENT', uncertain: false }
  if (/은퇴|연금/.test(sec)) return { type: 'PENSION', uncertain: false }
  if (/부동산/.test(clean(major))) return { type: 'REAL_ESTATE', uncertain: false }
  return classifyType(name, amount)   // 기타자산 등 — 항목명 키워드로
}

/** 헤더 행(="금액(원)" 셀 보유)을 찾고, 첫/둘째 "금액(원)" 컬럼 인덱스를 반환. */
function findLayout(rows: unknown[][]): { headerRow: number; assetAmtCol: number; debtAmtCol: number } | null {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const cols = (rows[i] || []).map((c, idx) => ({ c: clean(c), idx })).filter(x => /금액\(원\)/.test(x.c))
    if (cols.length >= 2) return { headerRow: i, assetAmtCol: cols[0].idx, debtAmtCol: cols[1].idx }
  }
  return null
}

export function isBalanceSheet(rows: unknown[][]): boolean {
  const titleHit = rows.slice(0, 3).some(r => (r || []).some(c => /대차대조표/.test(String(c))))
  return titleHit && findLayout(rows) !== null
}

export function parseBalanceSheet(rows: unknown[][]): AssetRow[] {
  const layout = findLayout(rows)
  if (!layout) return []
  const { headerRow, assetAmtCol, debtAmtCol } = layout
  const out: AssetRow[] = []

  // ── 자산 (좌): 대분류=amt-3, 중분류=amt-2, 항목=amt-1, 금액=amt ──
  const aMajor = assetAmtCol - 3, aMid = assetAmtCol - 2, aName = assetAmtCol - 1
  let lastMajor = '', lastMid = ''
  for (let i = headerRow + 1; i < rows.length; i++) {
    const major = String(rows[i]?.[aMajor] ?? '').trim()
    const mid = String(rows[i]?.[aMid] ?? '').trim()
    if (major) { lastMajor = major; lastMid = '' }   // 새 대분류 → 중분류 리셋
    if (mid) lastMid = mid
    const name = String(rows[i]?.[aName] ?? '').replace(/\s+/g, ' ').trim()
    const val = num(rows[i]?.[assetAmtCol])
    if (!name || isSummaryLabel(name) || isNaN(val) || val === 0) continue
    const { type, uncertain } = assetType(lastMajor, lastMid, name, val)
    out.push({ name, balance: Math.abs(val), type, sourceCategory: lastMid || lastMajor, uncertain })
  }

  // ── 부채 (우): 항목=amt-1, 금액=amt. 전부 DEBT ──
  const dName = debtAmtCol - 1
  for (let i = headerRow + 1; i < rows.length; i++) {
    const name = String(rows[i]?.[dName] ?? '').replace(/\s+/g, ' ').trim()
    const val = num(rows[i]?.[debtAmtCol])
    if (!name || isSummaryLabel(name) || isNaN(val) || val === 0) continue
    out.push({ name, balance: Math.abs(val), type: 'DEBT', sourceCategory: '부채', uncertain: false })
  }

  return out
}

function sheetRows(wb: XLSX.WorkBook, sn: string): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, blankrows: false, defval: '' })
}

export const balanceSheetAdapter: AssetTemplateAdapter = {
  id: 'balance-sheet',
  name: '대차대조표',
  detect(wb) {
    return wb.SheetNames.some(sn => !isExampleSheet(sn) && isBalanceSheet(sheetRows(wb, sn)))
  },
  parse(wb): AssetParseResult {
    for (const sn of wb.SheetNames) {
      if (isExampleSheet(sn)) continue
      const rows = sheetRows(wb, sn)
      if (!isBalanceSheet(rows)) continue
      const parsed = parseBalanceSheet(rows)
      if (parsed.length === 0) continue
      return { rows: parsed, periods: [{ yearMonth: extractYearMonth(sn), label: sn, rows: parsed }] }
    }
    return { rows: [], periods: [] }
  },
}

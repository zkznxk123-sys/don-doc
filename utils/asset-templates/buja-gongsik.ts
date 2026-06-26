/**
 * 부자공식 가계부 & 자산관리 템플릿 어댑터.
 *
 * "가계부" 시트에 3개 표가 나란히: 지출(col1~3)·순자산(col5~7)·투자(col9~11).
 * 자산 import는 순자산+투자 표만(지출 제외) → AssetRow[].
 */
import * as XLSX from 'xlsx'
import {
  type AssetRow, type AssetTemplateAdapter, type AssetParseResult, type PeriodSnapshot,
  classifyType, num, isSummaryLabel, extractYearMonth, isExampleSheet,
} from './types'

/** 한 표(구분/항목/값 3열)를 추출. 합계·빈행 skip. */
function extractTable(rows: unknown[][], startRow: number, cCat: number, cName: number, cVal: number): AssetRow[] {
  const out: AssetRow[] = []
  for (let i = startRow; i < rows.length; i++) {
    const cat = String(rows[i]?.[cCat] ?? '').trim()
    const name = String(rows[i]?.[cName] ?? '').trim()
    const val = num(rows[i]?.[cVal])
    if (!cat) continue
    if (isSummaryLabel(cat)) continue
    if (isNaN(val) || val === 0) continue
    const { type, uncertain } = classifyType(cat, val)
    out.push({ name: name || cat, balance: Math.abs(val), type, sourceCategory: cat, uncertain })
  }
  return out
}

export function isBujaGongsikSheet(rows: unknown[][]): boolean {
  const joined = rows.slice(0, 4).flat().map(c => String(c)).join(' ')
  return /전체자산\s*-\s*부채/.test(joined) || /투자\s*세부사항/.test(joined)
}

/** 헤더("구분"이 ≥2회 나오는 행)를 찾고, 자산 표 컬럼만 골라 추출(지출/소득 제외). */
export function parseBujaGongsikSheet(rows: unknown[][]): AssetRow[] {
  let headerRow = -1
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const cnt = (rows[i] || []).filter(c => String(c).trim() === '구분').length
    if (cnt >= 2) { headerRow = i; break }
  }
  if (headerRow === -1) return []

  const guboonCols = (rows[headerRow] || [])
    .map((c, idx) => ({ c: String(c).trim(), idx }))
    .filter(x => x.c === '구분')
    .map(x => x.idx)

  const assetCols = guboonCols.filter(gc => {
    const label = String(rows[headerRow - 1]?.[gc] ?? '')
    return /순자산|자산|투자|부채/.test(label) && !/지출|소득|수입/.test(label)
  })

  const out: AssetRow[] = []
  for (const gc of assetCols) out.push(...extractTable(rows, headerRow + 1, gc, gc + 1, gc + 2))
  return out
}

function sheetRows(wb: XLSX.WorkBook, sn: string): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, blankrows: false, defval: '' })
}

export const bujaGongsikAdapter: AssetTemplateAdapter = {
  id: 'buja-gongsik',
  name: '부자공식 가계부',
  detect(wb) {
    // 예시 시트 제외 — 실 데이터 시트가 있을 때만 감지
    return wb.SheetNames.some(sn => !isExampleSheet(sn) && isBujaGongsikSheet(sheetRows(wb, sn)))
  },
  parse(wb): AssetParseResult {
    const periods: PeriodSnapshot[] = []
    for (const sn of wb.SheetNames) {
      if (isExampleSheet(sn)) continue        // 더미/예시 시트 제외
      const rows = sheetRows(wb, sn)
      if (!isBujaGongsikSheet(rows)) continue
      const parsed = parseBujaGongsikSheet(rows)
      if (parsed.length === 0) continue
      periods.push({ yearMonth: extractYearMonth(sn), label: sn, rows: parsed })
    }

    // 월 정보 있는 것끼리 시간순 정렬 → 최신을 대표(현재 잔액)로
    periods.sort((a, b) => (a.yearMonth ?? '').localeCompare(b.yearMonth ?? ''))
    const latest = periods[periods.length - 1]
    return { rows: latest ? latest.rows : [], periods }
  },
}

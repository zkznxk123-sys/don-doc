/**
 * 자산 템플릿 정규화 레지스트리.
 *
 * 새 입력 양식 지원 = 어댑터 1개 만들어 ASSET_TEMPLATES에 등록. 드로어·서버는
 * detectAssetTemplate() 단일 진입점만 호출 → 양식이 늘어도 호출부는 안 바뀜.
 */
import type * as XLSX from 'xlsx'
import type { AssetRow, AssetTemplateAdapter, PeriodSnapshot } from './types'
import { bujaGongsikAdapter } from './buja-gongsik'
import { balanceSheetAdapter } from './balance-sheet'

export type { AssetRow, AssetType, AssetTemplateAdapter, PeriodSnapshot, AssetParseResult } from './types'

/** 등록된 어댑터. 위에서부터 먼저 detect 성공한 것을 사용. */
export const ASSET_TEMPLATES: AssetTemplateAdapter[] = [
  bujaGongsikAdapter,
  balanceSheetAdapter,
]

export interface AssetDetectResult {
  id: string
  name: string
  rows: AssetRow[]              // 최신 시점 = 현재 잔액 등록용
  periods: PeriodSnapshot[]     // 월별 스냅샷 전체 (2개↑면 순자산 추이 import)
  latestLabel: string | null    // 대표 스냅샷의 표시 라벨 ("25년 12월 가계부")
  monthlyCount: number          // yearMonth 있는 스냅샷 수
}

/**
 * 워크북을 보고 맞는 자산 템플릿을 찾아 정규화 결과를 반환.
 * 일치 없거나 추출 0건이면 null.
 */
export function detectAssetTemplate(wb: XLSX.WorkBook): AssetDetectResult | null {
  for (const adapter of ASSET_TEMPLATES) {
    if (!adapter.detect(wb)) continue
    const { rows, periods } = adapter.parse(wb)
    if (rows.length === 0) continue
    const monthly = periods.filter(p => p.yearMonth)
    const latest = periods[periods.length - 1] ?? null
    return {
      id: adapter.id, name: adapter.name, rows, periods,
      latestLabel: latest ? latest.label : null,
      monthlyCount: monthly.length,
    }
  }
  return null
}

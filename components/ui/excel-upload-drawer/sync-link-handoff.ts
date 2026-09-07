/**
 * 엑셀 업로드 드로어 → 자산 연결 보드 페이지(/dashboard/assets/link) 상태 핸드오프.
 * 파일 자체는 못 넘기므로 파싱된 자산 행과 사용자가 고른 것들만 sessionStorage로 전달한다.
 */
import type { AccountBalance } from '@/utils/excel-parser'
import type { SyncDecisionInput } from '@/lib/actions/transactions/_account-sync'

export const SYNC_LINK_HANDOFF_KEY = 'dondoc:sync-link-handoff'

export interface SyncLinkHandoff {
  fileName: string | null
  accountBalances: AccountBalance[]
  ownerUserId: string
  excludedNames: string[]
  decisions: Record<string, SyncDecisionInput>
  autoCreate: boolean
  savedAt: number
}

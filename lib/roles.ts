export type AppRole = 'CFO' | 'CO_CFO' | 'MEMBER'

/** CFO 또는 CO_CFO — 관리자 수준 권한 여부 */
export function isCFOLevel(role: string | null | undefined): boolean {
  return role === 'CFO' || role === 'CO_CFO'
}

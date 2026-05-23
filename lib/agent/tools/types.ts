// AI 어시스턴트 tool factory 함수의 공통 context.
// 각 도메인 파일은 buildXTools(ctx: ToolContext)로 export.

import type { AuthUser } from '@/lib/auth'

export interface ToolContext {
  user: AuthUser
  familyId: string // user.familyId의 narrowing — buildAgentTools에서 가족 미가입은 emptyTools()로 fallback
}

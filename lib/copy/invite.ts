/**
 * 가족 초대 문구 — 단일 출처 (designer 7/12: 3곳 중복이 라운드마다 한 곳씩 어긋나던 문제).
 * BRAND_GUIDE §4: 이모지·"앱" 프레임 금지. 문구 수정은 여기 한 곳만.
 */
export function inviteMessage(inviteUrl: string): string {
  return `여보, 우리 집 자산 관리를 위해 초대해요.\n돈독에서 함께 가족 자산을 관리해요.\n\n링크: ${inviteUrl}`
}

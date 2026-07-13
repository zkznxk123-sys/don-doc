/**
 * IPO 화면 웜 시맨틱 톤 — SaaS 무지개(amber·emerald·sky·rose) 대신 단일 출처.
 * 매핑(designer 2026-07-10): 청약=골드 · 상장=세이지 · 환불/SPAC=슬레이트블루 ·
 * 임박/초과/삭제=테라코타 · 준비경고=warning(--viz-copper 시맨틱 유틸).
 * raw 팔레트 클래스는 eslint 가드(schedule-view·account-planner)로 차단 —
 * 새 색이 필요하면 여기에 시맨틱 이름으로 추가할 것.
 */

// 칩(배경 틴트 + 텍스트) — 라이트/다크 대비 보정
export const GOLD_CHIP = 'bg-[#C9A54A]/15 text-[#8B6F26] dark:text-[#D6B45E]'
export const SAGE_CHIP = 'bg-[#5E8A72]/15 text-[#3E6B52] dark:text-[#8FB79F]'
export const SLATE_CHIP = 'bg-[#7E8AA0]/15 text-[#525F78] dark:text-[#A3AEC2]'
export const TERRA_CHIP = 'bg-[#C0553D]/12 text-[#A03E28] dark:text-[#D98A75]'

// 텍스트 단독
export const SAGE_TEXT = 'text-[#4A7A60] dark:text-[#8FB79F]'
export const TERRA_TEXT = 'text-[#B24A32] dark:text-[#D98A75]'
export const SLATE_TEXT = 'text-[#67748E] dark:text-[#A3AEC2]'

// 도트·행 틴트·강조 테두리
export const GOLD_DOT = 'bg-[#C9A54A]'
export const SAGE_DOT = 'bg-[#5E8A72]'
export const TERRA_SOLID = 'bg-[#C0553D] text-white'
export const SAGE_ROW = 'bg-[#5E8A72]/8 dark:bg-[#5E8A72]/12'
export const TERRA_CARD = 'border-[#C0553D]/40 bg-[#C0553D]/5'

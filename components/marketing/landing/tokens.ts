/**
 * Landing 페이지 디자인 토큰. 2026-06-11 라이트 단일로 전환.
 * 사용자 input: "다크가 부담스러워서" → dark-luxury 폐기 결정.
 *
 * 이름 매핑 (다크 → 라이트, 의미 반전):
 * - BG    : 다크 캔버스 → warm off-white canvas
 * - INK : 다크 위 본문 텍스트(밝은) → 라이트 위 본문 텍스트(어두운 ink)
 *           ※ 이름이 misleading하나 8개 파일 import 호환 위해 값만 교체.
 *           추후 INK·CANVAS 등으로 별도 rename PR.
 * - ACCENT: gold(#B49B3E)는 라이트 BG에서 머스타드로 떨어져 forest로 전환.
 *
 * 컨트라스트: BG vs INK 16:1 (AAA), BG vs INK_DIM ~10:1 (AAA),
 * BG vs ACCENT 7.5:1 (AAA large·AA normal).
 */

export const BG = '#FAF8F3'                      // warm off-white canvas
export const BG_2 = '#F2EEE3'                    // subtle alt surface
export const BG_3 = '#E8E2D0'                    // deeper surface (accent zones)
export const ACCENT = '#2F5D4F'                  // forest green — primary action·italic
export const INK = '#1A1F1E'                   // body text (deep forest ink)
export const INK_DIM = 'rgba(26,31,30,0.64)'   // secondary text
export const INK_FAINT = 'rgba(26,31,30,0.14)' // border·divider
export const POSITIVE = '#2F8A6E'                // 라이트 톤 positive

/* ────────────────────────────────────────────────────────────────────────
 * Solid Modern — 마케팅/공모주 다크 표면 (brand-guide-2.0-solid-modern.md).
 * 랜딩 다크 마이그레이션(2026-07-07). 딥 포레스트 + 강한 골드 + 숫자 히어로.
 * ──────────────────────────────────────────────────────────────────────── */
export const SM_SURFACE = '#182A24'                    // 딥 포레스트/네이비 바탕
export const SM_PANEL = '#1F2E28'                      // 카드·패널
export const SM_RAISED = '#26362F'                     // 떠 있는 요소·호버
export const SM_INK = '#F4F1E9'                        // 본문(웜 화이트)
export const SM_INK_DIM = 'rgba(244,241,233,0.62)'     // 보조 텍스트
export const SM_HAIRLINE = 'rgba(201,165,74,0.20)'     // 골드 hairline·구분선
export const GOLD = '#C9A54A'                          // accent·CTA·숫자 강조·차트
export const GOLD_SOFT = 'rgba(201,165,74,0.12)'       // 골드 배경 틴트
export const TERRACOTTA = '#C0553D'                    // 하락·지출 시맨틱

/**
 * open redirect 차단 — 문자열 접두사가 아니라 **해석된 origin**으로 판정한다.
 *
 * 접두사 검사(`startsWith('/') && !startsWith('//')`)는 뚫린다: WHATWG URL 파서가
 * 특수 스킴에서 백슬래시를 경로 구분자로 취급하므로 `/\evil.com`·`/\/evil.com`이
 * 검사를 통과한 뒤 `https://evil.com`으로 해석된다(2026-09-09 실측).
 *
 * 파서에게 먼저 해석시키고 그 결과의 origin이 우리 것인지만 본다. 인코딩 트릭은
 * 파서가 이미 정규화한 뒤라 통하지 않는다.
 *
 * @param target 사용자가 준 이동 대상 (쿼리파라미터 등 — 신뢰하지 않는다)
 * @param base   현재 요청 URL. 이 origin 밖으로 나가는 값은 전부 fallback 으로 떨어뜨린다
 * @returns 같은 origin 안의 경로 문자열, 아니면 fallback
 */
export function safeRedirect(target: string | null | undefined, base: string, fallback = '/sign-in'): string {
  if (!target) return fallback
  try {
    const resolved = new URL(target, base)
    if (resolved.origin !== new URL(base).origin) return fallback
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return fallback
  }
}

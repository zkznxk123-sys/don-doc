/**
 * 제품 라인 분기 — full(개인 가족 전체 기능) vs lite(대중 공개·압축).
 * specs/product-split-decision-20260610.md 참조.
 *
 * env var `NEXT_PUBLIC_PRODUCT_LINE`로 빌드·런타임 분기. 미설정 시 `full`.
 *
 * lite 라인에서 제외되는 기능:
 *   - 가족 공유·초대·CFO 권한 (3-Layer Role/Share/Visibility 전체)
 *   - AI 시나리오 허브
 *   - 매매 자동 연동 (TradeRecord 자동 거래 생성)
 *   - 연금 상세 (PensionDetail·세액공제)
 *   - 가족 피드
 *   - CLIProxy 본인 OAuth (lite는 시스템 API key 공용)
 *
 * lite 라인 포함:
 *   - 엑셀 업로드 + AI 자동분류 (HITL)
 *   - 자산 등록 (전 타입)
 *   - 내역 관리 (필터·검색·편집·일괄)
 */

export type ProductLine = 'full' | 'lite'

/**
 * 현재 빌드의 제품 라인. NEXT_PUBLIC_* 변수라 client·server 양쪽에서 같은 값.
 */
export function getProductLine(): ProductLine {
  const line = process.env.NEXT_PUBLIC_PRODUCT_LINE
  return line === 'lite' ? 'lite' : 'full'
}

export function isFull(): boolean {
  return getProductLine() === 'full'
}

export function isLite(): boolean {
  return getProductLine() === 'lite'
}

/**
 * 기능별 가용성 매핑 — 새 기능 추가 시 여기에 등록.
 * 컴포넌트·route에서 `features.scenarios` 같은 단일 진입점으로 분기.
 */
export const features = {
  /** AI 시나리오 허브 (/dashboard/scenario) */
  get scenarios(): boolean { return isFull() },

  /** 가족 피드 (/dashboard/feed) */
  get familyFeed(): boolean { return isFull() },

  /** 가족 멤버 관리·초대 (/dashboard/family) */
  get familyManagement(): boolean { return isFull() },

  /** TradeRecord 자동 거래 연동 (매매·배당·세금) */
  get tradeAutoLink(): boolean { return isFull() },

  /** 연금 상세 (세액공제·납입계획 등 PensionDetail) */
  get pensionDetail(): boolean { return isFull() },

  /** CLIProxy 본인 OAuth (lite는 시스템 API key 공용) */
  get familyOAuth(): boolean { return isFull() },

  /** 거래 visibility 3-Layer (Role/Share/Visibility) */
  get visibilityRoles(): boolean { return isFull() },

  /** 종목 검색 스크리너 (/dashboard/screen) — Beta + Yahoo 무료 API 의존, 대중 lite 부적합 */
  get stockScreen(): boolean { return isFull() },

  /** 공모주·스팩 청약 원장 (/dashboard/ipo) — BETA. 대중 lite 미노출, 별도 커뮤니티 공개 예정 (2026-07-02 결정) */
  get ipoLedger(): boolean { return isFull() },
} as const

/**
 * lite에서 차단되는 dashboard route prefix 목록.
 * middleware가 redirect 또는 404 처리.
 */
export const LITE_BLOCKED_ROUTES: readonly string[] = [
  '/dashboard/scenario',
  '/dashboard/family',
  '/dashboard/feed',
  '/dashboard/screen',
  '/dashboard/ipo',
] as const

export function isRouteBlockedInLite(pathname: string): boolean {
  if (isFull()) return false
  return LITE_BLOCKED_ROUTES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

/* ────────────────────────────────────────────────────────────────────────
 * cohort 엔타이틀먼트 — lite/full 위에 얹는 per-user 3번째 축.
 * 커뮤니티 웨지(예: 공모주/스팩 cohort)는 "IPO만 켜고 나머지 대시보드를 끈다"
 * = lite/full의 역방향 게이트. specs/ipo-spac-wedge-v1.md 참조.
 *
 * cohort 값은 Clerk publicMetadata.cohort에 저장. middleware는 session claims로,
 * 서버 컴포넌트/클라이언트는 currentUser()/useUser() publicMetadata로 읽는다.
 * 미설정 시 null = 일반 사용자 = 게이트 미작동(fail-safe: 영향 0).
 * ──────────────────────────────────────────────────────────────────────── */

export type Cohort = 'ipo-spac'

const KNOWN_COHORTS: readonly string[] = ['ipo-spac'] as const

/** Clerk publicMetadata(또는 session claims metadata)에서 cohort 파싱. 알 수 없으면 null. */
export function parseCohort(metadata: unknown): Cohort | null {
  if (metadata && typeof metadata === 'object' && 'cohort' in metadata) {
    const c = (metadata as { cohort?: unknown }).cohort
    if (typeof c === 'string' && KNOWN_COHORTS.includes(c)) return c as Cohort
  }
  return null
}

/** cohort 사용자가 접근 가능한 route (역방향 allowlist — 이것만 통과, 나머지 대시보드는 차단).
 *  순수 IPO 웨지 — 공모주·스팩만. 설정 제외(로그아웃=사이드바 하단 버튼, 테마=상단바로 대체). */
export const WEDGE_ALLOWED_ROUTES: readonly string[] = [
  '/dashboard/ipo',
] as const

/** cohort 사용자의 홈 (로그인 후 진입 지점). */
export const WEDGE_HOME = '/dashboard/ipo'

/**
 * cohort 사용자에게 이 dashboard route가 차단되는가.
 * 대시보드 밖(랜딩·인증·온보딩)은 관여하지 않는다 — dashboard 내부만 제한.
 */
export function isRouteBlockedForCohort(cohort: Cohort | null, pathname: string): boolean {
  if (!cohort) return false
  if (!pathname.startsWith('/dashboard')) return false
  return !WEDGE_ALLOWED_ROUTES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

/**
 * cohort 사용자가 접근 가능한 API prefix (역방향 allowlist). 이것 밖의 도메인 API는 차단.
 * 방어심층 — UI에서 가려져도 endpoint 직접 호출을 막는다.
 */
export const WEDGE_ALLOWED_API: readonly string[] = [
  '/api/ipo',
  '/api/me',
  '/api/health',
] as const

export function isApiBlockedForCohort(cohort: Cohort | null, pathname: string): boolean {
  if (!cohort) return false
  if (!pathname.startsWith('/api')) return false
  return !WEDGE_ALLOWED_API.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

/**
 * API route 진입부에서 lite 빌드 차단 (방어심층). middleware가 dashboard
 * 페이지만 차단하므로 API endpoint는 별도 가드 필요. lite 사용자는 가족이
 * 없어 빈 응답이 되지만, 응답 자체를 막아 정보 노출·기능 우회 차단.
 *
 * 사용:
 *   export async function GET(req: Request) {
 *     const blocked = blockIfLite()
 *     if (blocked) return blocked
 *     // ... 정상 로직
 *   }
 */
export const LITE_BLOCKED_MESSAGE = 'lite 제품에서 제공하지 않는 기능입니다.'

export function blockIfLite(): Response | null {
  // 빈 body는 클라이언트의 무조건 .json() 파싱을 깨뜨린다 — 항상 JSON body 포함
  if (isLite()) {
    return Response.json({ success: false, error: LITE_BLOCKED_MESSAGE }, { status: 404 })
  }
  return null
}

/**
 * 서버 액션 진입부에서 lite 빌드 차단 (방어심층). 서버 액션도 POST 엔드포인트로
 * 직접 호출 가능하므로, lite UI에서 가려진 것과 별개로 액션 자체를 막는다.
 * lite에서도 쓰이는 액션(createFamily 자동 1인 가족 등)에는 걸지 말 것 —
 * 과잉 가드 회귀 사례: 7f6fc0e (family/info 차단 → budget crash).
 */
export function assertFullProduct(): void {
  if (isLite()) throw new Error(LITE_BLOCKED_MESSAGE)
}

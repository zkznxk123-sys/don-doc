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

  /** 공모주·스팩 (/dashboard/ipo) — full=전체 노출, lite=cohort 해금(canUseIpo). 2026-07-12 통합 */
  get ipoLedger(): boolean { return isFull() },
} as const

/**
 * lite에서 차단되는 dashboard route prefix 목록.
 * middleware가 redirect 또는 404 처리.
 * ※ /dashboard/ipo는 여기서 제외 — 전면 차단이 아니라 cohort 해금(isIpoBlockedForUser).
 */
export const LITE_BLOCKED_ROUTES: readonly string[] = [
  '/dashboard/scenario',
  '/dashboard/family',
  '/dashboard/feed',
  '/dashboard/screen',
] as const

export function isRouteBlockedInLite(pathname: string): boolean {
  if (isFull()) return false
  return LITE_BLOCKED_ROUTES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

/* ────────────────────────────────────────────────────────────────────────
 * cohort 엔타이틀먼트 — lite/full 위에 얹는 per-user 3번째 축.
 * 2026-07-12 개편: 제한형(웨지 사용자는 IPO만) → **해금형**(lite에서 cohort가
 * 있으면 IPO가 추가로 열림). "별도 IPO 전용 버전"은 폐기 — 표면은 lite 하나,
 * 공모주는 초대 링크(/join/ipo-spac)로 받은 사람에게만 노출(컴플라이언스 초대제 유지).
 *
 * cohort 값은 Clerk publicMetadata.cohort에 저장. middleware는 session claims로,
 * 서버 컴포넌트/클라이언트는 getAuthUser().cohort로 읽는다.
 * 미설정 시 null = 일반 사용자 = lite에선 IPO 미노출(fail-safe).
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

/** 초대 합류 후 착지 지점 (/join/{cohort} redirect). */
export const IPO_HOME = '/dashboard/ipo'

/** 이 사용자가 공모주·스팩을 쓸 수 있는가 — full=항상, lite=cohort 보유 시. */
export function canUseIpo(cohort: Cohort | null): boolean {
  return isFull() || cohort != null
}

/** lite에서 cohort 없는 사용자의 IPO route/API 접근 차단 판정 (middleware·가드 공용). */
export function isIpoBlockedForUser(cohort: Cohort | null, pathname: string): boolean {
  if (canUseIpo(cohort)) return false
  return pathname === '/dashboard/ipo' || pathname.startsWith('/dashboard/ipo/')
    || pathname === '/api/ipo' || pathname.startsWith('/api/ipo/')
}

/** IPO API route 진입부 가드 — lite + cohort 없음이면 404 JSON (방어심층). */
export function blockIpoIfNotEntitled(cohort: Cohort | null): Response | null {
  if (canUseIpo(cohort)) return null
  return Response.json({ success: false, error: LITE_BLOCKED_MESSAGE }, { status: 404 })
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

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
} as const
// (구 ipoLedger flag 삭제 — IPO는 독립 앱 분리 결정(2026-08-10)으로 nav 미노출, 화면은 직접 URL 존치)

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
 * ※ 2026-08-10 IPO 독립 앱 분리 결정으로 해금 게이트·초대 라우트는 제거됨.
 * parseCohort만 잔존 — getAuthUser가 기존 사용자 metadata를 계속 읽는 가드레일 계약.
 *
 * cohort 값은 Clerk publicMetadata.cohort에 저장. 서버 컴포넌트/클라이언트는
 * getAuthUser().cohort로 읽는다. 미설정 시 null.
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

// 2026-08-10 전략 전환: 공모주 IPO를 독립 앱으로 분리 결정 → cohort 해금 게이트 제거.
// canUseIpo·isIpoBlockedForUser·blockIpoIfNotEntitled 삭제. 2026-08-13 후속: nav 미노출
// (AppSidebar 빌드 필터) + 초대 라우트 /join/[cohort]·IPO_HOME 제거. 화면·데이터는 독립 앱
// 이관까지 직접 URL로 존치. parseCohort는 존치 — getAuthUser가 읽는 8/5 가드레일 계약.
// (참고: [[project_dondoc_community_wedge]] 폐기)

/**
 * 종목 리서치 베타(딥다이브·ETF NAV) per-user 게이트 — 4번째 축.
 * 컴플라이언스 전제("개인 비공개 도구", stock-research-desk 노트 §6)를 코드로 보증:
 * 적정가·매도시그널 등 유사투자자문 민감 출력은 RESEARCH_BETA_EMAILS(콤마 구분) 등재
 * 계정만 접근. **미설정 시 전원 차단(fail-closed)** — 프로덕션에 env가 없으면 자동 안전.
 * 라인 게이트(blockIfLite)와 축이 다름: full 라인에서도 본인 외엔 닫힌다.
 */
export function canUseResearchBeta(email: string | null | undefined): boolean {
  const allow = (process.env.RESEARCH_BETA_EMAILS ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (!allow.length || !email) return false
  return allow.includes(email.toLowerCase())
}

/** 리서치 베타 API 진입부 가드 — 미허용 계정이면 404 JSON (존재 자체 미노출). */
export function blockResearchBetaIfNotAllowed(email: string | null | undefined): Response | null {
  if (canUseResearchBeta(email)) return null
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

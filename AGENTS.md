# 돈독 (don Doc) — AGENTS.md

1인 자산 본부 도구 (선택적 가족·동업자 공유). Next.js 16 App Router 기반.

---

## 기술 스택

| 분류 | 스택 |
|------|------|
| 프레임워크 | Next.js 16.2.x (App Router, Turbo dev) |
| 인증 | Clerk (@clerk/nextjs) |
| 런타임 | React 19 + TypeScript 6 |
| DB | PostgreSQL + Prisma 6 |
| 스타일 | Tailwind CSS 4 (CSS-first @theme) + shadcn/ui (Radix UI) |
| AI | Vercel AI SDK 7 + OpenAI — 텍스트=gpt-4o-mini(LLM-Mux 경유), vision(자산 스샷)=gpt-4o(extract-image 직접 호출) |
| 알림 | Sonner (toast) |
| 차트 | Recharts 3 |
| 엑셀 | xlsx 라이브러리 |
| 배포 | Vercel |

---

## 디렉토리 구조

```
app/
  api/              # API 라우트
    ai/             # categorize · chat · insights · map-categories · recategorize · status · oauth-*
    auth/           # me · sync-user · logout · demo
    transactions/   # CRUD + list
    accounts/       # CRUD + holdings
    family/         # create · info · invite · join · member · reset
    cashflow/       # goals
    wealth/
    budget/
    dashboard/      # 대시보드 집계
    demo/data/      # 무인증 데모 데이터 노출 (실명·실숫자 점검 필요)
    stocks/         # fundamental · screen · search · universe
    scenario/       # chat · expand · generate (임베딩 기반 부분 대체)
    realestate/     # complexes · price · search (getAuthUser 가드 적용 — 외부 API 키 보호)
    stats/          # cashflow · insights
    frankr/         # fran.kr 세금 계산 API 프록시 (보유세·취득세·양도세·증여세·상속세)
    ipo/            # quote · competition · workspace (공모주 — 아래 전용 섹션 참고)
    user/           # preferences (User.preferences 저장 — sanitizePreferences 검증)
    health/         # DB keep-alive — Supabase 무료 티어 auto-pause 방지.
                    # vercel.json cron 1일 1회. 미호출 시 로그인 /sign-in↔/dashboard 루프(8/2 장애)
  dashboard/        # 보호된 페이지
    cashflow/       # 현금흐름 관리
    assets/         # 자산 관리
    budget/         # 예산 관리
    settings/       # 설정 + categories
    family/         # 가족 관리
    transactions/   # 거래 목록
    uploads/        # 엑셀 업로드 이력
    scenario/       # 시나리오 허브 (Beta)
    screen/         # 종목 비주얼 스크리너 (Beta)
    feed/           # 가족 피드 — nav 제거됨(5/22), 추후 위젯/설정으로 이동
  onboarding/

components/
  ui/               # 공용 UI
    transaction-drawer.tsx   # 거래 개별수정
    trade-drawer.tsx         # 매매 기록 (viz 토큰 사용)
    excel-upload-drawer.tsx  # 본체 (<1,000줄)
    excel-upload-drawer/     # 서브모듈 — parsers·preview-components(DetectionBadge·ImagePreExtractPanel 등)
    account-drawer.tsx
  layout/
    DashboardShell.tsx       # 컨텍스트 + openTransactionDrawer
    AppSidebar.tsx           # core/beta/admin 3그룹 nav
    Header.tsx               # 디자인 토큰 기반 (bg-card·border-border)
  marketing/
    LandingPage.tsx          # 랜딩 — Solid Modern 다크+골드 (2026-07-08 다크 전환). 히어로=landing/VideoHeroLight. isFull()로 Comparison 분기
  dashboard/
    InputGuide.tsx

lib/
  feature-flags.ts  # 제품 라인 분리 (full/lite) — 단일 진입점, features 8-flag
  actions/          # 서버 액션 ('use server')
    transactions/
      bulk.ts            # createManyTransactions·syncAccountBalancesOnly (server action)
      _account-sync.ts   # resolveAccountSyncPlan helper (private, testable, no 'use server')
      _dedup.ts          # dedupPendings helper
    transaction.ts  # 거래 CRUD, bulkUpdate
    investments.ts  # 매매 기록 (addTradeRecord — prisma.$transaction 원자성)
    categories.ts   # getFamilyCategories, addCustomCategory
    accounts.ts
    budget.ts
    scenario/       # 도메인 분할 (types, helpers, content-sources, generate, manage)
    family.ts
    feed.ts
    wealth.ts
    preferences.ts  # 사용자 카테고리 학습 데이터
  agent/            # AI 채팅 어시스턴트
    tools/          # tool calling 정의 (도메인별 분할 완료)
    system-prompt.ts
  ingestion/        # 자산 적재 — LLM/vision 추출
    llm-extract.ts  # extractSheetWithLLM(텍스트)·extractImageWithLLM(vision) — utils/asset-templates 미감지 시 폴백
  data/             # 종목 universe·preset·섹터 매핑
    stock-universe.ts
    screen-presets.ts
    sector-mapping.ts
  ipo/              # 공모주 순수 로직 — allocation.ts(배정·예산배분 계산)·store.ts(DB+localStorage 이중 영속)
  etf/              # ETF 추정 NAV — nav.ts(순수 계산)·registry.ts·sources/
  stock/            # deep-dive.ts (종목 심층 분석)
  frankr/           # fran.kr 세금 API 클라이언트 (client.ts·types.ts)
  hooks/            # useAssetThreshold·useDefaultVisibility·useServerPreference (User.preferences 소비)
  copy/             # invite.ts — 초대 문구
  utils/
    dart-fundamental.ts
    yahoo-fundamental.ts
    yahoo-momentum.ts
    stock-screener.ts
    historical-fx.ts        # 과거 일자 USD-KRW lookup
    original-hash.ts        # 엑셀 원본 SHA-256 (중복 업로드 차단)
    transaction-hash.ts     # 거래 fingerprint (date+amount+description+accountId)
    account-type-labels.ts
  auth.ts           # getAuthUser() — 모든 서버 액션/API 진입점
  prisma.ts         # Prisma 싱글톤 (빌드 안전)
  ai.ts             # LLM-Mux 추상화
  roles.ts          # isCFOLevel(role) — CFO·CO_CFO 통합 판정
  user-preferences.ts  # User.preferences Json 키 스키마
  *-calc.ts         # 순수 계산 모듈 (+ 동명 .test.ts) — budget·cashflow·networth·stats.
                    # 'use server' 밖 순수 함수 + 테스트 고정이 원칙. 서버 액션은 DB 조회·오케스트레이션만

prisma/
  schema.prisma     # DB 스키마
  seed-categories.ts  # 시스템 기본 카테고리 시드 (배당·매매수수료·투자손실 포함)

utils/
  excel-parser.ts   # 뱅크샐러드 엑셀 파서
```

---

## 핵심 패턴

### 인증
```typescript
// 모든 서버 액션 / API 라우트 시작
const user = await getAuthUser()
if (!user) return { error: 'Unauthorized' }
```

### 서버 액션 반환 형식
```typescript
return { success: true, data: ... }
return { success: false, error: '메시지' }
```

### 카테고리 로드
```typescript
import { getFamilyCategories } from '@/lib/actions/categories'
const categories = await getFamilyCategories()
// type: 'EXPENSE' | 'INCOME', familyId: null(시스템) or familyId(커스텀)
```

### 역할
- `CFO` — 전체 접근, 가족 관리
- `CO_CFO` — 공동 관리자 (CFO와 동일한 접근 권한, 부부 공동 관리 등). `isCFOLevel(role)` helper로 CFO·CO_CFO 통합 판정
- `MEMBER` — 본인 + SHARED 거래만

### 트랜잭션 가시성
- `SHARED` — 가족 전체 공개
- `PRIVATE` — 금액만 노출, 내용 마스킹
- 자동 생성(매매·실현손익·배당·수수료) default = `PRIVATE` (5/22~)

### 계좌 공유 (ShareLevel)
- `PUBLIC` — 이름·금액·거래 내역 모두 공개
- `BALANCE_ONLY` — 이름·금액만, 거래 마스킹
- `PRIVATE` — 본인만

### 제품 라인 분리 (full / lite)
2026-06-10 도입. `NEXT_PUBLIC_PRODUCT_LINE=full|lite` 빌드 타임 환경변수 1개로 두 라인 분기. `lib/feature-flags.ts` 단일 진입점:

```typescript
import { features, isFull, isLite } from '@/lib/feature-flags'

if (features.familyManagement) { /* full 전용 */ }
if (isLite()) { /* lite 분기 */ }
```

- **features 8-flag**: `scenarios`·`familyFeed`·`familyManagement`·`tradeAutoLink`·`pensionDetail`·`familyOAuth`·`visibilityRoles`·`stockScreen` (구 `ipoLedger`는 2026-08-10 IPO 독립 앱 분리로 삭제)
- **lite 라인**: 위 8개 모두 false. 가입 직후 `createFamily('내 자산')` 자동 1인 가족. 초대 UI 미노출.
- **route 차단**: `LITE_BLOCKED_ROUTES`(`/dashboard/scenario`, `/dashboard/family`, `/dashboard/feed`, `/dashboard/screen`)는 `lib/feature-flags.ts`에 정의, `middleware.ts`가 `isRouteBlockedInLite()`로 redirect. `/dashboard/ipo`는 여기 없음 — nav 미노출·직접 URL만(2026-08-13), 구 cohort 해금 게이트는 삭제됨.
- **랜딩 분기**: `LandingPage.tsx`에서 `{isFull() && <ComparisonSection />}`. CoreFeatures·Closing은 양쪽 공통.
- **lite 가드 3층**: middleware(route redirect) + API route(`blockIfLite()` 13곳 — family 5종(create·invite·join·member·reset)·scenario 3종·stocks 3종(screen·deep-dive·etf-nav)·ai extract 2종, `family/info` GET은 lite 1인 가족도 필요해 제외) + 서버 액션(`isLite()` 진입부 가드 — feed·scenario·oauth 전체, family는 `getLatestInviteCode`/`joinFamily`만). 과잉 가드 주의: lite도 1인 가족이 존재한다 (`7f6fc0e` budget crash 사례).

---

## DB 주요 모델

- **FamilyGroup** — 가족 단위 (중심)
- **User** — clerkId 연동, role(CFO/CO_CFO/MEMBER), preferences(Json — 자산 임계값·기본 가시성 등 개인 설정, 기기 간 동기화. 키 스키마는 `lib/user-preferences.ts`)
- **Account** — 자산/부채 계좌 (CASH, INVESTMENT, PENSION, REAL_ESTATE, DEBT 등)
- **Transaction** — 수입/지출, category, isExcluded, excludeFromBudget, tradeRecordId(매매 자동 연동), visibility(기본 PRIVATE)
- **Category** — familyId=null(시스템 공통) or familyId(가족 커스텀)
- **UserCategoryPreference** — AI 자동분류 학습 (keyword → categoryId)
- **Budget** — 월별 예산
- **NetWorthSnapshot** — 순자산 스냅샷 이력
- **InvestmentHolding** — 종목 보유 (accountId, ticker, name, quantity, avgPrice, currency)
- **TradeRecord** — 매매 기록 (holdingId, type=BUY/SELL/DIVIDEND/SPLIT). 등록 시 Transaction 자동 생성 — 실현손익·배당·수수료를 가계부에 반영
- **ExchangeRate** — USD-KRW 환율 스냅샷
- **FamilyPost** — 가족 피드 게시물 (+PostComment·PostReaction)
- **Scenario** — 시나리오 분석 (임베딩 기반 부분 대체·비교 뷰)
- **ExcelMapping** — 엑셀 표기명 → dondoc 계좌 매핑 (Phase A~D 신규, 6/5 도입). 일괄 등록 시 자동 lookup + 사용자 결정 자동 upsert. 관리 UI: `/dashboard/settings/excel-mappings`

### Prisma enum
- **Role** — CFO · CO_CFO · MEMBER
- **ExcelMappingType** — ACCOUNT · CASH_SUB · HOLDING_SKIP · NEW_ACCOUNT · IGNORE (엑셀 매핑 타입)
- **AccountType** — CASH · INVESTMENT · CRYPTO · STO · PENSION · REAL_ESTATE · DEBT · CREDIT_CARD
- **ShareLevel** — PUBLIC · BALANCE_ONLY · PRIVATE
- **DebtType** — MORTGAGE · JEONSE_DEPOSIT · CREDIT_LOAN · OVERDRAFT · ETC
- **RepaymentType** — EQUAL_PRINCIPAL_INTEREST · EQUAL_PRINCIPAL · BULLET · INTEREST_ONLY
- **PensionType** — PUBLIC_PENSION · RETIREMENT_DB · RETIREMENT_DC · IRP · PERSONAL_PENSION · HOME_PENSION
- **TradeType** — BUY · SELL · DIVIDEND · SPLIT
- **CategoryType** — INCOME · EXPENSE
- **Visibility** — SHARED · PRIVATE

---

## 카테고리 시스템

시스템 기본 카테고리는 `prisma/seed-categories.ts`에 정의.
추가 후 `npx tsx prisma/seed-categories.ts` 실행.

현재 지출(EXPENSE) 기본 카테고리:
식비, 카페, 교통, 쇼핑, 의료/건강, 문화/여가, 관리비, 교육, 통신, 보험, 미용, 경조사, 용돈, 매매수수료, 투자손실, 기타

현재 수입(INCOME) 기본 카테고리:
급여, 부업, 투자수익, 배당, 용돈/이체, 기타수입

---

## 엑셀 업로드 (뱅크샐러드)

`utils/excel-parser.ts` — 대분류/소분류 → 앱 카테고리 매핑
- 대분류 우선, 없으면 소분류 fallback
- `CATEGORY_MAP` 에서 매핑 정의
- 이후 `/api/ai/map-categories` 에서 AI로 DB 카테고리 ID 매핑

---

## 공모주·스팩 청약 (IPO, BETA · 2026-06-30 도입 · 07-05 일정 중심 재설계)

**상태: DB 영속화(2026-07-01) + 낙관적 잠금 — 멀티기기 동기화.** 워크스페이스(계좌·기록·스팩·메모·오버라이드)는 Prisma `IpoWorkspace`(userId PK + `data` Json)에 사용자 단위 저장, PUT은 `baseUpdatedAt` 낙관적 잠금(동시 편집 덮어쓰기 차단). localStorage는 오프라인/초기 캐시. JSON 내보내기/가져오기 백업 안전망(`entry-forms.tsx` 데이터 툴바). 기획: vault `03_personal/projects/공모주-청약{-서비스-구상,원장-데이터모델-스펙}.md`.

🔀 **독립 앱 분리 예정 — 데이터 경로 (A) 완전 분리 확정(08-13)**: 브릿지 없음, 독립 앱은 돈독 DB·계정과 무관 설계(함께 쓰기는 추후 재검토). (2026-08-10 전략 전환 — 구 cohort 해금형(07-12) 폐기). `canUseIpo`·`isIpoBlockedForUser`·`blockIpoIfNotEntitled` 삭제(`40c348e`), 초대 라우트 `/join/[cohort]`·`IPO_HOME` 제거 및 nav 미노출(2026-08-13). 화면·데이터는 독립 앱 이관까지 직접 URL(`/dashboard/ipo`)로만 접근(로그인 필수). `parseCohort`는 getAuthUser 가드레일로 존치. 공개 준비 장치: **캡처 모드**(`data-priv` 블러) + 시작 가이드 온보딩.

- **구조**: 일정 중심 — 상단 공모주/스팩주 분기(kind), 일정에서 인라인 청약 기록(PLANNED→SUBMITTED→ALLOCATED→SOLD). "원장" 용어는 폐기(결과·종목별 내역). 데모 모드 없음(빈 상태에서 직접 입력).
- **페이지**: `app/dashboard/ipo/page.tsx` ("공모주·스팩주").
- **`components/ipo/`** (~2,500줄, 생성물 제외):
  - `board-data.ts` — 뷰 타입(`Account`·`LedgerRow`·`UpcomingOffering`·`Spac`)·자금 집계(`ledgerMoney`·`accountMoney`)·`readinessIssues`·`maskAccountNo`·`ddays` (순수·테스트됨). 구 `computeAllocation`·데모 데이터는 자금배분 탭 폐지와 함께 삭제(2026-07-02).
  - `schedule-view.tsx` — 일정 + **배정 계산기**(목표 N주 × 도전/기본/안정) + **예산 최적 배분**(명의별 청약주수 자동 산출). 계산 자체는 `lib/ipo/allocation.ts` 순수 함수(테스트됨), 여기선 조합·표시만. ⚠️ **사실 산술만 — 종목 추천·비례 유불리 예측 금지**(컴플라이언스).
  - `account-board.tsx` — 자금 위치 맵 + 명의별 밀집 계좌표(계좌번호 기본 마스킹·보기 토글, 비번 미저장). `account-planner.tsx` — 명의 풀. `entry-forms.tsx` — 검색형 피커(종목·증권사)·기본 증거금 자동 채움·데이터 툴바. `spac-{list,universe,panel,holdings}` — 스팩.
  - `tones.ts`·`broker-meta.ts` — 색 토큰·증권사 메타.
  - `offerings.generated.ts`·`spac-universe.generated.ts` — 빌드 스크립트 산출(직접 수정 금지).
- **`lib/ipo/`** — `allocation.ts`(배정·예산배분 순수 계산)·`store.ts`(DB+localStorage 이중 영속, debounce PUT·최초 로드 시 로컬→DB 자동 마이그레이션).
- **`utils/ipo-ledger/`** — 운영자 카톡 "공모주 일정" 공지 → 이벤트 정규화(`schedule-notice.ts`). `calendar-sync.ts`는 미사용(캘린더는 별도 IPO_calander Apps Script 담당).
- **API** `app/api/ipo/`:
  - `quote` — 네이버 금융 실시간 시세 프록시. `competition` — 38.co.kr 비례경쟁률. `workspace` — GET/PUT(zod 검증·512KB 상한). **셋 다 `getAuthUser` 가드**(무인증 오픈 프록시 남용 차단. 구 `blockIpoIfNotEntitled` cohort 가드는 08-10 게이트 제거로 삭제).
- **`scripts/ipo-{schedule,offerings}-build.ts` + `ipo-schedule-cron.sh`** — 38.co.kr 라이브에서 일정·종목 유니버스 재생성 스크립트. ⏸️ **launchd cron은 2026-08-13 중지**(`com.dondoc.ipo-schedule` bootout, plist는 `.disabled-20260813`로 보존) — 독립 앱 이관 시 재가동. 스크립트·생성 파일은 이관용으로 존치.

---

## 환경 변수 (.env.local)

```
NEXT_PUBLIC_PRODUCT_LINE=full   # full | lite (제품 라인 분리, 미설정 시 full)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=          # Prisma (pooled)
DIRECT_URL=            # Prisma (direct, for migrations)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
# 선택
CLI_PROXY_URL=        # 기본값: http://localhost:8317 (llm-mux 게이트웨이)
OPENAI_API_KEY=       # LLM fallback 직접 호출 (lib/ai.ts)
FRANKR_CLIENT_ID=     # fran.kr 세금 계산 API (보유세·취득세·양도세 등)
FRANKR_CLIENT_SECRET=
MOLIT_API_KEY=        # 국토부 실거래가 API (부동산 시세)
KAKAO_REST_API_KEY=   # 카카오 주소 검색 API
DART_API_KEY=         # DART 공시 API (주식 펀더멘털 fallback)
CLI_PROXY_MGMT_SECRET= # CLIProxy 관리 API (오버라이드 시)
CLI_PROXY_API_KEY=
ADMIN_FAMILY_ID=      # 가족 그룹 운영자 식별 (oauth status 확인용)
DEMO_CFO_EMAIL=       # /api/demo/data 가 조회할 데모 가족 CFO 이메일 (가명 권장)
```

---

## 개발 명령어

```bash
npm install            # 의존성 설치 (xlsx는 SheetJS CDN tarball 직접 의존 — 네트워크 필요)
npm run dev            # 개발 서버 (localhost:3000)
npm test               # vitest 단위 테스트
npm run test:watch     # vitest watch 모드
npm run check:tone     # 사용자 toast 톤 가드 (합쇼체 검출)
npm run check:css-tokens  # ad-hoc 색상 가드 (viz 유틸 우회 검출)
                       # ※ 둘 다 build에 체이닝됨 — build = check:tone → check:css-tokens → prisma generate → next build
npx prisma studio      # DB GUI
npx prisma db push     # 스키마 → DB 반영 (migrations 디렉터리 없음 — db push 워크플로우)
npx tsx prisma/seed-categories.ts  # 카테고리 시드
npx tsx prisma/seed-demo.ts        # 데모 가족 시드 (가명 데이터)
```

### xlsx (SheetJS)

`package.json` 의 `xlsx` 의존성은 **npm 등록본이 아니라 SheetJS CDN tarball** 을 직접 가리킨다:
`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`

이유: SheetJS는 0.18.5 이후 npm 배포를 중단하고 CDN 자체 배포로 전환했고, npm 0.18.5에는 high 취약점 2건(Prototype Pollution, ReDoS)이 fix 없이 남아 있다. CDN 0.20.3은 두 취약점 모두 해소.


---

## 주의사항

- `lib/actions/` 파일은 반드시 `'use server'` 선언
- **`'use server'` 파일에서 async 함수 외 export 금지** — 특히 `export type { X }` 재export를 두면 Next가 액션 매니페스트에 값으로 등록해, 그 모듈을 import하는 **모든 POST(서버 액션)가 ReferenceError 500**으로 죽는다(2026-08-03 현금흐름 저장 장애 실증, `514370a`). 타입·상수는 순수 모듈(`lib/*-calc.ts` 등)에 두고 소비자가 거기서 직접 import. `export interface`(선언문)는 허용
- `lib/prisma.ts`는 빌드 타임 안전을 위한 lazy 싱글톤 — 직접 수정 금지
- 카테고리는 DB에서 동적 로드 (`getFamilyCategories`) — 하드코딩 금지
- `originalHash` 로 엑셀 중복 업로드 방지 (SHA-256)
- Vercel 배포 시 `DIRECT_URL` 필수 (connection pooling 우회)
- 매매 등록(`addTradeRecord`)은 `prisma.$transaction`으로 묶여 있음 — read는 트랜잭션 외부, balance 재계산은 트랜잭션 후. 추가 액션 작성 시 동일 패턴 권장
- 자동 생성 `Transaction.visibility` 기본 `PRIVATE` (5/22~) — 가족·동업자와 공유는 사용자가 명시적으로 SHARED 토글
- 색상은 ad-hoc Tailwind(`text-emerald-500`·`text-red-500` 등) 금지 — globals.css의 `.text-income`·`.text-expense`·`.text-warning`·`.text-savings` viz 유틸 사용
- 랜딩 페이지(`components/marketing/LandingPage.tsx`)는 Solid Modern(`docs/BRAND_GUIDE.md` §6 시각 정체성·§14 랜딩 히어로) — 딥 포레스트 다크+골드, 2026-07-08 다크 전환(구 라이트 단일·dark-luxury 서술 모두 폐기). 다른 페이지는 globals.css 토큰 우회 금지. 히어로는 `landing/VideoHeroLight.tsx`(자체 제작 다크+골드 브랜드 영상 `public/landing/hero.mp4`, 2026-07-08 완성. docs/design/hero-explorations.md)
- `app/api/demo/data/route.ts`는 무인증 — demo 계정 데이터(description·memo·feedPost.content)에 실명·실숫자가 섞이지 않게 시드 점검 필요

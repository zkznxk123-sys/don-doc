# 돈Doc (Don-Doc) — CLAUDE.md

가족 공유 자산/가계부 관리 앱. Next.js 14 App Router 기반.

---

## 기술 스택

| 분류 | 스택 |
|------|------|
| 프레임워크 | Next.js 15.3.9 (App Router, Turbo dev) |
| 인증 | Clerk (@clerk/nextjs) |
| DB | PostgreSQL + Prisma 5 |
| 스타일 | Tailwind CSS + shadcn/ui (Radix UI) |
| AI | Vercel AI SDK + OpenAI gpt-4o-mini (LLM-Mux 경유) |
| 알림 | Sonner (toast) |
| 차트 | Recharts |
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
    frankr/
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
    excel-upload-drawer.tsx
    account-drawer.tsx
  layout/
    DashboardShell.tsx       # 컨텍스트 + openTransactionDrawer
    AppSidebar.tsx           # core/beta/admin 3그룹 nav
    Header.tsx               # 디자인 토큰 기반 (bg-card·border-border)
  marketing/
    LandingPage.tsx          # 랜딩 Dark Luxury sub-palette (BRAND_GUIDE §7)
  dashboard/
    InputGuide.tsx

lib/
  actions/          # 서버 액션 ('use server')
    transaction.ts  # 거래 CRUD, bulkUpdate
    investments.ts  # 매매 기록 (addTradeRecord — prisma.$transaction 원자성)
    categories.ts   # getFamilyCategories, addCustomCategory
    accounts.ts
    budget.ts
    scenario.ts
    family.ts
    feed.ts
    wealth.ts
    preferences.ts  # 사용자 카테고리 학습 데이터
  agent/            # AI 채팅 어시스턴트
    tools.ts        # tool calling 정의 (도메인별 분할 권장 — 1,700줄)
    system-prompt.ts
  data/             # 종목 universe·preset·섹터 매핑
    stock-universe.ts
    screen-presets.ts
    sector-mapping.ts
  utils/
    dart-fundamental.ts
    yahoo-fundamental.ts
    yahoo-momentum.ts
    stock-screener.ts
  auth.ts           # getAuthUser() — 모든 서버 액션/API 진입점
  prisma.ts         # Prisma 싱글톤 (빌드 안전)
  ai.ts             # LLM-Mux 추상화

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

---

## DB 주요 모델

- **FamilyGroup** — 가족 단위 (중심)
- **User** — clerkId 연동, role(CFO/MEMBER)
- **Account** — 자산/부채 계좌 (CASH, INVESTMENT, PENSION, REAL_ESTATE, DEBT 등)
- **Transaction** — 수입/지출, category, isExcluded, excludeFromBudget, tradeRecordId(매매 자동 연동), visibility(기본 PRIVATE)
- **Category** — familyId=null(시스템 공통) or familyId(가족 커스텀)
- **UserCategoryPreference** — AI 자동분류 학습 (keyword → categoryId)
- **Budget** — 월별 예산
- **NetWorthSnapshot** — 순자산 스냅샷 이력
- **InvestmentHolding** — 종목 보유 (accountId, ticker, name, quantity, avgPrice, currency)
- **TradeRecord** — 매매 기록 (holdingId, type=BUY/SELL/DIVIDEND/SPLIT). 등록 시 Transaction 자동 생성 — 실현손익·배당·수수료를 가계부에 반영
- **ExchangeRate** — USD-KRW 환율 스냅샷
- **FeedPost** — 가족 피드 게시물
- **Scenario** — 시나리오 분석 (임베딩 기반 부분 대체·비교 뷰)

### Prisma enum
- **Role** — CFO · CO_CFO · MEMBER
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

## 환경 변수 (.env.local)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=          # Prisma (pooled)
DIRECT_URL=            # Prisma (direct, for migrations)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
# 선택
LLM_MUX_URL=          # 기본값: http://localhost:8317
```

---

## 개발 명령어

```bash
npm run dev            # 개발 서버 (localhost:3000)
npx prisma studio      # DB GUI
npx prisma migrate dev # 마이그레이션
npx tsx prisma/seed-categories.ts  # 카테고리 시드
```

---

## 주의사항

- `lib/actions/` 파일은 반드시 `'use server'` 선언
- `lib/prisma.ts`는 빌드 타임 안전을 위한 lazy 싱글톤 — 직접 수정 금지
- 카테고리는 DB에서 동적 로드 (`getFamilyCategories`) — 하드코딩 금지
- `originalHash` 로 엑셀 중복 업로드 방지 (SHA-256)
- Vercel 배포 시 `DIRECT_URL` 필수 (connection pooling 우회)
- 매매 등록(`addTradeRecord`)은 `prisma.$transaction`으로 묶여 있음 — read는 트랜잭션 외부, balance 재계산은 트랜잭션 후. 추가 액션 작성 시 동일 패턴 권장
- 자동 생성 `Transaction.visibility` 기본 `PRIVATE` (5/22~) — 가족·동업자와 공유는 사용자가 명시적으로 SHARED 토글
- 색상은 ad-hoc Tailwind(`text-emerald-500`·`text-red-500` 등) 금지 — globals.css의 `.text-income`·`.text-expense`·`.text-warning`·`.text-savings` viz 유틸 사용
- 랜딩 페이지(`components/marketing/LandingPage.tsx`)는 BRAND_GUIDE §7 "Dark Luxury sub-palette"만 사용. 다른 페이지는 globals.css 토큰을 우회 금지
- `app/api/demo/data/route.ts`는 무인증 — demo 계정 데이터(description·memo·feedPost.content)에 실명·실숫자가 섞이지 않게 시드 점검 필요

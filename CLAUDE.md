# 돈독 (Don-Doc) — CLAUDE.md

가족 공유 자산/가계부 관리 앱. Next.js 14 App Router 기반.

---

## 기술 스택

| 분류 | 스택 |
|------|------|
| 프레임워크 | Next.js 14.2.5 (App Router) |
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
    ai/             # categorize, recategorize, map-categories, insights
    transactions/   # CRUD + list
    accounts/
    family/
    cashflow/
    wealth/
  dashboard/        # 보호된 페이지
    cashflow/       # 현금흐름 관리 (page.tsx)
    assets/         # 자산 관리
    budget/         # 예산 관리
    settings/       # 설정 (카테고리 포함)
    family/         # 가족 관리

components/
  ui/               # 공용 UI (drawer, chart 등)
    transaction-drawer.tsx   # 거래 개별수정 팝업
    excel-upload-drawer.tsx  # 엑셀 업로드
  layout/
    DashboardShell.tsx       # openTransactionDrawer, shellUser 등 컨텍스트

lib/
  actions/          # 서버 액션 ('use server')
    transaction.ts  # 거래 CRUD, bulkUpdate
    categories.ts   # getFamilyCategories, addCustomCategory
    accounts.ts
    budget.ts
    preferences.ts  # 사용자 카테고리 학습 데이터
  auth.ts           # getAuthUser() — 모든 서버 액션/API 진입점
  prisma.ts         # Prisma 싱글톤 (빌드 안전)
  ai.ts             # LLM-Mux 추상화

prisma/
  schema.prisma     # DB 스키마
  seed-categories.ts  # 시스템 기본 카테고리 시드

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
- `MEMBER` — 본인 + SHARED 거래만

### 트랜잭션 가시성
- `SHARED` — 가족 전체 공개
- `PRIVATE` — 금액만 노출, 내용 마스킹

---

## DB 주요 모델

- **FamilyGroup** — 가족 단위 (중심)
- **User** — clerkId 연동, role(CFO/MEMBER)
- **Account** — 자산/부채 계좌 (CASH, INVESTMENT, PENSION, REAL_ESTATE, DEBT 등)
- **Transaction** — 수입/지출, category, isExcluded, excludeFromBudget
- **Category** — familyId=null(시스템 공통) or familyId(가족 커스텀)
- **UserCategoryPreference** — AI 자동분류 학습 (keyword → categoryId)
- **Budget** — 월별 예산
- **NetWorthSnapshot** — 순자산 스냅샷 이력

---

## 카테고리 시스템

시스템 기본 카테고리는 `prisma/seed-categories.ts`에 정의.
추가 후 `npx tsx prisma/seed-categories.ts` 실행.

현재 지출(EXPENSE) 기본 카테고리:
식비, 카페, 교통, 쇼핑, 의료/건강, 문화/여가, 관리비, 교육, 통신, 보험, 미용, 경조사, 용돈, 기타

현재 수입(INCOME) 기본 카테고리:
급여, 부업, 투자수익, 용돈/이체, 기타수입

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

# 돈Doc (Don-Doc)

> 흩어진 자산을 한 화면에. 시간은 최소로.

자산 관리를 책임진 한 사람이 시간을 최소화하는 **자산 운영 시스템**. 혼자 써도 충분하고, 필요하면 가족·동업자와 선별적으로 공유한다. 가계부에서 출발해 AI 어시스턴트·투자 분석까지 확장 중이며, 한화 디지털혁신 AI 경진대회 출품작이다.

## 핵심 가치: 선별적 투명성

모든 거래 데이터는 `SHARED` 또는 `PRIVATE` 상태를 가진다.

| 구분 | 본인 | 가족 (SHARED) | 가족 (PRIVATE) |
|---|---|---|---|
| **금액** | 공개 | 공개 | 공개 |
| **상세 내역** | 공개 | 공개 | 🔒 개인 지출 |

CFO(관리자)는 전체 자산 흐름을 파악하고, 구성원은 개인 지출의 프라이버시를 보장받는다.

## 주요 기능

### 가계 운영
- **통합 자산 대시보드** — CFO/구성원 모드 전환, 자산 비중 도넛 차트, 환율 자동 적용
- **현금흐름 관리** — 카테고리 자동 추천(AI), 빠른 금액 버튼, 공동/개인 지출 토글, 매매내역 ↔ 현금흐름 자동 연동(실현손익)
- **예산 관리** — 월별 예산, 카테고리별 진척률
- **엑셀 업로드** — 뱅크샐러드 엑셀 파싱, AI 카테고리 매핑, 중복 업로드 방지(SHA-256)

### AI 어시스턴트
- **가족 채팅 어시스턴트** — 자연어로 거래 조회/등록/수정, tool calling 기반 쓰기 권한
- **자동 분류 학습** — `UserCategoryPreference`로 키워드 → 카테고리 학습
- **인사이트 생성** — 지출 패턴·이상치 감지

### 투자 분석
- **포트폴리오 fundamental 분석** — 종목별 재무 지표
- **비주얼 스크리너** — `/dashboard/screen`, 사전 preset 8종, 채팅에서 `runScreenPreset` 호출 가능
- **종목 universe** — 한국 701종목, DART 시계열, 한국어 섹터 분류, 모멘텀 지표
- **시나리오 분석** — 임베딩 기반 부분 대체, 비교 뷰, 컨텐츠 진단·번역·구조화 요약

### 가족·인증
- **인증 시스템** — Clerk 기반 로그인/회원가입
- **가족 초대** — CFO가 초대 코드 발급 → 링크로 합류
- **데이터 마스킹** — 서버 단에서 PRIVATE 거래 상세 내역 자동 마스킹

## 기술 스택

| 영역 | 기술 |
|---|---|
| **Framework** | Next.js 14.2.5 (App Router, Turbo) |
| **Auth** | Clerk |
| **Database** | PostgreSQL + Prisma 5 |
| **AI** | Vercel AI SDK + OpenAI gpt-4o-mini (LLM-Mux 경유) |
| **Styling** | Tailwind CSS + shadcn/ui (Radix UI) |
| **차트·애니메이션** | Recharts + Framer Motion |
| **알림** | Sonner |
| **Analytics** | PostHog |
| **엑셀** | xlsx |
| **Validation** | Zod |
| **배포** | Vercel |

## 시작하기

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.local.example .env.local
# .env.local에 Clerk 키, DATABASE_URL, DIRECT_URL 등 입력

# DB 스키마 동기화
npx prisma db push

# 시스템 카테고리 시드
npx tsx prisma/seed-categories.ts

# 개발 서버
npm run dev
```

### 환경 변수

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database (Prisma)
DATABASE_URL=          # pooled (런타임)
DIRECT_URL=            # direct (migrations, Vercel 필수)

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

# AI (선택)
LLM_MUX_URL=          # 기본값: http://localhost:8317
```

## 디렉토리

```
app/
  api/         ai · stocks · scenario · transactions · accounts · family · cashflow · wealth · realestate · ...
  dashboard/   cashflow · assets · budget · transactions · uploads · family · scenario · screen · feed · settings
lib/
  actions/     서버 액션 ('use server') — transaction · categories · accounts · budget · preferences
  auth.ts      getAuthUser() — 모든 서버 액션/API 진입점
  ai.ts        LLM-Mux 추상화
components/
  ui/          공용 UI · transaction-drawer · excel-upload-drawer
  layout/      DashboardShell — openTransactionDrawer 등 컨텍스트
prisma/
  schema.prisma · seed-categories.ts
utils/
  excel-parser.ts  # 뱅크샐러드 엑셀 파서
```

자세한 패턴·DB 모델·주의사항은 [CLAUDE.md](./CLAUDE.md) 참조.

## 디자인 원칙

- Maybe.finance 스타일의 미니멀한 다크모드
- 숫자는 정보가 아니라 **경험** — 크고 명확한 Typography
- 복잡한 표보다 시각적 그래프와 카드 위젯
- CFO와 구성원 모드에 따른 대시보드 차별화
- 자세한 브랜드 가이드는 [docs/BRAND_GUIDE.md](./docs/BRAND_GUIDE.md)

# 돈독 (Don-Doc)

> 돈 관리는 똑똑하게, 관계는 더 돈독하게.

가족 간의 사생활은 존중하면서 자산은 투명하게 통합 관리하는 **선별적 공유 기반 디지털 패밀리오피스**.

## 핵심 가치: 선별적 투명성

모든 거래 데이터는 `SHARED` 또는 `PRIVATE` 상태를 가집니다.

| 구분 | 본인 | 가족 (SHARED) | 가족 (PRIVATE) |
|---|---|---|---|
| **금액** | 공개 | 공개 | 공개 |
| **상세 내역** | 공개 | 공개 | 🔒 개인 지출 |

CFO(관리자)는 전체 자산 흐름을 파악하고, 구성원은 개인 지출의 프라이버시를 보장받습니다.

## 주요 기능

- **통합 자산 대시보드** — CFO/구성원 모드 전환, 자산 비중 도넛 차트
- **지출 기록** — 카테고리 자동 추천, 빠른 금액 버튼, 공동/개인 지출 토글
- **인증 시스템** — Supabase Auth 기반 로그인/회원가입
- **가족 초대** — CFO가 초대 코드 발급 → 링크로 합류
- **데이터 마스킹** — 서버 단에서 PRIVATE 거래 상세 내역 자동 마스킹

## 기술 스택

| 영역 | 기술 |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Auth** | Supabase Auth |
| **Database** | PostgreSQL (Supabase) + Prisma ORM |
| **Styling** | Tailwind CSS (다크모드) |
| **UI** | Shadcn/ui + Lucide React |
| **Charts** | Recharts |
| **Validation** | Zod |

## 시작하기

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.local.example .env.local
# .env.local에 Supabase URL, ANON_KEY, DATABASE_URL 입력

# DB 스키마 동기화
npx prisma db push

# 시드 데이터 (선택)
npm run seed

# 개발 서버
npm run dev
```

## 디자인 원칙

- Maybe.finance 스타일의 미니멀한 다크모드 디자인
- 숫자는 정보가 아니라 **경험** — 크고 명확한 Typography
- 복잡한 표보다 시각적 그래프와 카드 위젯 선호
- CFO와 구성원 모드에 따른 대시보드 차별화

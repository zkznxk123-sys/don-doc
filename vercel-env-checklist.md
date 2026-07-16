# Vercel 환경변수 체크리스트

Vercel 대시보드 → Project → Settings → Environment Variables 에서 아래 항목을 입력합니다.

---

## ✅ 필수 (없으면 앱이 실행되지 않음)

### Prisma / Database

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DATABASE_URL` | Supabase **연결 풀링** 주소 (PgBouncer, 포트 6543). Vercel 같은 서버리스 환경에서 반드시 이 주소를 사용해야 합니다. | `postgresql://postgres.[ref]:[pw]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase **직접 연결** 주소 (포트 5432). `prisma migrate` / `prisma db push` 실행 시 필요합니다. Vercel 빌드 중에는 사용되지 않지만, 스키마 변경할 때 로컬에서 씁니다. | `postgresql://postgres.[ref]:[pw]@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres` |

> **주의**: `DATABASE_URL` 끝에 반드시 `?pgbouncer=true` 파라미터가 있어야 합니다. Vercel 함수는 요청마다 연결을 새로 만들기 때문에 PgBouncer 없이는 DB 연결 고갈이 발생합니다.

---

### Auth — Clerk (2026 전환. 구 Supabase Auth 절 폐기)

| 변수명 | 설명 | 찾는 곳 |
|--------|------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 공개 키 | Clerk 대시보드 → API Keys |
| `CLERK_SECRET_KEY` | Clerk 서버 키 | Clerk 대시보드 → API Keys |

> `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`는 **DB(Supabase Postgres)용으로만 잔존**하며 Auth 용도 아님 — Auth는 Clerk 단일.

---

## 🔧 선택 (기능 일부 비활성화)

### 데모 계정

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `DEMO_EMAIL` | "데모 체험하기" 버튼으로 로그인할 데모 계정 이메일. 미설정 시 `demo@dondoc.app` 을 사용합니다. 해당 이메일의 Prisma User가 DB에 존재해야 합니다. | `demo@dondoc.app` |

> **데모 기능 활성화 방법**: 로컬에서 `npx tsx prisma/seed-demo.ts` 를 실행하면 DB에 데모 유저와 샘플 데이터가 생성됩니다. (Supabase 계정 생성 불필요)

---

### AI 인사이트 (llm-mux 게이트웨이)

AI 인사이트 기능을 사용하려면 아래 4개가 모두 필요합니다. 미설정 시 해당 기능만 비활성화됩니다.

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `LLM_MUX_URL` | llm-mux 프록시 서버 주소. Vercel 배포 시 외부 접근 가능한 URL이어야 합니다. | `https://your-llm-mux-server.com` |
| `LLM_MUX_MODEL_FAST` | 빠른 응답용 모델 | `gpt-4o-mini` |
| `LLM_MUX_MODEL_BALANCED` | 균형 잡힌 모델 | `claude-sonnet-4-20250514` |
| `LLM_MUX_MODEL_SMART` | 고품질 응답용 모델 | `claude-opus-4-5-20251101` |

---

## ❌ 불필요 (이 프로젝트에서 사용하지 않음)

아래 변수들은 `.env.local.example`에 나와 있지만 **실제 코드에서 참조하지 않습니다**. Vercel에 입력하지 않아도 됩니다.

| 변수명 | 이유 |
|--------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 사이드 Supabase admin 작업 없음 |
| `NEXTAUTH_SECRET` | NextAuth 미사용. Supabase Auth로 인증 처리 |
| `NEXTAUTH_URL` | 동일 이유 |
| `DEMO_PASSWORD` | 데모 로그인이 쿠키 기반으로 변경되어 비밀번호 불필요 |

---

## 📋 Vercel 배포 전 체크리스트

- [ ] `DATABASE_URL` 설정 완료 (`?pgbouncer=true` 포함 확인)
- [ ] `DIRECT_URL` 설정 완료
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 설정 완료
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 완료
- [ ] Supabase 대시보드 → Authentication → URL Configuration → **Site URL** 을 Vercel 도메인으로 변경
- [ ] Supabase → Authentication → URL Configuration → **Redirect URLs** 에 `https://your-domain.vercel.app/**` 추가
- [ ] (선택) 데모 기능 원한다면 `DEMO_EMAIL` 설정 + seed 실행
- [ ] (선택) AI 기능 원한다면 `LLM_MUX_*` 4개 설정

---

## 🚀 빌드 설정 확인

Vercel 자동 감지로 충분하지만, 명시적으로 설정하려면:

| 항목 | 값 |
|------|-----|
| Framework Preset | Next.js |
| Build Command | `npm run build` (= `next build`) |
| Output Directory | `.next` |
| Install Command | `npm install` → 자동으로 `postinstall: prisma generate` 실행됨 |


---

## 🔬 종목 리서치 베타 (딥다이브·ETF NAV — 개인 비공개, 2026-07)

| 변수명 | 설명 | 비고 |
|--------|------|------|
| `RESEARCH_BETA_EMAILS` | 딥다이브·ETF NAV 허용 계정(콤마 구분). **미설정 시 전원 차단(fail-closed)** — 프로덕션은 의도적으로 비워 안전 | 컴플라이언스: 유사투자자문 민감 출력 개인 한정 |
| `DARTLAB_SERVICE_URL` | dartlab 재무 분석 서비스 URL (기본 `http://127.0.0.1:8420`). 프로덕션은 Tailscale 사설망이라 Vercel에서 도달 불가 — 연결 설계 미결 | `~/Developer/dartlab/service/dondoc_deep_dive.py` |
| `KIS_REAL_APP_KEY` / `KIS_REAL_APP_SECRET` | 한국투자 실전 앱키 — ETF 구성종목(073)은 모의 미지원이라 실전 필수 | 미설정 시 국내 ETF NAV 비활성(지수근사 해외도 KIS 요약 필요) |

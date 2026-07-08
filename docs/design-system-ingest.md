# 돈독 — Design System (Claude Design ingestion)

> 이 파일은 **클로드 디자인 "디자인 시스템" 생성 전용 피드**입니다.
> 정본은 `DESIGN.md`(product 시스템) + `BRAND_GUIDE.md`(브랜드). 여기선 둘을 클로드 디자인이 한 번에 학습하기 좋게 응축했습니다.
> 함께 업로드: Pretendard OTF(9 weights), Noto Serif KR, `brand-mark.svg` / `logo-wordmark.svg`.

---

## 0. 한 줄 정의

가족 자산 대시보드. **Editorial Finance** — 스프레드시트가 아니라 금융 매거진. 따뜻한 off-white, serif display 숫자, editorial gold 액센트. 가계부를 차갑지 않고 차분히 읽히게.

두 원칙: ① **숫자가 hero** — 공간·무게·대비 우선. ② **Warmth over sterility** — 차가운 회색·블루틴 화이트 금지.

---

## 1. 색 (Product 앱 = 정본)

### Light
| Token | Value | Use |
|---|---|---|
| background | `#FCF9F8` | 페이지 캔버스 warm off-white |
| foreground | `#1A1A1A` | 본문 charcoal |
| card | `#FFFFFF` | 카드 표면 |
| primary | `#1A1A1A` | 주요 버튼·강조 텍스트 |
| secondary (gold) | `#735C00` | editorial gold — eyebrow·액센트 |
| muted | `#F6F3F2` | 보조 컨테이너 |
| muted-foreground | `hsl(20 5% 45%)` | 캡션·메타 |
| accent | `hsl(47 60% 93%)` | 옅은 골드 틴트 표면 |
| border | `hsl(20 10% 92%)` | ghost border |
| destructive | `#BA1A1A` | 에러·삭제 |

### Dark
| Token | Value |
|---|---|
| background | `#0F172A` deep slate |
| foreground | `#F1F5F9` |
| card | `#1E293B` |
| secondary (gold) | `#B49B3E` luminous gold |
| ring | `#B49B3E` |

다크 카드: drop shadow 금지 → `border border-border`로 대체.

### Data viz 팔레트 (차트 전용, 임의 Tailwind 색 금지)
income/savings/investments=`#10b981` · cash/links=`#3b82f6` · AI/activity=`#8b5cf6` · real-estate=`#c084fc` · warning/crypto=`#f59e0b` · expense=`#f97316` · liability=`#ef4444` · credit-card=`#f43f5e` · cash(light)=`#60a5fa` · investments(light)=`#34d399` · crypto(light)=`#fbbf24`.
시맨틱 단축: `text-income`(emerald)·`text-expense`(red)·`text-savings`(blue)·`text-warning`(amber), soft 배경 `bg-*-soft`(10% fill).

> **골드 사용량 5–10% 이하.** eyebrow 라벨, "돈독" 강조, hover ring, viz accent 한정. 바탕 전체에 금지.

---

## 2. 타이포그래피

- **Sans**: Pretendard → Noto Sans KR → system-ui. UI·본문·메타·KPI·표·**h1/h2 기본**.
- **Serif**: Noto Serif KR → Georgia. **opt-in only** — Hero·KPI display(`.numeric-display`)·editorial 헤딩에만 `font-serif` 명시. (2026-06-11 전역 h1/h2=serif 규칙 폐기)
- **Mono**: ui-monospace (코드만).

스케일: h1/h2 fluid 700 `tracking-tight leading-[1.1]` · h3 16/600 · h4 12/600 · body 14/400 `leading-[1.6]` · `.eyebrow` 11/500 uppercase gold `tracking-[0.16em]` · `.text-meta` 11/400 muted.

**숫자 클래스 (혼용 금지)**:
- `.numeric-display` — Serif 700 tabular-nums → hero 총액(순자산·총자산)
- `.numeric` — Sans 600 tabular-nums → KPI 카드·표·거래 금액
- `.tabular` — 정렬만 필요할 때

> 한 화면에 serif 숫자 + sans 숫자 혼재 금지.

---

## 3. 형태 토큰

- Base 14px · 카드 padding `p-6`(24px) · section gap `gap-4~6` · page max `1400px`.
- Radius: 카드 = `rounded-2xl`(16px) 기본. 버튼 6px · 입력/칩 12px · pill `rounded-full`. **카드에 rounded-lg(너무 타이트) 금지.**
- Shadow(Light): `shadow-card` = `0 1px 3px rgba(26,26,26,.06), 0 4px 16px rgba(26,26,26,.04)` · `shadow-float` · `shadow-card-xl`. **Dark에선 shadow 금지 → border.**

---

## 4. 핵심 컴포넌트 패턴

- **Card**: `bg-card rounded-2xl shadow-card dark:shadow-none dark:border dark:border-border p-6`
- **KPI Card**: eyebrow 라벨 → `.numeric-display` 큰 숫자 → `.text-meta` 증감.
- **Transaction Row**: 좌측 아이콘(`w-8 h-8 rounded-lg bg-muted`)+설명/메타, 우측 금액 `numeric` + `text-income`/`text-expense`(부호 ±).
- **Eyebrow+Header**: 작은 gold eyebrow 위, h3 헤딩 아래 한 쌍으로만.
- **Badge**: 수입 `bg-income-soft text-income` / 지출 `bg-expense-soft text-expense`, `rounded-full`.
- **Chart**: Recharts + ResponsiveContainer, viz-* 팔레트만. 순자산 area = 총자산 `#60a5fa/#3b82f6`, 순자산 `#34d399/#10b981`. Tooltip `bg-card border-border rounded-xl`.

---

## 5. 브랜드

- 앱명 **돈독** (절대 "돈독" 단독 X — Doc=Document/Doctor/Dock 중의성). 단 형용사 "돈독하게"는 카피에서 유지.
- 태그라인: **가장 쉬운 자산 관리 — 흩어진 자산을 한 화면에.**
- 로고 3레이어: Family connection(satellite 도트 2개) · Coin(D 내부 골드 코인, radial `#E8C960→#C9A13C→#8B6E1E`) · Doc system(두꺼운 D 글리프). 새 아이콘은 셋 중 하나 이상 반영.
- 로고는 `<BrandMark/>`·`<LogoLockup/>` 사용 — JSX로 재현 금지. 회전·변형·그림자 금지.
- Voice: Hero=confident editorial 짧게 / 본문=존댓말 단정 / CTA=동사 원형("무료로 시작하기") / 빈 상태=warm. **Golden rule: "돈"보다 "시간"** — 자산 주도자의 시간 최소화가 목적.

---

## 6. 네비게이션

좌측 사이드바, 아이콘(lucide-react만)+라벨. Active `bg-muted text-foreground font-medium`, inactive `text-muted-foreground hover:bg-muted/50`.
순서: 대시보드 · 현금흐름 관리 · 자산 관리 · 예산 관리 · 시나리오 허브 · 가족 피드 · 설정.

---

## 7. ⚠️ 스코프 경고 — 랜딩은 별도 팔레트(섞지 말 것)

랜딩 트리만 **forest 액센트 + 라이트 단일**(다크 폐기). product 앱 시스템(이 문서 §1~6)과 **분리**.
- 랜딩 Surface `#FAF8F3`/`#F2EEE3`/`#E8E2D0`, INK `#1A1F1E`, **Accent forest `#2F5D4F`**, Positive `#2F8A6E`.
- 랜딩에서 골드는 로고 코인 + Hero ambient orb 한정(라이트 BG 대비 ~2.2:1로 텍스트·CTA 부적격).
- 이 팔레트는 `components/marketing/landing/tokens.ts` 한정. 다른 페이지로 누출 금지.

> 클로드 디자인에게: **product 화면을 만들 땐 gold 시스템, 랜딩 페이지를 만들 땐 forest 시스템.** 둘을 한 화면에 섞지 말 것.

---

## 8. Do / Don't 요약

| Do | Don't |
|---|---|
| hero 총액에 `numeric-display`(serif) | 표·뱃지에 serif 숫자 혼입 |
| 헤딩 위 gold `eyebrow` | eyebrow 단독(아래 헤딩 없이) |
| 카드 `rounded-2xl` | 카드 `rounded-lg` |
| Light=shadow / Dark=border | Dark에 shadow |
| 차트에 `viz-*` 토큰 | `text-emerald-500` 류 raw 색 |
| 한국어 UI 카피 | production에 영문 라벨 |
| 골드 5–10% accent | 골드 바탕 전체 |

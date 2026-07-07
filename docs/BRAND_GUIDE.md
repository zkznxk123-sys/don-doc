# 돈Doc · Brand Guide

> 이 문서는 **브랜드 아이덴티티의 영구 레퍼런스**입니다.
> 개발자와 디자이너가 새 페이지/카피를 만들 때마다 이 문서를 참고하여 톤과 표현을 맞춥니다.

---

## 1. Brand Name

| | |
|---|---|
| **Display** | 돈Doc |
| **Legal / 문서용** | 돈Doc (Don-Doc) |
| **영문 URL/핸들** | `don-doc` / `dondoc` (slug, filename) |
| **읽는 법** | 돈독 (dondok) — "돈독하다" 동음이의 |

**중요**: 어디에서도 "돈독" (단독) 으로 쓰지 않습니다. 항상 **"돈Doc"** — "독(毒)"의 부정적 어감을 피하고, 대신 **Doc = Document / Doctor / Dock** 의 중의성을 담습니다.

기존 레포 안에 남아 있는 "돈독" 텍스트 (README.md, seed 파일, LandingPage "왜 돈독인가" 섹션 등) 는 **"돈Doc"** 으로 교체합니다. 단, 카피에서 의도적으로 "**돈독하게**" 라는 형용사로 쓰는 경우는 유지 (예: 태그라인).

---

## 2. 북극성 · Tagline · Mission

### 북극성 (North Star, 2026-07-06 확정)
> **태도 한 줄**: 복잡한 투자, 단순하게.
> **정의(풀메시지)**: 현금흐름으로 만든 여유자금을 단단한 자산으로 꾸준히 옮기는 것.
> **리듬(기억용)**: 본다 → 남긴다 → 옮긴다.

돈Doc은 "자산 관리 시스템"(기능)이 아니라 **투자를 어렵게 만드는 것에 대한 반항**(태도)이다. 나이키 "Just Do It"이 운동화가 아니라 태도를 팔듯, 돈Doc의 북극성은 태도다.

**투자의 재정의** — 여기서 "투자"는 종목 고르기·매매가 아니라 **"현금흐름으로 만든 여유자금을 단단한 자산으로 꾸준히 옮기는 습관"**이다. 즉 축적·이동 행위(안전)이지 추천·타이밍(유사투자자문)이 아니다. 리딩방·단타와 정면으로 갈리는 POV.

**정의 = 제품의 4단계** (기능이 하나의 서사로 꿰임):

| 문장 beat | 뜻 | 기능 |
|---|---|---|
| 현금흐름을 통해 | 버는 흐름을 본다 | 현금흐름 관리 |
| 만들어낸 여유자금 | 남는 돈을 만든다 | 예산·저축률 |
| 단단한 자산으로 | 질 좋은 자산으로 | 자산 관리 + 공모주(취득 채널) |
| 꾸준히 옮기는 것 | 습관으로 | 매달 10분 정리 |

**2층 브랜드 아키텍처** — 우산(투자, 재정의) + 제품별 설명:

```
[우산·태도]   복잡한 투자, 단순하게 (= 여유자금을 단단한 자산으로 꾸준히)
   ├─ 자산 관리 버전  흐름·여유·현황을 한눈에 (투자의 수단)  → "가장 쉬운 자산 관리"
   └─ 공모주 버전     단단한 자산 취득 채널 하나            → "가장 쉬운 공모주"
```

- 우산 단어 = **"투자"(재정의)**. 자산 관리는 투자와 별개가 아니라 **투자를 잘하기 위한 인프라** — 그래서 자산 버전도 우산 안에 정합. 사업 순서(공모주→자산관리)와도 일치.
- **타깃 진화**: "가계 부부"에서 **"자산을 쌓으려는 사람"**으로 상위 프레임 이동(6/19 부부 결정의 상위 재조정, 부부는 그 안의 세그먼트). 의도된 진화.
- ⚠️ **컴플라이언스**: 재정의(축적·이동)로 유사투자자문 오독은 낮추되, ①증권사 임직원의 '투자' 브랜드는 회사 준법 프로파일이 오르니 확인/편안함 필요, ②"투자=단단한 자산 축적" 정의를 **카피로 계속 가르쳐야**(안 그러면 주식팁앱 오독). 종목 추천·비례 유불리 예측은 여전히 절대 금지.
- 부부·프라이버시·해석은 이 우산 아래 **기둥**으로 유지.

### Primary Tagline (자산 버전 설명)
> **가장 쉬운 자산 관리 — 흩어진 자산을 한 화면에.**

- 우산(투자)의 하위 = 자산 버전 **설명**. SEO description, OG image, App Store description, 채널 bio 에 사용 (**랜딩 Hero엔 미노출** — 아래 구조 참조)
- 구조: 랜딩 Hero는 **북극성**을 대문으로 승격 — eyebrow(영문) 「THE SIMPLEST WAY TO MANAGE MONEY」 + H1 「복잡한 투자, 단순하게.」 (§8 랜딩 규범). Primary Tagline(「가장 쉬운 자산 관리 — 흩어진 자산을 한 화면에」)은 Hero 화면엔 쓰지 않고 SEO·OG·bio 전용이며 Threads bio 정본과 1:1 일치
- 영문 버전: *The easiest way to manage your assets — scattered assets, one view.*

### One-liner (elevator)
> 돈 관리는 똑똑하게, 관계는 더 돈독하게.

### Mission
> 복잡하게 흩어진 자산을 가장 쉽게 한 화면으로 통합하는 도구. 혼자 써도 충분하고, 필요하면 가족·동업자와 선별적으로 공유한다.

---

## 3. Brand Meaning (3-Layer)

로고와 모든 시각·언어 결정의 뿌리.

| 레이어 | 의미 | 시각화 |
|---|---|---|
| **Family connection** | 가족을 잇는 유대 — "돈독한 사이" | 로고의 satellite 도트 2개 (D 옆 상·하) |
| **Coin** | 자산의 가치와 중심 — "돈" | D 내부의 **골드 코인** (radial gradient) |
| **Doc system** | 안정적 연결과 확장 — Document · Doctor · Dock | 두꺼운 **D 글리프** (archival, structural) |

> 새 일러스트/아이콘을 만들 때는 이 세 레이어 중 하나 이상을 반영합니다.

---

## 4. Brand Keywords

새 카피 · 메시지 · 마케팅 자산의 톤 체크리스트.

**Must-have (필수)**
- Owner-first (자산 주도자 중심 — 가장 쉽게 한 화면으로)
- Connected (연결된, 유대)
- Trusted (신뢰, 프라이버시)

**Should-have (지향)**
- Family-first (가족 중심 — 부수 차별점)
- Intelligent (AI 분류·자동화)
- Premium (전문가급 품질)
- Wealth-tech (자산 관리 기술)

**Avoid (피할 것)**
- "가계부" 단독 사용 (너무 소박) → "자산 통합 관리"
- "앱" (흔한 IT 느낌) → "서비스", "플랫폼", "자산 운영 시스템"
- 과장된 수익 표현 ("돈 벌기", "재테크 꿀팁")
- 지나친 이모지, 느낌표 남발

---

## 5. Voice & Tone

| 상황 | 톤 | 예시 |
|---|---|---|
| Hero / 헤드라인 | Confident, editorial, 짧음 | "복잡한 투자, 단순하게." (북극성 · 랜딩 H1 정본) |
| 본문 설명 | Clear, 존댓말, 단정 | "가족 각자의 사생활은 지키면서, 자산은 한 화면에서 투명하게." |
| CTA 버튼 | 동사 원형, 간결 | "무료로 시작하기", "데모 체험하기" |
| 빈 상태 / 안내 | Warm, 부드러움 | "아직 가족이 초대되지 않았어요." |
| 에러 | 사실, 해결책 제시 | "연결이 끊어졌어요. 다시 시도해 주세요." |
| 금액 표기 | Serif (hero) / Sans tabular (UI) | 7.3억 / ₩4,320,000 |

**북극성 목소리 4원칙** (2026-07-06, "복잡한 투자, 단순하게"에서 파생):
1. **짧고 단정** — 문장 길면 진 거다. 명령형·반문형 OK ("돈, 어렵게 하지 마")
2. **반항적이되 친근** — 건방지지 않게, 위트 한 스푼 (JDI의 "그냥 해" 결)
3. **기능 나열 금지** — "5종 자산 통합…" 대신 태도로 말한다
4. **전문용어·번역체 금지** — 한국어 Sunny 7규칙(§CLAUDE.md)과 정합
- **IN**: 단순 · 속도 · 복잡함 제거 · 위트  |  **OUT**: 투자 권유(컴플라이언스) · 기능 자랑 · 럭셔리한 무게 · 겁주는 금융 톤

**Golden rule**: 북극성은 **단순함(태도)**. 복잡함을 걷어내면 시간·여유·더 나은 판단은 따라온다 — 단순함이 목적이고 시간 절약은 결과. 가족·동업자와의 선별 공유는 부수 차별점.

---

## 6. Logo System

### 파일
- `public/logo-wordmark.svg` — 가로 워드마크 (돈 + D). 사이드바, 헤더, 랜딩 네비.
- `public/brand-mark.svg` — 64×64 dark tile (default). Favicon, app icon, social OG.
- `public/brand-mark-dark.svg` — 64×64 light tile. Dark UI 안에서 쓸 때.

### 구성 요소
```
[돈] + [D with gold coin + 2 satellites]
```
- **돈** — Pretendard 900 (Black), letter-spacing -0.06em
- **D** — 두꺼운 stem + bowl, 우측 상·하 satellite 도트 2개
- **골드 코인** — D 중앙, radial gradient (`#E8C960 → #C9A13C → #8B6E1E`)

### 사용 규칙
| 상황 | 사용 |
|---|---|
| Light 배경 | `logo-wordmark.svg` (다크 charcoal + gold coin) |
| Dark 배경 | `logo-wordmark-dark.svg` (light stroke + luminous gold) |
| 작은 크기 (<32px) | `brand-mark.svg` (코인만 있는 심볼) |
| Favicon | `brand-mark.svg` — 32×32 / 192×192 변형 PNG로 함께 배포 |
| 단색 필요 시 | Monochrome 버전 (코인을 골드가 아닌 `currentColor` 링으로) — 향후 제작 가능 |

### 안전 여백 & 최소 크기
- Clear space: 로고 높이(H)의 **0.25 × H** 이상
- Minimum width: 워드마크 **64px**, 심볼 **20px**

---

## 7. Color Palette

CSS 변수는 `app/globals.css` 에 이미 반영됨. 요약:

| 역할 | Light | Dark |
|---|---|---|
| Background | `#FCF9F8` warm off-white | `#0F172A` deep slate |
| Foreground | `#1A1A1A` charcoal | `#F1F5F9` |
| Primary | `#1A1A1A` | `#F1F5F9` |
| Secondary (Gold) | `#735C00` muted editorial | `#B49B3E` luminous |
| Card | `#FFFFFF` | `#1E293B` |

**골드의 역할**: 브랜드 강조색. 제한적으로 — eyebrow 라벨, "돈Doc" 강조, hover ring, 데이터 viz 중 accent 지표.

### Landing · Light sub-palette

> **2026-06-11 다크 럭셔리 폐기.** 사유: 사용자 결정("다크가 부담스러워서") + 1인 운영에서 다크/라이트 토글 유지비 회피. 랜딩도 product-app과 같은 warm off-white 계열의 라이트 단일 톤. 구 다크 팔레트(`BG #0B0F0E`·`ACCENT Gold #B49B3E` 등)는 사어 — 참조 금지.

토큰은 `components/marketing/landing/tokens.ts`의 인라인 상수 (2026-06-12 `CREAM`→`INK` rename). 이 팔레트는 **랜딩 트리에서만** 허용 — 다른 페이지는 globals.css 토큰을 우회 금지. focus ring 등 Tailwind 클래스에서는 LandingPage root에 선언된 `--landing-accent`/`--landing-bg` CSS 변수를 참조한다 (단일 출처).

| 역할 | Hex / RGBA | 상수명 |
|---|---|---|
| Surface BG | `#FAF8F3` warm off-white | `BG` |
| Surface BG_2 | `#F2EEE3` subtle alt | `BG_2` |
| Surface BG_3 | `#E8E2D0` accent zones | `BG_3` |
| Type INK | `#1A1F1E` deep forest ink | `INK` |
| Type INK_DIM | `rgba(26,31,30,0.64)` | `INK_DIM` |
| Type INK_FAINT | `rgba(26,31,30,0.14)` | `INK_FAINT` |
| Accent Forest | `#2F5D4F` primary action | `ACCENT` |
| Positive | `#2F8A6E` | `POSITIVE` |

**랜딩 라이트에서 골드의 역할**: primary accent는 forest(`ACCENT`)다. 골드(`#B49B3E`)는 라이트 BG 위 컨트라스트 ~2.2:1로 텍스트·CTA 부적격 — **로고 코인 한정** (§9 "골드 5–10% 이하" 규칙과 정합). ※ 구 Hero의 ambient orb는 2026-07-06 시네마틱 비디오 히어로(`VideoHeroLight`)로 교체되며 폐지.

---

## 8. Typography

| 용도 | 폰트 |
|---|---|
| 본문 · UI · KPI · 표 | **Pretendard** (9 weights, local OTF) |
| H1 / H2 / Hero numeric | **Noto Serif KR** (editorial magazine 톤) |

> 숫자 규칙은 `globals.css` 의 `.numeric-display` / `.numeric` 유틸 클래스 참고.

### 디자인 방향 — A′ 하이브리드 (2026-07 확정)

4개 톤(에디토리얼/터미널/소프트 컨슈머/뉴트럴) 실렌더 비교로 결정. 순수 에디토리얼이 아니라 **2-레지스터**:

- **표지(hero·KPI display)만 에디토리얼** — serif 숫자는 화면당 1곳. 값은 축약(`10.1억`)을 크게, 정밀값(`₩1,012,212,678`)은 서브텍스트로. "가장 쉬운 자산 관리" 약속과 에디토리얼 격을 양립시키는 장치.
- **본문(데이터 행·테이블·IPO)은 정밀 뉴트럴 유지** — Pretendard `tabular-nums`, 밀도 우선. 프로암(공모주 커뮤니티) 화면은 이쪽이 기본.
- **eyebrow·레이블은 한국어 우선** — 영문 대문자 eyebrow 남발 금지 (겉멋 리스크).
- 근거: lite/대시보드=부부 대중(쉬움), full/IPO=프로암(정밀) — 화면 두 부류에 한 톤을 강요하지 않는다.

### 랜딩 히어로 — 미니멀 단일 화면 (2026-07-07 확정)

`VideoHeroLight` = 히어로 한 화면으로 완성(그 아래 CoreFeatures·Comparison·Closing 섹션 전부 제거 — 파일은 parked, LandingPage import만 삭제). 구성:
- **eyebrow(영문 작게)** `THE SIMPLEST WAY TO MANAGE MONEY` → **H1(대문) 「복잡한 투자, 단순하게.」**("단순하게" 포레스트 accent) → **3-step**(`01 See your cashflow → 02 Keep the surplus → 03 Build solid assets`, 북극성 "본다→남긴다→옮긴다"의 영문) → **CTA**. 서브카피·nav 메뉴·햄버거 없음.
- H1은 Pretendard 볼드(serif 아님). serif(`numeric-display`)는 앱 대시보드 hero 숫자 전용(A′). "복잡한 투자, 단순하게"가 히어로 대문 = 북극성 승격.
- **배경 = 자체 제작 3D 비주얼**(Gemini Nano Banana 이미지 → Higgsfield Kling i2v, 투명 유리 저장고에 코인이 흘러 축적). 워터마크 제거·웹 최적화. **데스크톱=영상 full-bleed**(`hero.mp4`, 2560 샤픈) / **모바일=정지 이미지**(`hero-mobile.jpg`, 세로 9:16) + 은은한 ken-burns. (모바일은 AI i2v가 "동전 진입·스택 성장" 모션을 못 살려 razor-sharp 정지 이미지로 결정.)
- 좌상단 가독성 워시. `prefers-reduced-motion` 가드 **완비**(2026-07-07, `bb04429`): 데스크톱 video JS `pause()` + `hero-poster.jpg` 노출 / 모바일 ken-burns CSS 정지. 로고 = 골드 코인 wordmark(§6), 색상 = tokens.ts 단일 출처(§7). 영상 제작 워크플로우: [[reference_higgsfield_video_workflow]](메모리) / `docs/design/hero-explorations.md`.
- ⚠️ AI 생성물엔 보이지 않는 SynthID가 남을 수 있음(정직: AI 생성). 보이는 워터마크는 delogo로 제거.

### 디자인 원칙 — 북극성 파생 (2026-07-06)

모든 시각 선택은 북극성(「복잡한 투자, 단순하게」 = 여유자금을 단단한 자산으로 꾸준히)을 이 4원칙으로 내려 대본다:

1. **흐름 → 단단함** — 모션·이미지는 "움직임이 단단한 것으로 쌓이는" 걸 보여준다(장식 모션 X). 히어로 비디오(투명 저장고에 코인 축적) = 흐름이 단단한 층으로 쌓이는 시각화.
2. **단단·꾸준 > 반짝·hype** — 솔리드·촉각·차분함 우선. 반짝이·마법·재테크 hype 미감 지양. (예: 장식용 ✨ Sparkles류는 꾸준한 축적/우상향 은유로 대체 검토)
3. **단순함이 태도** — 과감한 여백·초점 하나·짧은 카피 = "복잡한 건 접어두자"의 시각화.
4. **친근하되 진중** — 웜 라이트 + 위트, 그러나 유치하지 않게. 사용자의 실제 돈·미래를 다룬다.

> 새 UI·일러스트·아이콘·모션은 이 4원칙 통과가 기본. 애매하면 원칙1·2를 우선한다.

---

## 9. Do / Don't

### ✅ Do
- 로고 + 태그라인을 함께 (OG 이미지, 초대 이메일). **랜딩 Hero는 미니멀 예외** — 골드 코인 wordmark 로고 + 북극성 H1만, Primary Tagline 병기 안 함(§8 랜딩 규범)
- "돈Doc" 표기 유지 — 대소문자, 한영 혼용 그대로
- **표지 KPI display 숫자에 serif**(앱 대시보드 hero 숫자 1곳), 헤드라인·나머지 UI는 Pretendard (랜딩 H1도 Pretendard 볼드)
- 골드를 강조점으로 — 전체 UI의 5–10% 이하

### ❌ Don't
- 로고를 회전 · 변형 · 그림자 추가
- 워드마크의 "돈" 과 "D" 사이 비율 임의 변경
- "돈독" 단독 사용 (제품명 자리)
- 골드를 바탕 전체로 쓰는 것 (accent 용도만)
- 같은 계층에서 Serif 숫자와 Sans 숫자 혼재 — hero display 1곳만 serif, 본문 숫자는 Pretendard (A′의 계층 혼용은 의도된 규칙)

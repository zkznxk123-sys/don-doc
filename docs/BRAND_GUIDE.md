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

## 2. Tagline & Mission

### Primary Tagline
> **가장 쉬운 자산 관리 — 흩어진 자산을 한 화면에.**

- Hero, SEO description, OG image, App Store description, 채널 bio 에 사용
- 구조: 랜딩 Hero eyebrow(「가장 쉬운 자산 관리」) + H1(「흩어진 자산을 한 화면에」) 결합 = Threads bio 정본과 1:1 일치
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
| Hero / 헤드라인 | Confident, editorial, 짧음 | "가장 쉬운 자산 관리 — 흩어진 자산을 한 화면에." |
| 본문 설명 | Clear, 존댓말, 단정 | "가족 각자의 사생활은 지키면서, 자산은 한 화면에서 투명하게." |
| CTA 버튼 | 동사 원형, 간결 | "무료로 시작하기", "데모 체험하기" |
| 빈 상태 / 안내 | Warm, 부드러움 | "아직 가족이 초대되지 않았어요." |
| 에러 | 사실, 해결책 제시 | "연결이 끊어졌어요. 다시 시도해 주세요." |
| 금액 표기 | Serif (hero) / Sans tabular (UI) | 7.3억 / ₩4,320,000 |

**Golden rule**: "돈(money)" 보다 "시간(time)"을 먼저. 돈 관리는 시간을 아끼기 위한 **매개**일 뿐, 목적은 자산 주도자의 시간 최소화입니다. 가족·동업자와의 선별 공유는 부수 차별점.

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

### 랜딩 히어로 — 시네마틱 비디오 (2026-07-06 교체)

랜딩 히어로는 서체 실험(에디토리얼 세리프)에서 **풀스크린 비디오 히어로**(`VideoHeroLight`)로 전환. motionsites 레퍼런스 3안 비교 후 라이트 톤 B 채택. 상세: `docs/design/hero-explorations.md`.

- **헤드라인은 Pretendard 볼드 + 인라인 아이콘**(지갑·레이어·스파클, 포레스트) — 랜딩 히어로 헤드라인엔 serif 쓰지 않음. serif(`numeric-display`)는 **앱 대시보드 hero 숫자·에디토리얼 헤딩 전용**(A′ 규칙).
- 배경 영상은 밝은 하이키·여백·단일 초점 조건 유지 (이게 "깔끔함"의 원천). 현재 `hero2.mp4`는 범용 AI 클립 플레이스홀더 — 발행 전 Spline/Higgsfield 등으로 브랜드 영상 제작·교체.
- 액센트는 포레스트, 카피는 정본 태그라인. `prefers-reduced-motion` 정지 처리는 영상 교체 시 함께.

---

## 9. Do / Don't

### ✅ Do
- 로고 + 태그라인을 항상 함께 (랜딩, OG 이미지, 초대 이메일)
- "돈Doc" 표기 유지 — 대소문자, 한영 혼용 그대로
- Hero에 serif, 나머지 UI에 Pretendard
- 골드를 강조점으로 — 전체 UI의 5–10% 이하

### ❌ Don't
- 로고를 회전 · 변형 · 그림자 추가
- 워드마크의 "돈" 과 "D" 사이 비율 임의 변경
- "돈독" 단독 사용 (제품명 자리)
- 골드를 바탕 전체로 쓰는 것 (accent 용도만)
- 같은 계층에서 Serif 숫자와 Sans 숫자 혼재 — hero display 1곳만 serif, 본문 숫자는 Pretendard (A′의 계층 혼용은 의도된 규칙)

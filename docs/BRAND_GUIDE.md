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
> **흩어진 자산을 한 화면에. 시간은 최소로.**

- Hero, SEO description, OG image, App Store description 에 사용
- 영문 버전: *Scattered assets, one view. Minimal time.*

### One-liner (elevator)
> 돈 관리는 똑똑하게, 관계는 더 돈독하게.

### Mission
> 자산 관리를 책임진 한 사람이 시간을 최소화하는 도구. 혼자 써도 충분하고, 필요하면 가족·동업자와 선별적으로 공유한다.

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
- Owner-first (자산 주도자 중심 — 한 사람이 시간 최소화)
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
| Hero / 헤드라인 | Confident, editorial, 짧음 | "흩어진 자산을 한 화면에. 시간은 최소로." |
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

### Landing · Dark Luxury sub-palette

랜딩 페이지는 product-app(warm off-white)과 컨텍스트가 다른 **에디토리얼 다크 럭셔리** 톤을 유지한다. 위 product-app 토큰과 별개의 인라인 상수로 사용 (`components/marketing/LandingPage.tsx`). 이 팔레트는 **랜딩 트리에서만** 허용 — 다른 페이지는 globals.css 토큰을 우회 금지.

| 역할 | Hex / RGBA | 상수명 |
|---|---|---|
| Surface BG | `#0B0F0E` | `BG` |
| Surface BG_2 | `#11171A` | `BG_2` |
| Surface BG_3 | `#070A09` | `BG_3` |
| Type CREAM | `#F1ECE3` | `CREAM` |
| Type CREAM_DIM | `rgba(241,236,227,0.6)` | `CREAM_DIM` |
| Type CREAM_FAINT | `rgba(241,236,227,0.12)` | `CREAM_FAINT` |
| Accent Gold | `#B49B3E` | `ACCENT` |
| Accent Forest | `#2F5D4F` | `FOREST` |
| Positive | `#7CC9A9` | `POSITIVE` |

---

## 8. Typography

| 용도 | 폰트 |
|---|---|
| 본문 · UI · KPI · 표 | **Pretendard** (9 weights, local OTF) |
| H1 / H2 / Hero numeric | **Noto Serif KR** (editorial magazine 톤) |

> 숫자 규칙은 `globals.css` 의 `.numeric-display` / `.numeric` 유틸 클래스 참고.

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
- 한 화면에 Serif 숫자와 Sans 숫자 혼재

# 랜딩 히어로 탐색 기록 (2026-07-05)

"이목을 확 끄는 요소" 요청으로 백지에서 3안을 실렌더 비교, **안 1 채택**(Hero v5, `2bb276f`).

| 안 | 컨셉 | 상태 |
|---|---|---|
| 1 · 라이브 프로덕트 스테이지 | 좌 카피 / 우 살아있는 미니 대시보드(카운트업·차트 draw·3D 틸트) | ✅ 채택 — `Hero.tsx` + `LiveBoard.tsx` |
| 2 · 질문 → 수렴 스토리 | "내 돈은 지금, 몇 곳에 흩어져 있을까?" → 자산 카드 수렴 → 해답 서사 | 보류 — 카피 교체 수반. 캠페인/커뮤니티 랜딩용 후보 |
| 3 · 키네틱 세리프 + 리빙 캔버스 | 기존 카피 + 글자별 리빌·블롭·₩ 워터마크·KPI 스트립 | 보류 — 요소 단위 재활용 가능 (KPI 스트립 등) |

- 동작 목업: [hero-explorations-2026-07.html](./hero-explorations-2026-07.html) (안 2·3, dev 서버 `/fonts` 필요 — public/에 두면 배포에 노출되므로 여기 보관)
- 그 외 보류: 태그라인 시각화(흩어진 칩이 스크린샷 목업으로 흡수) — `idea/landing-convergence` 브랜치, [parked-branches.md](../parked-branches.md) 참조

## 2차 탐색 — 시네마틱 비디오 히어로 (2026-07-06)

motionsites.ai 저장 레퍼런스(풀스크린 loop 비디오 + liquid-glass) 3안 실렌더 비교, **B 채택**.
공통: 3rd-party CloudFront 클립은 브라우저 크로스오리진 로드 실패 → `public/landing/`에 자체 호스팅.

| 안 | 컨셉 | 톤 | 상태 |
|---|---|---|---|
| A · Velorah | 풀스크린 영상 + Noto Serif KR 세리프 헤드라인 + liquid-glass nav | 다크 | 미채택 — 다크가 라이트 본문과 충돌, 세리프 헤드라인 현행과 중복 |
| **B · VaultShield** | 웜 라이트 배경 + Pretendard 볼드 아이콘 헤딩(지갑·레이어·스파클) + 포레스트 CTA + 모바일 슬라이드 시트 | 라이트 | ✅ **채택** — `VideoHeroLight.tsx`, `public/landing/hero2.mp4`. 브랜드 라이트 톤과 정합, 통합 비용 최저 |
| C · Equilibrium | 하단 좌측 카피 + 중앙 liquid-glass nav pill + 우주 오브 영상 | 다크 | 미채택 — 에디토리얼하나 다크, 초점(오브)과 카피 시선 분리 |

- 채택 근거: B가 "가장 깔끔"한 이유 = 하이키 밝은 이미지 + 텍스트쪽 여백 + 초점 하나 + **브랜드 라이트 톤 일치**(A·C 다크는 "다른 사이트" 느낌). → 실제 브랜드 영상 제작 시 *밝은 하이키·여백·단일 초점* 클립을 골라야 이 깔끔함이 유지됨.
- 브랜드 조정: 보라 액센트(#7342E2)→포레스트(#2F5D4F), Helvetica Now(한글 X)→Pretendard, 카피는 정본 태그라인.
- ⚠️ 현재 영상(`hero2.mp4`)은 범용 AI 추상 클립 — 발행 전 돈Doc다운 영상으로 교체 권장.
- A·C 컴포넌트·영상은 채택 후 삭제(레포 경량화). 복구용 원본 비디오 URL:
  - A(Velorah): `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4`
  - C(Equilibrium): `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4`
  - B(채택, VaultShield): `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_003132_8b7edcb6-c64d-4a52-a9ca-879942e122ad.mp4`

# 보류(parked) 브랜치

main에 머지하지 않고 의도적으로 멈춘 탐색 브랜치 기록. 삭제하지 않고 여기 1줄로 추적해 "이게 뭐였지" 재조사를 막는다.

## feat/kis-broker — KIS OpenAPI 증권 연동 (2026-04-28 정지)

- **무엇**: 한국투자증권 OpenAPI 연동 PoC. 잔고/현재가 조회 + 보유 분석 + 주문 실행 + 토큰 캐시.
  - `lib/kis.ts` (211줄), `app/api/broker/{balance,price,analyze,execute}/route.ts`, `prisma/schema.prisma` +8줄. 총 6파일·411줄.
- **상태**: main 대비 178 behind, 4/28 이후 커밋 없음. 로드맵 진입점 없음.
- **왜 멈췄나**: 돈독 살길은 **마이데이터 밖 자산(현금·부동산·해외)+해석**. 실시간 브로커 연동(주문 실행 포함)은 (1) 금융투자회사 임직원 외부활동·유사투자자문 규제 리스크가 크고, (2) 제품 포지셔닝(자산 통합·해석)과 결이 다르다. → vault [[project_business_ideation_2026_06]], [[project_dondoc_ingestion_layer]] 참고.
- **되살릴 조건**: 조회 전용(주문 실행 제외)으로 범위를 좁히고, 규제 baseline을 클리어한 경우에만. 그 전까진 archive.

> carry 종결: planner-2026-06-28-v2 P2. 브랜치는 보존(revive 시 cherry-pick 가능).

## idea/landing-convergence — 태그라인 수렴 애니메이션 (2026-07-05 정지)

- **무엇**: 히어로 스크린샷 목업 위 오버레이 — 자산 칩 5개가 흩어진 위치에서 날아와 화면 안으로 흡수(AssetConvergence.tsx). 검증 완료 상태에서 정지.
- **왜 멈췄나**: 사용자가 백지 3안 재비교 요청 → Hero v5(라이브 프로덕트 스테이지) 채택으로 방향 교체. 애니메이션 자체는 동작·검증됨.
- **되살릴 조건**: 랜딩 하위 섹션이나 커뮤니티/캠페인 페이지에서 태그라인 연출이 필요할 때 cherry-pick. docs/design/hero-explorations.md 참조.

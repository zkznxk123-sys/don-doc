#!/bin/bash
# 공모주 일정 + 스팩 유니버스 자동 재생성 — launchd가 호출.
# 2026-08-05: 주1회(월)→매일로 전환 — 38 수요예측 결과(기관경쟁률·확정공모가)는 청약 직전
# 발표라 주간 스냅샷이 창을 놓침(딜리셔스 8/3 실증: 184.06:1이 페이지엔 있었으나 미반영).
# 무변경 시 커밋 스킵이라 매일 돌아도 실변경 있는 날만 [cron] 커밋.
# 38.co.kr → offerings.generated.ts, KRX → spac-universe.generated.ts. IPO_calander(월 09:00)와 같은 리듬.
#
# 2026-07-02: 생성 후 auto-push 추가 (planner 7/2 — 로컬만 갱신돼 prod 일정이 낡던 문제).
# 안전장치: ①생성 파일 2개만 커밋(작업 중 다른 변경 미포함) ②sanity 게이트(임포트 + 비어있지 않음)
# 통과 시에만 ③pull --rebase --autostash 후 push, 실패 시 로컬 커밋 유지(다음 실행 때 재시도).
set -u
export PATH="/opt/homebrew/opt/node@22/bin:/usr/bin:/bin:$PATH"
cd /Users/sangbinhan/Developer/don-doc || exit 1

GEN_FILES=(components/ipo/offerings.generated.ts components/ipo/spac-universe.generated.ts)

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ipo-schedule-build ==="
node_modules/.bin/tsx scripts/ipo-schedule-build.ts || { echo "!! schedule-build 실패 — push 생략"; exit 1; }
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ipo-spac-universe-build ==="
node_modules/.bin/tsx scripts/ipo-spac-universe-build.ts || { echo "!! spac-universe-build 실패 — push 생략"; exit 1; }

# 변경 없으면 종료 (매주 같은 데이터면 빈 커밋 안 만듦)
if git diff --quiet -- "${GEN_FILES[@]}"; then
  echo "=== 생성 파일 변경 없음 — push 생략 ==="
  exit 0
fi

# sanity 게이트 — 생성 파일이 임포트되고 배열이 하한선 이상이어야 커밋
# (38.co.kr HTML 구조가 바뀌어 파싱이 31건→1건 등으로 조용히 무너지는 경우, "비어있지 않음"만으로는
# 통과해버려 무인 push까지 진행됨 — 2026-07-27 4팀 라운드 P0)
if ! node_modules/.bin/tsx -e "
  import { GENERATED_OFFERINGS } from './components/ipo/offerings.generated'
  import { SPAC_UNIVERSE } from './components/ipo/spac-universe.generated'
  if (!Array.isArray(GENERATED_OFFERINGS) || GENERATED_OFFERINGS.length < 10) throw new Error('offerings too small: ' + GENERATED_OFFERINGS.length)
  if (!Array.isArray(SPAC_UNIVERSE) || SPAC_UNIVERSE.length < 10) throw new Error('spac universe too small: ' + SPAC_UNIVERSE.length)
  console.log('sanity OK — offerings ' + GENERATED_OFFERINGS.length + ' · spacs ' + SPAC_UNIVERSE.length)
"; then
  echo "!! sanity 게이트 실패 — 생성 파일 복구 후 push 생략"
  git checkout -- "${GEN_FILES[@]}"
  exit 1
fi

# 생성 파일 2개만 커밋 — 같은 repo에서 작업 중인 다른 변경은 건드리지 않음
git add "${GEN_FILES[@]}"
git commit -m "chore(ipo): 일정·스팩 유니버스 자동 갱신 [cron]

Co-Authored-By: ipo-schedule-cron <noreply@local>" || { echo "!! commit 실패"; exit 1; }

# push — 다른 커밋이 먼저 가 있으면 rebase(작업트리는 autostash로 보존)
if git pull --rebase --autostash origin main && git push origin main; then
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') push 완료 ==="
else
  echo "!! push 실패 — 로컬 커밋 유지, 다음 주기에 재시도"
fi

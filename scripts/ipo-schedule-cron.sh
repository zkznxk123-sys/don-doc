#!/bin/bash
# 공모주 일정 주간 자동 재생성 — launchd가 호출.
# 38.co.kr → components/ipo/offerings.generated.ts. IPO_calander(월 09:00)와 같은 소스·리듬.
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
cd /Users/sangbinhan/Developer/don-doc || exit 1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ipo-schedule-build ==="
node_modules/.bin/tsx scripts/ipo-schedule-build.ts

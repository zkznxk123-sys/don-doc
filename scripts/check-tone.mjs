#!/usr/bin/env node
/**
 * 사용자 노출 toast 톤 가드 — 합쇼체(…습니다/…입니다) 금지, 해요체 권장.
 * 출처: _rules §5 / CLAUDE.md Sunny 7규칙. 코드·주석·서버 에러 메시지는 대상 아님(toast 한정).
 * 위반 있으면 exit 1 (빌드/CI 차단).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['components', 'app']
const TOAST_RE = /toast\.(?:success|error|info|warning|message)\s*\(\s*(['"`])((?:\\.|(?!\1).)*?)\1/gs
const HAPSYO_RE = /(습니다|입니다)\.?$/   // 문장 끝 합쇼체

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p, out) }
    else if (/\.(tsx?|jsx?)$/.test(p) && !/\.test\./.test(p)) out.push(p)
  }
  return out
}

const violations = []
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8')
    let m
    while ((m = TOAST_RE.exec(src))) {
      const text = m[2]
      if (HAPSYO_RE.test(text.trim())) {
        const line = src.slice(0, m.index).split('\n').length
        violations.push(`${file}:${line}  "${text}"`)
      }
    }
  }
}

if (violations.length) {
  console.error(`❌ toast 합쇼체 ${violations.length}건 — 해요체로 바꾸세요 (…습니다 → …어요/…예요):`)
  for (const v of violations) console.error('  ' + v)
  process.exit(1)
}
console.log('✅ toast 톤 OK (합쇼체 0건)')

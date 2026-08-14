#!/usr/bin/env node
/**
 * 시맨틱 색상 dead CSS 가드 — @utility(income/expense/savings/warning)는 고정값이라
 * Tailwind opacity modifier(/N)가 동작하지 않는다(클래스가 생성되지 않아 무배경/무보더 렌더).
 * 출처: design-2026-08-13 진단 · design-2026-08-14 P0 격상(전수 스캔에서 형제 패턴 5곳 추가 발견).
 * 위반 있으면 exit 1 (빌드/CI 차단). 옅은 톤은 *-soft 유틸(bg-income-soft 등)을 사용할 것.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['components', 'app']
const DEAD_RES = [
  /\bbg-(?:income|expense|savings|warning)\/\d+/g,
  /\bborder-(?:income|expense|savings|warning)\/\d+/g,
  /\btext-(?:income|expense|savings|warning)\/\d+/g,
]

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
    for (const re of DEAD_RES) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(src))) {
        const line = src.slice(0, m.index).split('\n').length
        violations.push({ file, line, token: m[0] })
      }
    }
  }
}

if (violations.length) {
  console.error(`✗ 시맨틱 색상 opacity modifier ${violations.length}건 — @utility엔 /N이 동작하지 않아요. *-soft 유틸로 바꿔주세요.`)
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.token}`)
  process.exit(1)
}
console.log('✓ check:css-tokens — 시맨틱 색상 dead modifier 0건')

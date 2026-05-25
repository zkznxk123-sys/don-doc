#!/usr/bin/env npx tsx
/**
 * 돈보라 폼 자동 채우기 — 돈독 DB 데이터를 폼 항목에 매핑해 출력.
 *
 * 사용:
 *   cd ~/Developer/don-doc
 *   npx tsx scripts/donbora-fill.ts [YYYY-MM]
 *
 * 인자 없으면 저번 달(폼은 월 마감 후 익월 입력).
 * 결과: stdout 출력 + vault 02_family/household/donbora/donbora-YYYY-MM.md 저장.
 * 설정·키워드 매핑: ~/.claude/skills/donbora-fill/config.yml
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

const prisma = new PrismaClient()
const CONFIG_PATH = path.resolve(process.env.HOME!, '.claude/skills/donbora-fill/config.yml')
const VAULT_DIR = path.resolve(
  process.env.HOME!,
  'Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian_HaAnn/02_family/household/donbora'
)

interface Config {
  family_name: string
  personal: Record<string, any>
  real_estate: Array<{ location: string; property_type: string }>
  goals: Record<string, string>
  assets: { deposit_account_name: string }
  debts: { mortgage_types: string[]; credit_loan_types: string[]; etc_types: string[]; exclude_types: string[] }
  income: Record<string, string[]>
  category_to_form: Record<string, string>
  ambiguous_categories: Record<string, { default: string; rules: Array<{ keywords: string[]; form: string }> }>
  form_expense_categories: string[]
}

const config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8')) as Config

function parseTargetMonth(): { year: number; month: number; label: string } {
  const arg = process.argv[2]
  let y: number, m: number
  if (arg && /^\d{4}-\d{2}$/.test(arg)) {
    const [ys, ms] = arg.split('-')
    y = parseInt(ys); m = parseInt(ms)
  } else {
    const now = new Date()
    y = now.getFullYear()
    m = now.getMonth()
    if (m === 0) { m = 12; y -= 1 }
  }
  return { year: y, month: m, label: `${y}-${String(m).padStart(2, '0')}` }
}

function fmtNumOnly(amount: number): number {
  return Math.round(amount / 10000)
}

function matchByKeywords(desc: string, rules: Array<{ keywords: string[]; form: string }>): string | null {
  const d = desc.toLowerCase()
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (d.includes(kw.toLowerCase())) return rule.form
    }
  }
  return null
}

async function main() {
  const { year, month, label } = parseTargetMonth()
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const family = await prisma.familyGroup.findFirst({ where: { name: config.family_name } })
  if (!family) { console.error(`Family ${config.family_name} not found`); process.exit(1) }
  const familyId = family.id

  const accounts = await prisma.account.findMany({
    where: { familyId },
    select: { id: true, name: true, type: true, balance: true,
              debtDetail: { select: { debtType: true, monthlyPayment: true } } },
  })

  const cashAccounts = accounts.filter(a => a.type === 'CASH')
  const depositAcct = cashAccounts.find(a => a.name === config.assets.deposit_account_name)
  const depositBalance = depositAcct?.balance ?? 0
  const cashSum = cashAccounts.reduce((s, a) => s + a.balance, 0) - depositBalance
  const investSum = accounts.filter(a => a.type === 'INVESTMENT').reduce((s, a) => s + a.balance, 0)
  const cryptoSum = accounts.filter(a => a.type === 'CRYPTO').reduce((s, a) => s + a.balance, 0)
  const pensionSum = accounts.filter(a => a.type === 'PENSION').reduce((s, a) => s + a.balance, 0)
  const financialSum = investSum + cryptoSum + pensionSum

  const debts = accounts.filter(a => a.type === 'DEBT' || a.type === 'CREDIT_CARD')
  let mortgage = 0, creditLoan = 0, etcDebt = 0
  const excludeNames: string[] = []
  for (const d of debts) {
    const dt = d.debtDetail?.debtType ?? 'ETC'
    if (config.debts.exclude_types.includes(dt)) { excludeNames.push(`${d.name} (${dt})`); continue }
    if (config.debts.mortgage_types.includes(dt)) mortgage += d.balance
    else if (config.debts.credit_loan_types.includes(dt)) creditLoan += d.balance
    else if (config.debts.etc_types.includes(dt)) etcDebt += d.balance
    else etcDebt += d.balance
  }
  const totalDebt = mortgage + creditLoan + etcDebt

  const txs = await prisma.transaction.findMany({
    where: {
      account: { familyId },
      date: { gte: start, lt: end },
      isExcluded: false,
      parentId: null,
    },
    select: { amount: true, category: true, description: true, account: { select: { type: true, name: true } } },
  })

  const incomeMap: Record<string, number> = { 근로소득: 0, 금융소득: 0, 부업: 0, 임대기타소득: 0 }
  const expenseMap: Record<string, number> = {}
  for (const slot of config.form_expense_categories) expenseMap[slot] = 0

  const uncategorized: Array<{ amount: number; description: string; category: string }> = []

  const catToIncomeSlot: Record<string, string> = {}
  for (const [slot, cats] of Object.entries(config.income)) {
    for (const c of cats) catToIncomeSlot[c] = slot
  }

  for (const t of txs) {
    const cat = t.category || ''
    const desc = t.description || ''

    if (t.amount > 0) {
      const slot = catToIncomeSlot[cat]
      if (slot) incomeMap[slot] += t.amount
      else uncategorized.push({ amount: t.amount, description: desc, category: cat + ' (수입 미매핑)' })
      continue
    }

    const amt = Math.abs(t.amount)
    let formSlot: string | null = null

    if (config.ambiguous_categories[cat]) {
      const ambig = config.ambiguous_categories[cat]
      formSlot = matchByKeywords(desc, ambig.rules) || ambig.default
    } else if (config.category_to_form[cat]) {
      formSlot = config.category_to_form[cat]
    } else if (config.form_expense_categories.includes(cat)) {
      formSlot = cat
    }

    if (formSlot && formSlot in expenseMap) {
      expenseMap[formSlot] += amt
    } else {
      uncategorized.push({ amount: amt, description: desc, category: cat || '(미분류)' })
    }
  }

  const totalIncome = Object.values(incomeMap).reduce((s, v) => s + v, 0)
  const totalExpense = Object.values(expenseMap).reduce((s, v) => s + v, 0)
  const savings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0

  // ─── 출력 빌드 (vault 저장 + stdout 양쪽) ──────────────────────
  const lines: string[] = []
  const out = (s: string = '') => lines.push(s)
  const p = config.personal

  out(`# 돈보라 폼 ${label} 분`)
  out()
  out(`> 생성: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · 돈독 DB → 자동 매핑. 폼 입력 시 검토.`)
  out()

  out(`## 인적정보`)
  out(`- 이름: ${p.name}`)
  out(`- 연락처: ${p.phone}`)
  out(`- 연령대: ${p.age_group}`)
  out(`- 가족구성: ${p.family_composition}`)
  out(`- 동거 자녀 여부: ${p.has_child_living_together}`)
  out(`- 자녀 수: ${p.children_count}`)
  out(`- 퇴직예상시기: ${p.retirement_target_year}`)
  out(`- 거주지: ${p.residence_district}`)
  out(`- 직장 위치: ${p.work_location}`)
  out(`- 참고사항 (이벤트): ${p.event_note}`)
  out()

  out(`## 보유 부동산`)
  config.real_estate.forEach((r, i) => out(`- 부동산 ${i + 1}: ${r.location} / ${r.property_type}`))
  out()

  out(`## 목표설정`)
  out(`- 5~10년 장기목표: ${config.goals.long_term_5_10y}`)
  out(`- 1년 목표:`)
  for (const l of config.goals.year_1.split('\n')) out(`  - ${l}`)
  out(`- 한달 목표:`)
  for (const l of config.goals.month.split('\n')) out(`  - ${l}`)
  if (config.goals.switch_target) out(`- 갈아타기 목표: ${config.goals.switch_target}`)
  out()

  out(`## 보유자산`)
  out(`- 현금(종잣돈): ${fmtNumOnly(cashSum).toLocaleString()}만원 (CASH 합 − 월세보증금)`)
  out(`- 거주지 전세/월세 보증금: ${fmtNumOnly(depositBalance).toLocaleString()}만원`)
  out(`- 금융자산 (예금·주식·코인·연금): ${fmtNumOnly(financialSum).toLocaleString()}만원`)
  out(`  - 주식+코인: ${fmtNumOnly(investSum + cryptoSum).toLocaleString()}만원`)
  out(`  - 연금: ${fmtNumOnly(pensionSum).toLocaleString()}만원`)
  out(`- **총 유동자산**: ${fmtNumOnly(cashSum + depositBalance + financialSum).toLocaleString()}만원`)
  out()

  out(`## 부채`)
  out(`- 주택담보대출: ${fmtNumOnly(mortgage).toLocaleString()}만원`)
  out(`- 신용대출: ${fmtNumOnly(creditLoan).toLocaleString()}만원`)
  out(`- 기타대출: ${fmtNumOnly(etcDebt).toLocaleString()}만원`)
  out(`- **총 부채**: ${fmtNumOnly(totalDebt).toLocaleString()}만원`)
  if (excludeNames.length) out(`  - (제외: ${excludeNames.join(', ')} — 받은 보증금/폼 비대상)`)
  out()

  out(`## 월 수입 — ${label} 실제값`)
  out(`- 근로소득: ${fmtNumOnly(incomeMap.근로소득).toLocaleString()}만원`)
  out(`- 금융소득: ${fmtNumOnly(incomeMap.금융소득).toLocaleString()}만원`)
  out(`- 부업: ${fmtNumOnly(incomeMap.부업).toLocaleString()}만원`)
  out(`- 임대/기타소득: ${fmtNumOnly(incomeMap.임대기타소득).toLocaleString()}만원`)
  out(`- **총 수입**: ${fmtNumOnly(totalIncome).toLocaleString()}만원`)
  out()

  out(`## 월 지출 — ${label} 키워드 자동 분배`)
  for (const slot of config.form_expense_categories) {
    const v = expenseMap[slot]
    out(`- ${slot}: ${fmtNumOnly(v).toLocaleString()}만원`)
  }
  out(`- **총 지출**: ${fmtNumOnly(totalExpense).toLocaleString()}만원`)
  out()

  out(`## 월 저축 (참고용 — 폼에서 자동 계산)`)
  out(`- 저축액: ${fmtNumOnly(savings).toLocaleString()}만원`)
  out(`- 저축률: ${savingsRate.toFixed(1)}%`)
  out()

  if (uncategorized.length) {
    out(`## ⚠️ 미분류 거래 (${uncategorized.length}건) — 검토 필요`)
    uncategorized
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 30)
      .forEach(t => {
        out(`- ${(Math.abs(t.amount) / 1000).toFixed(0)}천원 / ${t.description} / [${t.category}]`)
      })
    if (uncategorized.length > 30) out(`  - ... 외 ${uncategorized.length - 30}건`)
    out()
  }

  out(`---`)
  out(`*키워드·정적정보 변경: \`~/.claude/skills/donbora-fill/config.yml\`*`)

  const output = lines.join('\n')

  // stdout 출력
  console.log(output)

  // vault 저장
  fs.mkdirSync(VAULT_DIR, { recursive: true })
  const filePath = path.join(VAULT_DIR, `donbora-${label}.md`)
  fs.writeFileSync(filePath, output, 'utf8')
  console.error(`\n[saved] ${filePath}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

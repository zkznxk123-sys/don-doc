import { describe, it, expect } from 'vitest'
import {
  roundLot, requiredShares, depositFor, expectedProportional, computeBudgetPlan, BUFFER_LEVELS,
} from './allocation'
import type { Account } from '@/components/ipo/board-data'

// 레메디 실측 기준(38 라이브 표): 공모가 20,700 · 증거금률 50% · 경쟁률 3,261.43 · 균등 0.48.
const 레메디 = { price: 20_700, dr: 0.5, rate: 3261.43, gyun: 0.48, minShares: 10, limit: 10_000 }

const acct = (person: string, broker: string): Account => ({
  id: `${person}-${broker}`, person, broker,
  readiness: { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK' },
})

describe('roundLot', () => {
  it('100주 이상은 100주 단위 반올림', () => {
    expect(roundLot(2595)).toBe(2600)
    expect(roundLot(2408)).toBe(2400)
    expect(roundLot(2205)).toBe(2200)
  })
  it('100주 미만은 10주 단위, 0 유지', () => {
    expect(roundLot(42)).toBe(40)
    expect(roundLot(0)).toBe(0)
  })
})

describe('requiredShares — 레메디 1주 목표', () => {
  const { rate, gyun } = 레메디
  it('안정(×1.53)=2,600 / 기본(×1.42)=2,400 / 도전(×1.30)=2,200', () => {
    expect(requiredShares(1, gyun, rate, 1.53)).toBe(2600)
    expect(requiredShares(1, gyun, rate, 1.42)).toBe(2400)
    expect(requiredShares(1, gyun, rate, 1.3)).toBe(2200)
  })
  it('BUFFER_LEVELS는 안정→기본→도전 순(안정 앵커)', () => {
    expect(BUFFER_LEVELS.map(l => l.key)).toEqual(['안정', '기본', '도전'])
    expect(BUFFER_LEVELS[0].mult).toBeGreaterThan(BUFFER_LEVELS[2].mult)
  })
})

describe('depositFor / expectedProportional', () => {
  it('2,600주 → 증거금 26,910,000원(2,691만)', () => {
    expect(depositFor(2600, 레메디.price, 레메디.dr)).toBe(26_910_000)
  })
  it('예상 비례배정 = 청약주수 / 경쟁률', () => {
    expect(expectedProportional(2600, 레메디.rate)).toBeCloseTo(0.797, 3)
  })
  it('경쟁률 0이면 0(0 나눗셈 방지)', () => {
    expect(expectedProportional(2600, 0)).toBe(0)
  })
})

describe('computeBudgetPlan', () => {
  const base = {
    price: 레메디.price, depositRate: 레메디.dr, minShares: 레메디.minShares,
    rate: 레메디.rate, gyun: 레메디.gyun, brokers: ['KB'], limit: 레메디.limit,
  }

  it('예산 3,000만 · KB 명의 2 → 잔액 집중(100주 내림), 예산 이내', () => {
    const plan = computeBudgetPlan({ ...base, accounts: [acct('본인', 'KB'), acct('아내', 'KB')], budgetWon: 30_000_000 })
    expect(plan).not.toBeNull()
    expect(plan!.n).toBe(2)
    // 첫 명의에 잔액 비례 집중 후 100주 내림, 나머지는 최소청약.
    expect(plan!.rows[0].shares).toBe(2800)
    expect(plan!.rows[1].shares).toBe(10)
    expect(plan!.totalDep).toBeLessThanOrEqual(30_000_000)   // 예산 초과 금지
    expect(plan!.gyunTotal).toBeCloseTo(0.96, 2)
  })

  it('주관사 계좌 명의가 없으면 n=0, eligibleCount=0', () => {
    const plan = computeBudgetPlan({ ...base, accounts: [acct('본인', '삼성')], budgetWon: 30_000_000 })
    expect(plan!.n).toBe(0)
    expect(plan!.eligibleCount).toBe(0)
  })

  it('예산이 최소청약 증거금보다 작으면 n=0(하지만 eligible은 셈)', () => {
    const plan = computeBudgetPlan({ ...base, accounts: [acct('본인', 'KB')], budgetWon: 50_000 })
    expect(plan!.n).toBe(0)
    expect(plan!.eligibleCount).toBe(1)
  })

  it('공모가·경쟁률·예산 중 하나라도 0/음수면 null', () => {
    const accounts = [acct('본인', 'KB')]
    expect(computeBudgetPlan({ ...base, accounts, budgetWon: 0 })).toBeNull()
    expect(computeBudgetPlan({ ...base, accounts, price: 0, budgetWon: 30_000_000 })).toBeNull()
    expect(computeBudgetPlan({ ...base, accounts, rate: 0, budgetWon: 30_000_000 })).toBeNull()
  })

  it('명의당 1계좌만(중복청약 금지) — 같은 명의 여러 KB 계좌여도 n=1', () => {
    const plan = computeBudgetPlan({
      ...base, budgetWon: 30_000_000,
      accounts: [acct('본인', 'KB증권'), acct('본인', 'KB')],
    })
    expect(plan!.n).toBe(1)
    expect(plan!.eligibleCount).toBe(1)
  })
})

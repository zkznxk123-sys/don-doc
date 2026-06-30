'use client'

/**
 * 공모주 원장 로컬 스토어 — 브라우저 localStorage 영속(기기 로컬).
 * 데모와 분리: 사용자가 직접 추가하면 '내 작업본'(initialized=true)으로 전환되고
 * 데모는 화면에서 사라진다. reset()으로 데모 보기로 복귀.
 * (멀티기기 동기화는 DB 영속 단계에서 — 지금은 PoC 로컬.)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  DEMO_ACCOUNTS, DEMO_LEDGER, DEMO_SPACS, OFFERING_BY_NAME,
  type Account, type LedgerRow, type Spac,
} from '@/components/ipo/board-data'

const KEY = 'dondoc.ipo.v1'

/** 38 미제공 종목 필드(수동 입력) — 시총·유통금액·유통가능비율. */
export interface OfferingOverride {
  marketCapEok?: number   // 시가총액(억)
  floatAmountEok?: number // 유통금액(억)
  floatRatio?: number     // 유통가능비율(%)
}

interface IpoState {
  accounts: Account[]
  ledger: LedgerRow[]
  spacs: Spac[]
  memos: Record<string, string>   // 종목명 → 개인메모(판단·추천 아님, 본인 기록)
  overrides: Record<string, OfferingOverride>  // 종목명 → 38 미제공 수동 필드
  initialized: boolean   // 사용자가 직접 입력하기 시작했나
}

const EMPTY: IpoState = { accounts: [], ledger: [], spacs: [], memos: {}, overrides: {}, initialized: false }

function load(): IpoState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<IpoState>
    // 스키마 진화 방어: 옛 저장본에 없던 필드 백필
    return {
      accounts: s.accounts ?? [],
      ledger: s.ledger ?? [],
      spacs: s.spacs ?? [],
      memos: s.memos ?? {},
      overrides: s.overrides ?? {},
      initialized: !!s.initialized,
    }
  } catch { return null }
}

function newId(): string {
  try { return crypto.randomUUID() } catch { return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}` }
}

export interface IpoData {
  hydrated: boolean
  showDemo: boolean              // 데모 보기(읽기전용) 여부
  accounts: Account[]
  ledger: LedgerRow[]
  spacs: Spac[]
  addAccount: (a: Omit<Account, 'id'>) => void
  updateAccount: (id: string, patch: Omit<Account, 'id'>) => void
  removeAccount: (id: string) => void
  addSub: (r: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>) => void
  updateSub: (index: number, patch: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>) => void
  removeSub: (index: number) => void
  addSpac: (s: Omit<Spac, 'id'>) => void
  updateSpac: (id: string, patch: Omit<Spac, 'id'>) => void
  removeSpac: (id: string) => void
  memos: Record<string, string>
  setMemo: (offering: string, text: string) => void
  overrides: Record<string, OfferingOverride>
  setOverride: (offering: string, patch: OfferingOverride) => void
  seedDemo: () => void           // 데모를 내 작업본으로 복사
  reset: () => void              // 데모 보기로 복귀(내 데이터 삭제)
}

/** 입력값 → 완성 LedgerRow (kind·일정은 generated 종목에서 보강). */
function buildRow(r: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>): LedgerRow {
  const off = OFFERING_BY_NAME.get(r.offering)
  const today = new Date()
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return {
    ...r,
    kind: /스팩/.test(r.offering) ? 'SPAC' : 'IPO',
    subStart: off?.subStart ?? todayISO,
    refundDate: off?.refundDate,
    listingDate: off?.listingDate,
  }
}

export function useIpoData(): IpoData {
  const [state, setState] = useState<IpoState>(EMPTY)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const s = load()
    if (s) setState(s)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {} }
  }, [state, hydrated])

  const showDemo = !state.initialized
  const accounts = showDemo ? DEMO_ACCOUNTS : state.accounts
  const ledger = showDemo ? DEMO_LEDGER : state.ledger
  const spacs = showDemo ? DEMO_SPACS : state.spacs

  const addAccount = useCallback((a: Omit<Account, 'id'>) => {
    setState(prev => {
      const base = prev.initialized ? prev : { accounts: [], ledger: [], spacs: [], memos: prev.memos, overrides: prev.overrides, initialized: true }
      return { ...base, accounts: [...base.accounts, { ...a, id: newId() }] }
    })
  }, [])

  const updateAccount = useCallback((id: string, patch: Omit<Account, 'id'>) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === id ? { ...patch, id } : a) }))
  }, [])

  const removeAccount = useCallback((id: string) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) }))
  }, [])

  const addSub = useCallback((r: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>) => {
    const row = buildRow(r)
    setState(prev => {
      const base = prev.initialized ? prev : { accounts: [], ledger: [], spacs: [], memos: prev.memos, overrides: prev.overrides, initialized: true }
      return { ...base, ledger: [...base.ledger, row] }
    })
  }, [])

  const updateSub = useCallback((index: number, patch: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>) => {
    const row = buildRow(patch)
    setState(prev => ({ ...prev, ledger: prev.ledger.map((r, i) => i === index ? row : r) }))
  }, [])

  const removeSub = useCallback((index: number) => {
    setState(prev => ({ ...prev, ledger: prev.ledger.filter((_, i) => i !== index) }))
  }, [])

  const addSpac = useCallback((s: Omit<Spac, 'id'>) => {
    setState(prev => {
      const base = prev.initialized ? prev : { accounts: [], ledger: [], spacs: [], memos: prev.memos, overrides: prev.overrides, initialized: true }
      return { ...base, spacs: [...base.spacs, { ...s, id: newId() }] }
    })
  }, [])

  const updateSpac = useCallback((id: string, patch: Omit<Spac, 'id'>) => {
    setState(prev => ({ ...prev, spacs: prev.spacs.map(s => s.id === id ? { ...patch, id } : s) }))
  }, [])

  const removeSpac = useCallback((id: string) => {
    setState(prev => ({ ...prev, spacs: prev.spacs.filter(s => s.id !== id) }))
  }, [])

  const setMemo = useCallback((offering: string, text: string) => {
    setState(prev => ({ ...prev, memos: { ...prev.memos, [offering]: text } }))
  }, [])

  const setOverride = useCallback((offering: string, patch: OfferingOverride) => {
    setState(prev => ({ ...prev, overrides: { ...prev.overrides, [offering]: { ...prev.overrides[offering], ...patch } } }))
  }, [])

  const seedDemo = useCallback(() => {
    setState(prev => ({ accounts: [...DEMO_ACCOUNTS], ledger: [...DEMO_LEDGER], spacs: [...DEMO_SPACS], memos: prev.memos, overrides: prev.overrides, initialized: true }))
  }, [])

  const reset = useCallback(() => setState(EMPTY), [])

  return { hydrated, showDemo, accounts, ledger, spacs, addAccount, updateAccount, removeAccount, addSub, updateSub, removeSub, addSpac, updateSpac, removeSpac, memos: state.memos, setMemo, overrides: state.overrides, setOverride, seedDemo, reset }
}

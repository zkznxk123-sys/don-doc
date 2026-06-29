'use client'

/**
 * 공모주 원장 로컬 스토어 — 브라우저 localStorage 영속(기기 로컬).
 * 데모와 분리: 사용자가 직접 추가하면 '내 작업본'(initialized=true)으로 전환되고
 * 데모는 화면에서 사라진다. reset()으로 데모 보기로 복귀.
 * (멀티기기 동기화는 DB 영속 단계에서 — 지금은 PoC 로컬.)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  DEMO_ACCOUNTS, DEMO_LEDGER, OFFERING_BY_NAME,
  type Account, type LedgerRow,
} from '@/components/ipo/board-data'

const KEY = 'dondoc.ipo.v1'

interface IpoState {
  accounts: Account[]
  ledger: LedgerRow[]
  initialized: boolean   // 사용자가 직접 입력하기 시작했나
}

const EMPTY: IpoState = { accounts: [], ledger: [], initialized: false }

function load(): IpoState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as IpoState) : null
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
  addAccount: (a: Omit<Account, 'id'>) => void
  updateAccount: (id: string, patch: Omit<Account, 'id'>) => void
  removeAccount: (id: string) => void
  addSub: (r: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>) => void
  updateSub: (index: number, patch: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>) => void
  removeSub: (index: number) => void
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

  const addAccount = useCallback((a: Omit<Account, 'id'>) => {
    setState(prev => {
      const base = prev.initialized ? prev : { accounts: [], ledger: [], initialized: true }
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
      const base = prev.initialized ? prev : { accounts: [], ledger: [], initialized: true }
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

  const seedDemo = useCallback(() => {
    setState({ accounts: [...DEMO_ACCOUNTS], ledger: [...DEMO_LEDGER], initialized: true })
  }, [])

  const reset = useCallback(() => setState(EMPTY), [])

  return { hydrated, showDemo, accounts, ledger, addAccount, updateAccount, removeAccount, addSub, updateSub, removeSub, seedDemo, reset }
}

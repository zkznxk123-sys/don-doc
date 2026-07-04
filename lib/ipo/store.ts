'use client'

/**
 * 공모주 스토어 — DB(멀티기기) + localStorage(오프라인 캐시) 이중 영속.
 * 로드 우선순위: DB > localStorage > EMPTY. 변경 시 debounce PUT.
 * 빈 상태에서 시작해 직접 입력(계좌·청약·스팩). reset()으로 전체 삭제.
 * 기존 로컬 작업본은 첫 로드 때 DB로 자동 마이그레이션.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  OFFERING_BY_NAME,
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

/** 임의 저장본(로컬·DB) → 완전한 IpoState. 옛 저장본에 없던 필드 백필. */
export function normalize(s: Partial<IpoState> | null | undefined): IpoState {
  return {
    accounts: s?.accounts ?? [],
    ledger: s?.ledger ?? [],
    spacs: s?.spacs ?? [],
    memos: s?.memos ?? {},
    overrides: s?.overrides ?? {},
    initialized: !!s?.initialized,
  }
}

const SAVED_AT_KEY = `${KEY}.savedAt`

function load(): { state: IpoState; savedAt: string | null } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return {
      state: normalize(JSON.parse(raw) as Partial<IpoState>),
      savedAt: localStorage.getItem(SAVED_AT_KEY),
    }
  } catch { return null }
}

function newId(): string {
  try { return crypto.randomUUID() } catch { return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}` }
}

export interface IpoData {
  hydrated: boolean
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
  reset: () => void              // 내 데이터 전체 삭제(빈 상태로)
}

/** 입력값 → 완성 LedgerRow (kind·일정은 generated 종목에서 보강). */
export function buildRow(r: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>): LedgerRow {
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
  const dbRef = useRef(false)        // DB 사용 가능(인증됨)
  const skipSaveRef = useRef(true)   // 첫 로드 직후 1회 저장 스킵
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stampRef = useRef<string | null>(null)   // 마지막으로 본 서버 updatedAt — 낙관적 잠금 스탬프

  // 로드: DB > localStorage > EMPTY. 단, 로컬이 DB보다 확실히 최신(오프라인 편집)이면
  // 로컬 승격 후 DB로 저장 — "DB 우선"이 최신 로컬 편집을 조용히 덮던 유실 경로 차단(dev 7/2).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const local = load()
      try {
        const res = await fetch('/api/ipo/workspace')
        if (res.ok) {
          dbRef.current = true
          const j = await res.json()
          stampRef.current = j.updatedAt ?? null
          // 클라이언트 savedAt vs 서버 updatedAt — 시계 오차 감안 5초 여유
          const localNewer = !!(local?.state.initialized && local.savedAt && j.updatedAt
            && new Date(local.savedAt).getTime() > new Date(j.updatedAt).getTime() + 5_000)
          if (j.data && !localNewer) {
            if (!cancelled) setState(normalize(j.data))       // DB 작업본
          } else if (local?.state.initialized) {
            // 로컬이 더 최신 or DB 빈 경우 → 로컬 승격, DB로 저장(마이그레이션)
            if (!cancelled) { setState(local.state); skipSaveRef.current = false }
          } else if (local) {
            if (!cancelled) setState(local.state)
          }
        } else if (local) {
          if (!cancelled) setState(local.state)               // 비인증/에러 → 로컬 폴백
        }
      } catch {
        if (local && !cancelled) setState(local.state)        // 오프라인 → 로컬 폴백
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 저장: localStorage(항상 캐시, savedAt 동반) + DB(debounced, 인증 시). 첫 로드 반영은 1회 스킵.
  const stateRef = useRef(state)
  const dirtyRef = useRef(false)   // debounce 대기 중(미전송) 여부 — 언로드 flush 판단
  useEffect(() => {
    if (!hydrated) return
    stateRef.current = state
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
      localStorage.setItem(SAVED_AT_KEY, new Date().toISOString())
    } catch {}
    if (skipSaveRef.current) { skipSaveRef.current = false; return }
    if (!dbRef.current) return
    dirtyRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      dirtyRef.current = false
      try {
        const res = await fetch('/api/ipo/workspace', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: stateRef.current, baseUpdatedAt: stampRef.current }),
        })
        if (res.status === 409) {
          // 다른 기기가 먼저 저장 — 서버 최신본 채택(조용한 덮어쓰기 대신 눈에 보이는 갱신)
          const j = await res.json()
          stampRef.current = j.updatedAt ?? null
          skipSaveRef.current = true            // 채택 반영이 재PUT 루프를 돌지 않게
          setState(normalize(j.data))
          toast.warning('다른 기기에서 먼저 저장돼 최신 데이터로 갱신했어요. 방금 편집은 다시 입력해 주세요.')
        } else if (res.ok) {
          const j = await res.json()
          stampRef.current = j.updatedAt ?? stampRef.current
        } else {
          dirtyRef.current = true               // 실패 시 언로드 flush가 한 번 더 시도
        }
      } catch { dirtyRef.current = true }
    }, 800)
  }, [state, hydrated])

  // 탭 닫기·백그라운드 전환 시 debounce 대기분 즉시 flush — 800ms 안에 떠나면
  // 마지막 편집이 DB에 못 가던 조용한 유실 차단(dev 7/2). keepalive로 언로드 중에도 전송 유지.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current || !dbRef.current) return
      dirtyRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      try {
        fetch('/api/ipo/workspace', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          // 스탬프 동반 — 백그라운드로 밀려 있던 낡은 탭이 최신 데이터를 덮지 못하게(서버 409)
          body: JSON.stringify({ data: stateRef.current, baseUpdatedAt: stampRef.current }),
          keepalive: true,
        }).catch(() => {})
      } catch { /* 무시 */ }
    }
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const { accounts, ledger, spacs } = state

  const addAccount = useCallback((a: Omit<Account, 'id'>) => {
    setState(prev => ({ ...prev, initialized: true, accounts: [...prev.accounts, { ...a, id: newId() }] }))
  }, [])

  const updateAccount = useCallback((id: string, patch: Omit<Account, 'id'>) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === id ? { ...patch, id } : a) }))
  }, [])

  const removeAccount = useCallback((id: string) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) }))
  }, [])

  const addSub = useCallback((r: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>) => {
    const row = buildRow(r)
    setState(prev => ({ ...prev, initialized: true, ledger: [...prev.ledger, row] }))
  }, [])

  const updateSub = useCallback((index: number, patch: Omit<LedgerRow, 'kind' | 'subStart' | 'refundDate' | 'listingDate'>) => {
    const row = buildRow(patch)
    setState(prev => ({ ...prev, ledger: prev.ledger.map((r, i) => i === index ? row : r) }))
  }, [])

  const removeSub = useCallback((index: number) => {
    setState(prev => ({ ...prev, ledger: prev.ledger.filter((_, i) => i !== index) }))
  }, [])

  const addSpac = useCallback((s: Omit<Spac, 'id'>) => {
    setState(prev => ({ ...prev, initialized: true, spacs: [...prev.spacs, { ...s, id: newId() }] }))
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

  const reset = useCallback(() => setState(EMPTY), [])

  return { hydrated, accounts, ledger, spacs, addAccount, updateAccount, removeAccount, addSub, updateSub, removeSub, addSpac, updateSpac, removeSpac, memos: state.memos, setMemo, overrides: state.overrides, setOverride, reset }
}

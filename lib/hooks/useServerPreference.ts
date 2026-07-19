'use client'

/**
 * 서버 동기화 개인 설정 훅 공통 로직 — User.preferences(Json) ↔ localStorage 이중 영속.
 * IPO store(DB 우선 + 로컬 캐시) 경량판:
 *   1) 초기값 = localStorage(즉시 페인트) → 서버 GET 1회(모듈 캐시로 중복 방지) → 서버 값 우선
 *   2) 서버가 비었는데 로컬에 값이 있으면 로컬 값을 PUT(구 localStorage 사용자 자연 이주)
 *   3) set = 낙관적 로컬 반영 + localStorage + CustomEvent(탭 내 동기화) + PUT(실패 무시 — 오프라인 허용)
 */
import { useState, useEffect } from 'react'
import type { UserPreferences } from '@/lib/user-preferences'

// 서버 GET은 세션당 1회 — 같은 화면에 훅 사용 컴포넌트가 여럿(asset-list·donut·drawer)이라 dedupe.
let serverFetch: Promise<UserPreferences | null> | null = null
function fetchServerPreferences(): Promise<UserPreferences | null> {
  serverFetch ??= fetch('/api/user/preferences')
    .then(r => (r.ok ? r.json() : null))
    .then(j => (j?.success ? (j.preferences as UserPreferences) : null))
    .catch(() => null)
  return serverFetch
}

/** 테스트·로그아웃 등에서 서버 캐시 무효화. */
export function invalidatePreferencesCache() {
  serverFetch = null
}

function putServer(patch: UserPreferences) {
  fetch('/api/user/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {}) // 오프라인·일시 실패 허용 — localStorage가 이미 보존
}

export function useServerPreference<T>(opts: {
  prefKey: keyof UserPreferences
  storageKey: string
  eventName: string
  defaultValue: T
  parseLocal: (raw: string) => T | null
  serializeLocal: (v: T) => string
}): [T, (v: T) => void] {
  const { prefKey, storageKey, eventName, defaultValue, parseLocal, serializeLocal } = opts
  const [value, setValueState] = useState<T>(defaultValue)

  useEffect(() => {
    // 1) 로컬 즉시 반영
    let local: T | null = null
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw != null) local = parseLocal(raw)
    } catch {}
    if (local != null) setValueState(local)

    // 2) 서버 값 우선 + 자연 이주
    let cancelled = false
    fetchServerPreferences().then(prefs => {
      if (cancelled) return
      const server = prefs?.[prefKey] as T | undefined
      if (server != null) {
        setValueState(server)
        try { localStorage.setItem(storageKey, serializeLocal(server)) } catch {}
      } else if (prefs != null && local != null && serializeLocal(local) !== serializeLocal(defaultValue)) {
        putServer({ [prefKey]: local } as UserPreferences)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setValue = (v: T) => {
    setValueState(v)
    try { localStorage.setItem(storageKey, serializeLocal(v)) } catch {}
    window.dispatchEvent(new CustomEvent(eventName, { detail: v }))
    putServer({ [prefKey]: v } as UserPreferences)
  }

  // 같은 탭 다른 컴포넌트 변경 동기화 (기존 동작 유지)
  useEffect(() => {
    const handler = (e: Event) => setValueState((e as CustomEvent).detail as T)
    window.addEventListener(eventName, handler)
    return () => window.removeEventListener(eventName, handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [value, setValue]
}

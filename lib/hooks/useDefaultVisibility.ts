'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'don-doc:default-visibility'
export const DEFAULT_VISIBILITY: 'SHARED' | 'PRIVATE' = 'PRIVATE'

/**
 * 사용자가 새 거래(수동 입력·엑셀 업로드 등)를 만들 때 기본 가시성.
 *
 * 결정 ③ (decisions-20260523.md): 모든 자동 생성 default = PRIVATE 통일,
 * 단 사용자가 설정에서 SHARED로 바꿀 수 있게 localStorage로 보관.
 *
 * 서버 actions(addTradeRecord 등)는 항상 PRIVATE 하드코딩이지만, client UI
 * (transaction-drawer, excel-upload-drawer)는 이 hook의 값을 초기값으로 사용.
 */
export function useDefaultVisibility() {
  const [visibility, setVisibilityState] = useState<'SHARED' | 'PRIVATE'>(DEFAULT_VISIBILITY)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'SHARED' || stored === 'PRIVATE') {
      setVisibilityState(stored)
    }
  }, [])

  const setVisibility = (value: 'SHARED' | 'PRIVATE') => {
    setVisibilityState(value)
    localStorage.setItem(STORAGE_KEY, value)
    window.dispatchEvent(new CustomEvent('default-visibility-change', { detail: value }))
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const value = (e as CustomEvent).detail as 'SHARED' | 'PRIVATE'
      if (value === 'SHARED' || value === 'PRIVATE') setVisibilityState(value)
    }
    window.addEventListener('default-visibility-change', handler)
    return () => window.removeEventListener('default-visibility-change', handler)
  }, [])

  return { visibility, setVisibility }
}

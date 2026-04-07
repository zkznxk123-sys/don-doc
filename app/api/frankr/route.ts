export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import type { FrankrCalcType } from '@/lib/frankr/types'

const FRANKR_BASE_URL = 'https://calcapi.fran.kr/v1'
const FRANKR_CLIENT_ID = process.env.FRANKR_CLIENT_ID
const FRANKR_CLIENT_SECRET = process.env.FRANKR_CLIENT_SECRET

// 단순 인메모리 캐시 (서버 재시작 시 초기화)
// 동일 파라미터 조합은 1시간 캐싱 → 호출 한도(시간당 500회) 절약
const cache = new Map<string, { data: unknown; basis: string | null; expiresAt: number }>()

function getCacheKey(calcType: FrankrCalcType, params: unknown) {
  return `${calcType}:${JSON.stringify(params)}`
}

// calcType → Frankr API endpoint 매핑
// 문서 확인된 endpoint만 추가, 나머지는 추후 업데이트
const ENDPOINT_MAP: Partial<Record<FrankrCalcType, string>> = {
  property:    '/property',    // 보유세 (재산세 + 종부세) ✓ 문서 확인
  acquisition: '/acquisition', // 취득세 ✓ 문서 확인
  transfer:    '/transfer',    // 양도세 ✓ 문서 확인
  give:        '/give',        // 증여세 ✓ 문서 확인
  inherit:     '/inherit',     // 상속세 ✓ 문서 확인
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    if (!FRANKR_CLIENT_ID || !FRANKR_CLIENT_SECRET) {
      return NextResponse.json({ success: false, error: 'Frankr 인증 정보가 설정되지 않았습니다.' }, { status: 500 })
    }

    const { calcType, params } = await req.json() as { calcType: FrankrCalcType; params: unknown }

    const endpoint = ENDPOINT_MAP[calcType]
    if (!endpoint) {
      return NextResponse.json({ success: false, error: `지원하지 않는 계산 유형: ${calcType}` }, { status: 400 })
    }

    // 캐시 확인
    const cacheKey = getCacheKey(calcType, params)
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ success: true, data: cached.data, basis: cached.basis, cached: true })
    }

    // Frankr API 호출 — clientID/clientSecret을 헤더로 전달
    // property(보유세)는 중첩 배열이 있어 JSON, 나머지는 form-urlencoded 필요
    const useJson = calcType === 'property'
    const body = useJson
      ? JSON.stringify(params)
      : new URLSearchParams(params as Record<string, string>).toString()

    const res = await fetch(`${FRANKR_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': useJson ? 'application/json' : 'application/x-www-form-urlencoded',
        'clientID': FRANKR_CLIENT_ID,
        'clientSecret': FRANKR_CLIENT_SECRET,
      },
      body,
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Frankr API] Error:', res.status, errorText)
      return NextResponse.json(
        { success: false, error: `Frankr API 오류 (${res.status})` },
        { status: res.status }
      )
    }

    const frankrRes = await res.json()

    // Frankr가 HTTP 200이지만 success: false로 입력값 오류를 반환하는 경우
    if (frankrRes.success === false) {
      return NextResponse.json(
        { success: false, error: frankrRes.msg ?? 'Frankr API 오류' },
        { status: 400 }
      )
    }

    const rawData = frankrRes.data ?? frankrRes
    // Frankr 응답 구조에 따라 data가 배열 또는 배열을 감싼 객체일 수 있음
    // property(보유세)는 [[재산세rows], [종부세rows]] 형태의 중첩 배열로 반환될 수 있으므로 1단계 flatten
    const rawArr: unknown[] = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.data) ? rawData.data : [])
    const data: unknown[] = rawArr.flatMap(item => Array.isArray(item) ? item : [item])
    const basis = frankrRes.basis ?? null     // 비과세 사유 등 HTML 설명

    // 1시간 캐싱
    cache.set(cacheKey, { data, basis, expiresAt: Date.now() + 60 * 60 * 1000 })

    return NextResponse.json({ success: true, data, basis })
  } catch (e) {
    console.error('[POST /api/frankr] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}

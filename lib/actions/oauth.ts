'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isLite, LITE_BLOCKED_MESSAGE } from '@/lib/feature-flags'

const PROXY_URL = process.env.CLI_PROXY_URL ?? 'http://localhost:8317'
const MGMT_SECRET = process.env.CLI_PROXY_MGMT_SECRET ?? ''

export type OAuthProvider = 'claude' | 'chatgpt' | 'gemini'

const PROVIDER_CONFIG: Record<OAuthProvider, { authUrlPath: string; label: string }> = {
  claude:  { authUrlPath: '/v0/management/anthropic-auth-url', label: 'Claude' },
  chatgpt: { authUrlPath: '/v0/management/codex-auth-url',     label: 'ChatGPT' },
  gemini:  { authUrlPath: '/v0/management/gemini-auth-url',    label: 'Gemini' },
}

// CLIProxy의 provider 식별자 → 우리 식별자
const PROXY_PROVIDER_MAP: Record<string, OAuthProvider> = {
  claude: 'claude',
  codex: 'chatgpt',
  gemini: 'gemini',
  'gemini-cli': 'gemini',
}

interface CLIProxyAuthFile {
  id: string
  provider: string
  email: string
  status: string
  disabled: boolean
  unavailable: boolean
}

async function fetchAuthFiles(): Promise<CLIProxyAuthFile[]> {
  const res = await fetch(`${PROXY_URL}/v0/management/auth-files`, {
    headers: { 'X-Management-Key': MGMT_SECRET },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`auth-files ${res.status}`)
  const data = await res.json() as { files?: CLIProxyAuthFile[] }
  return data.files ?? []
}

/**
 * 1단계: CLIProxy에 auth URL 발급 요청 + state DB 저장
 */
export async function startOAuthFlow(
  provider: OAuthProvider,
): Promise<{ url?: string; state?: string; error?: string }> {
  if (isLite()) return { error: LITE_BLOCKED_MESSAGE }
  const user = await getAuthUser()
  if (!user) return { error: '인증이 필요합니다.' }
  if (!user.familyId) return { error: '가족 그룹이 없습니다.' }

  const config = PROVIDER_CONFIG[provider]
  if (!config) return { error: '지원하지 않는 provider입니다.' }

  let res: Response
  try {
    res = await fetch(`${PROXY_URL}${config.authUrlPath}?is_webui=1`, {
      headers: { 'X-Management-Key': MGMT_SECRET },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
  } catch (e) {
    console.error('[startOAuthFlow] fetch error:', e)
    return { error: 'AI 서버에 연결할 수 없습니다.' }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[startOAuthFlow] CLIProxy error:', res.status, text)
    return { error: 'auth URL 발급 실패' }
  }

  const data = await res.json() as { url?: string; state?: string; status?: string }
  if (data.status !== 'ok' || !data.url || !data.state) {
    return { error: 'auth URL 응답이 올바르지 않습니다.' }
  }

  await prisma.familyOAuthSession.create({
    data: {
      familyId: user.familyId,
      userId: user.id,
      provider,
      state: data.state,
      // CLIProxy 측 TTL이 10분이지만 약간 짧게 잡아 조기 만료 처리
      expiresAt: new Date(Date.now() + 9 * 60 * 1000),
    },
  })

  return { url: data.url, state: data.state }
}

/**
 * 2단계: 사용자가 paste한 callback URL을 CLIProxy로 forward
 * + 성공 시 FamilyOAuthAccount 생성/업데이트
 */
export async function completeOAuthFlow(
  provider: OAuthProvider,
  callbackUrl: string,
): Promise<{ success: boolean; email?: string; error?: string }> {
  if (isLite()) return { success: false, error: LITE_BLOCKED_MESSAGE }
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }
  if (!user.familyId) return { success: false, error: '가족 그룹이 없습니다.' }

  const trimmed = callbackUrl.trim()
  if (!trimmed) return { success: false, error: 'URL을 입력해주세요.' }

  let state: string | null = null
  let code: string | null = null
  try {
    const u = new URL(trimmed)
    state = u.searchParams.get('state')
    code = u.searchParams.get('code')
  } catch {
    return { success: false, error: 'URL 형식이 올바르지 않습니다.' }
  }
  if (!state) return { success: false, error: 'URL에 state가 없습니다.' }
  if (!code) return { success: false, error: 'URL에 code가 없습니다. 로그인이 정상 완료되지 않았을 수 있습니다.' }

  // state 검증 (이 가족에서 시작한 세션 맞는지)
  const session = await prisma.familyOAuthSession.findUnique({ where: { state } })
  if (!session) return { success: false, error: '세션을 찾을 수 없습니다. 다시 시도해주세요.' }
  if (session.familyId !== user.familyId) return { success: false, error: '권한이 없습니다.' }
  if (session.provider !== provider) return { success: false, error: 'provider가 일치하지 않습니다.' }
  if (session.expiresAt < new Date()) {
    await prisma.familyOAuthSession.delete({ where: { id: session.id } }).catch(() => {})
    return { success: false, error: '세션이 만료되었습니다. 다시 시도해주세요.' }
  }

  // CLIProxy에 callback URL 전달
  let cbRes: Response
  try {
    cbRes = await fetch(`${PROXY_URL}/v0/management/oauth-callback`, {
      method: 'POST',
      headers: {
        'X-Management-Key': MGMT_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider, redirect_url: trimmed }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    console.error('[completeOAuthFlow] fetch error:', e)
    return { success: false, error: 'AI 서버에 연결할 수 없습니다.' }
  }

  if (!cbRes.ok) {
    const text = await cbRes.text().catch(() => '')
    console.error('[completeOAuthFlow] callback error:', cbRes.status, text)
    return { success: false, error: '토큰 교환에 실패했습니다.' }
  }

  // CLIProxy는 비동기로 토큰 교환 + 파일 저장. 잠깐 기다린 뒤 auth-files 조회.
  // (server-side의 file watcher가 새 auth를 register해야 함)
  await new Promise(r => setTimeout(r, 2500))

  let files: CLIProxyAuthFile[]
  try {
    files = await fetchAuthFiles()
  } catch (e) {
    console.error('[completeOAuthFlow] auth-files fetch error:', e)
    return { success: false, error: '계정 파일 조회에 실패했습니다.' }
  }

  const matching = files.find(f =>
    PROXY_PROVIDER_MAP[f.provider] === provider &&
    f.status === 'active' &&
    !f.disabled &&
    !f.unavailable
  )
  if (!matching) {
    return { success: false, error: '연결된 계정을 찾을 수 없습니다. 잠시 후 다시 시도해주세요.' }
  }

  // 가족 OAuth account 등록/갱신
  await prisma.familyOAuthAccount.upsert({
    where: { familyId_provider: { familyId: user.familyId, provider } },
    create: {
      familyId: user.familyId,
      provider,
      authId: matching.id,
      email: matching.email,
      connectedByUserId: user.id,
      status: 'active',
    },
    update: {
      authId: matching.id,
      email: matching.email,
      connectedByUserId: user.id,
      status: 'active',
    },
  })

  await prisma.familyOAuthSession.delete({ where: { id: session.id } }).catch(() => {})

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/dashboard/settings')

  return { success: true, email: matching.email }
}

export interface OAuthAccountSummary {
  provider: OAuthProvider
  email: string
  connectedByUserId: string
  connectedAt: Date
  lastUsedAt: Date | null
}

export async function listOAuthAccounts(): Promise<{
  data?: OAuthAccountSummary[]
  error?: string
}> {
  if (isLite()) return { error: LITE_BLOCKED_MESSAGE }
  const user = await getAuthUser()
  if (!user?.familyId) return { error: '가족 그룹이 없습니다.' }

  const accounts = await prisma.familyOAuthAccount.findMany({
    where: { familyId: user.familyId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })

  return {
    data: accounts.map(a => ({
      provider: a.provider as OAuthProvider,
      email: a.email,
      connectedByUserId: a.connectedByUserId,
      connectedAt: a.createdAt,
      lastUsedAt: a.lastUsedAt,
    })),
  }
}

/**
 * 가족 OAuth 연결 해제. CLIProxy auth file과 DB row 모두 정리.
 */
export async function disconnectOAuthAccount(
  provider: OAuthProvider,
): Promise<{ success: boolean; error?: string }> {
  if (isLite()) return { success: false, error: LITE_BLOCKED_MESSAGE }
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: '권한이 없습니다.' }

  const account = await prisma.familyOAuthAccount.findUnique({
    where: { familyId_provider: { familyId: user.familyId, provider } },
  })
  if (!account) return { success: false, error: '연결된 계정이 없습니다.' }

  // CLIProxy 측 auth file 삭제 (실패해도 DB는 정리 — 수동 삭제 가능)
  try {
    await fetch(
      `${PROXY_URL}/v0/management/auth-files?name=${encodeURIComponent(account.authId)}`,
      {
        method: 'DELETE',
        headers: { 'X-Management-Key': MGMT_SECRET },
        signal: AbortSignal.timeout(8_000),
      },
    )
  } catch (e) {
    console.error('[disconnectOAuthAccount] CLIProxy delete error:', e)
  }

  await prisma.familyOAuthAccount.delete({ where: { id: account.id } })

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/dashboard/settings')
  return { success: true }
}

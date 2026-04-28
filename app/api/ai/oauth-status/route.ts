export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const PROXY_URL = process.env.CLI_PROXY_URL ?? 'http://localhost:8317'
const MGMT_SECRET = process.env.CLI_PROXY_MGMT_SECRET ?? ''

// CLIProxy provider 식별자 → 돈독 provider 식별자
const PROVIDER_MAP: Record<string, string> = {
  claude:     'claude',
  codex:      'chatgpt',
  gemini:     'gemini',
  'gemini-cli': 'gemini',
}

interface AuthFile {
  provider: string
  status: string
  unavailable: boolean
  disabled: boolean
}

/**
 * CLIProxy /v0/management/auth-files로 등록된 계정 목록 조회.
 * 운영자가 사전에 로그인해둔 'active' 상태 계정만 connected로 인정.
 *
 * 옵션 A 모델: 유저별 OAuth 없이 운영자 계정 공유.
 */
async function getConnectedProviders(): Promise<string[]> {
  try {
    const res = await fetch(`${PROXY_URL}/v0/management/auth-files`, {
      headers: { 'X-Management-Key': MGMT_SECRET },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return []
    const data = await res.json() as { files?: AuthFile[] }
    const files = data.files ?? []
    const connected = new Set<string>()
    for (const f of files) {
      if (f.disabled || f.unavailable || f.status !== 'active') continue
      const mapped = PROVIDER_MAP[f.provider]
      if (mapped) connected.add(mapped)
    }
    return Array.from(connected)
  } catch {
    return []
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider')

  const connectedProviders = await getConnectedProviders()

  if (provider) {
    return NextResponse.json({
      connected: connectedProviders.includes(provider),
      providers: connectedProviders,
    })
  }

  return NextResponse.json({
    connected: connectedProviders.length > 0,
    providers: connectedProviders,
  })
}

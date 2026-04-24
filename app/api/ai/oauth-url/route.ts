export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

const PROXY_URL = process.env.CLI_PROXY_URL ?? 'http://localhost:8317'
const MGMT_SECRET = process.env.CLI_PROXY_MGMT_SECRET ?? ''

const PROVIDER_ENDPOINT: Record<string, string> = {
  claude:  'anthropic-auth-url',
  chatgpt: 'codex-auth-url',
  gemini:  'gemini-cli-auth-url',
}

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user?.familyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider') ?? 'claude'
  const endpoint = PROVIDER_ENDPOINT[provider]
  if (!endpoint) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

  const res = await fetch(`${PROXY_URL}/v0/management/${endpoint}?is_webui=1`, {
    headers: { 'X-Management-Key': MGMT_SECRET },
  }).catch(() => null)

  if (!res?.ok) {
    return NextResponse.json({ error: 'CLIProxy 서버에 연결할 수 없습니다' }, { status: 503 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}

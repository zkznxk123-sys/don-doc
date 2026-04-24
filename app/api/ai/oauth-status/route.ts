export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const PROXY_URL = process.env.CLI_PROXY_URL ?? 'http://localhost:8317'
const MGMT_SECRET = process.env.CLI_PROXY_MGMT_SECRET ?? ''

// CLIProxy auth 파일명 prefix → provider
const PROVIDER_PREFIX: Record<string, string> = {
  claude:  'claude-',
  chatgpt: 'codex-',
  gemini:  'gemini-',
}

async function getConnectedProviders(): Promise<string[]> {
  try {
    const authDir = process.env.CLI_PROXY_AUTH_DIR
      ?? join(homedir(), '.cli-proxy-api')
    const files = await readdir(authDir)
    const connected: string[] = []
    for (const [provider, prefix] of Object.entries(PROVIDER_PREFIX)) {
      if (files.some(f => f.startsWith(prefix) && f.endsWith('.json'))) {
        connected.push(provider)
      }
    }
    return connected
  } catch {
    return []
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider')

  try {
    const res = await fetch(`${PROXY_URL}/v0/management/get-auth-status`, {
      headers: { 'X-Management-Key': MGMT_SECRET },
      signal: AbortSignal.timeout(3_000),
    })
    if (!res.ok) return NextResponse.json({ connected: false, providers: [] })

    const connectedProviders = await getConnectedProviders()

    if (provider) {
      return NextResponse.json({ connected: connectedProviders.includes(provider), providers: connectedProviders })
    }

    return NextResponse.json({ connected: connectedProviders.length > 0, providers: connectedProviders })
  } catch {
    return NextResponse.json({ connected: false, providers: [] })
  }
}

'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, X, ClipboardPaste, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { startOAuthFlow, completeOAuthFlow, type OAuthProvider } from '@/lib/actions/oauth'

interface Props {
  open: boolean
  provider: OAuthProvider | null
  providerLabel: string
  onClose: () => void
  onDone: () => void
}

type Step = 'intro' | 'awaiting_paste' | 'success'

export function OAuthConnectDialog({ open, provider, providerLabel, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('intro')
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [pastedUrl, setPastedUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open || !provider) return null

  const reset = () => {
    setStep('intro')
    setAuthUrl(null)
    setPastedUrl('')
    setConnectedEmail(null)
    setError(null)
    setLoading(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    const result = await startOAuthFlow(provider)
    setLoading(false)
    if (result.error || !result.url) {
      setError(result.error ?? '연결 시작에 실패했습니다.')
      return
    }
    setAuthUrl(result.url)
    setStep('awaiting_paste')
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  const handleComplete = async () => {
    if (!pastedUrl.trim()) {
      setError('URL을 붙여넣어 주세요.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await completeOAuthFlow(provider, pastedUrl)
    setLoading(false)
    if (!result.success) {
      setError(result.error ?? '연결에 실패했습니다.')
      return
    }
    setConnectedEmail(result.email ?? null)
    setStep('success')
    toast.success(`${providerLabel} 연결됨`)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 mx-4 mb-0 sm:mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">{providerLabel} 계정 연결</h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'intro' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              본인의 {providerLabel} 구독 계정을 연결합니다.
              아래 버튼을 누르면 새 탭에서 로그인 페이지가 열립니다.
            </p>
            <div className="rounded-xl bg-warning-soft border border-amber-500/20 p-3 text-xs text-amber-300/90 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                이 흐름은 좀 특이합니다
              </p>
              <p>
                로그인이 끝나면 브라우저가 <code className="text-xs px-1 rounded bg-warning-soft">localhost:54545</code>로 이동하면서
                <strong> &quot;사이트에 연결할 수 없음&quot;</strong> 오류 페이지를 띄웁니다 — 정상입니다.
                그 페이지의 <strong>주소창 URL을 복사</strong>해서 다음 단계에 붙여넣어 주세요.
              </p>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-foreground text-background font-medium text-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  로그인 시작
                </>
              )}
            </button>
          </div>
        )}

        {step === 'awaiting_paste' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">방금 열린 탭에서:</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>{providerLabel}에 로그인 + Authorize 승인</li>
                <li>&quot;사이트에 연결할 수 없음&quot; 페이지가 뜨면 <strong className="text-foreground">주소창 URL 전체를 복사</strong></li>
                <li>아래에 붙여넣고 확인</li>
              </ol>
            </div>
            {authUrl && (
              <button
                onClick={() => window.open(authUrl, '_blank', 'noopener,noreferrer')}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3 h-3" />
                로그인 페이지가 안 열렸나요? 다시 열기
              </button>
            )}
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5" />
                callback URL
              </label>
              <textarea
                value={pastedUrl}
                onChange={(e) => setPastedUrl(e.target.value)}
                placeholder="http://localhost:54545/callback?code=...&state=..."
                rows={3}
                className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-muted/50 border border-border focus:border-foreground/30 focus:outline-none resize-none"
              />
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('intro'); setError(null) }}
                disabled={loading}
                className="px-4 h-11 rounded-xl bg-muted text-foreground/70 font-medium text-sm disabled:opacity-50"
              >
                뒤로
              </button>
              <button
                onClick={handleComplete}
                disabled={loading || !pastedUrl.trim()}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-foreground text-background font-medium text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '확인'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-income-soft flex items-center justify-center">
                <Check className="w-6 h-6 text-income" />
              </div>
              <p className="text-sm font-semibold text-foreground">연결 완료</p>
              {connectedEmail && (
                <p className="text-xs text-muted-foreground">{connectedEmail}</p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="w-full h-11 rounded-xl bg-foreground text-background font-medium text-sm"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

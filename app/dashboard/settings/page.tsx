'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, AlertTriangle, ShieldAlert, ArrowLeft, Tag, ChevronRight, User, Pencil, Check, X, Zap } from 'lucide-react'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { updateUserName, getCurrentUser } from '@/lib/actions/user'
import { deleteZeroBalanceAccounts } from '@/lib/actions/accounts'
import { getAiMode, setAiMode } from '@/lib/actions/family'
import { useAssetThreshold } from '@/lib/hooks/useAssetThreshold'

export default function SettingsPage() {
  return <SettingsClient />
}

function SettingsClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeletingZero, setIsDeletingZero] = useState(false)
  const [aiMode, setAiModeState] = useState<'api' | 'claude' | 'chatgpt' | 'gemini'>('api')
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set())
  const [statusLoading, setStatusLoading] = useState(true)
  const [proxyOnline, setProxyOnline] = useState<boolean | null>(null)
  const { threshold, setThreshold } = useAssetThreshold()
  const [currentName, setCurrentName] = useState<string | null>(null)
  const [currentEmail, setCurrentEmail] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)

  useEffect(() => {
    getCurrentUser().then(u => {
      if (u) {
        setCurrentName(u.name)
        setCurrentEmail(u.email)
        setNameInput(u.name ?? '')
      }
    })
    getAiMode().then(async (mode) => {
      setAiModeState(mode)

      // CLIProxy 가용성 먼저 체크 (프로덕션/원격 배포에서는 대개 false)
      const online = await fetch('/api/ai/status')
        .then(r => r.json())
        .then(d => !!d.online)
        .catch(() => false)
      setProxyOnline(online)

      if (!online) {
        // 프록시 오프라인이면 provider 상태 조회 생략 (503 불필요한 네트워크 호출 방지)
        setStatusLoading(false)
        if (mode !== 'api') {
          await setAiMode('api')
          setAiModeState('api')
        }
        return
      }

      // 세 provider 연결 상태 모두 조회
      const results = await Promise.all(
        (['claude', 'chatgpt', 'gemini'] as const).map(p =>
          fetch(`/api/ai/oauth-status?provider=${p}`)
            .then(r => r.json())
            .catch(() => ({ connected: false }))
            .then(d => ({ p, connected: !!d.connected }))
        )
      )
      const connected = new Set(results.filter(r => r.connected).map(r => r.p))
      setConnectedProviders(connected)
      setStatusLoading(false)
      // 현재 활성 provider가 실제 연결 안 돼 있으면 api로 리셋
      if (mode !== 'api' && !connected.has(mode)) {
        await setAiMode('api')
        setAiModeState('api')
      }
    })
  }, [])

  const PROVIDER_CONFIG = [
    {
      id: 'claude' as const,
      label: 'Claude',
      sub: 'Anthropic Pro/Max · 최고 품질',
      letter: 'C',
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-400',
      activeBorder: 'border-orange-500/30',
      activeBg: 'bg-orange-500/5',
      activeText: 'text-orange-400',
      badgeBg: 'bg-orange-500/10 text-orange-400',
    },
    {
      id: 'chatgpt' as const,
      label: 'ChatGPT',
      sub: 'OpenAI Plus/Pro · GPT-4o',
      letter: 'G',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      activeBorder: 'border-emerald-500/30',
      activeBg: 'bg-emerald-500/5',
      activeText: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'gemini' as const,
      label: 'Gemini',
      sub: 'Google Advanced · 멀티모달',
      letter: 'Gm',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      activeBorder: 'border-blue-500/30',
      activeBg: 'bg-blue-500/5',
      activeText: 'text-blue-400',
      badgeBg: 'bg-blue-500/10 text-blue-400',
    },
  ] as const

  // 옵션 A (운영자 계정 공유): OAuth 없이 모드 전환만.
  // 운영자가 사전에 CLIProxy에 OAuth 등록한 provider만 connected로 표시됨.
  const handleConnectProvider = async (provider: 'claude' | 'chatgpt' | 'gemini') => {
    if (proxyOnline === false) {
      toast.error('AI 프록시 서버가 오프라인입니다.')
      return
    }
    if (!connectedProviders.has(provider)) {
      const cfg = PROVIDER_CONFIG.find(c => c.id === provider)!
      toast.error(`${cfg.label} 공유 계정이 아직 등록되지 않았습니다.`)
      return
    }
    await setAiMode(provider)
    setAiModeState(provider)
    const cfg = PROVIDER_CONFIG.find(c => c.id === provider)!
    toast.success(`${cfg.label} (가족 공유) 사용 시작`)
  }

  const handleSwitchToApi = async () => {
    await setAiMode('api')
    setAiModeState('api')
    toast.success('앱 기본 AI로 전환되었습니다.')
  }

  const handleSaveName = async () => {
    setIsSavingName(true)
    const result = await updateUserName(nameInput)
    setIsSavingName(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCurrentName(nameInput)
      setIsEditingName(false)
      toast.success('이름이 변경되었습니다.')
      router.refresh()
    }
  }

  const handleDeleteZero = async () => {
    setIsDeletingZero(true)
    const result = await deleteZeroBalanceAccounts()
    setIsDeletingZero(false)
    if (result.success) {
      toast.success(result.deleted > 0 ? `0원 계좌 ${result.deleted}개 삭제 완료` : '삭제할 0원 계좌가 없습니다')
    } else {
      toast.error(result.error ?? '삭제 실패')
    }
  }

  const handleReset = async () => {
    setIsLoading(true)
    try {
      // familyId를 서버에서 검증하므로 빈 문자열 전달 시 서버에서 auth 확인
      const res = await fetch('/api/family/reset', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('모든 거래 데이터가 초기화되었습니다.')
        router.refresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold">설정</h1>
      </div>

      {/* 프로필 */}
      <section className="rounded-2xl border border-border bg-card/30 p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground/70 mb-3">프로필</h2>
        <div className="flex items-center gap-3 p-3 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">표시 이름 <span className="text-amber-600 dark:text-amber-400 font-medium">· 이체 필터링에 사용됩니다</span></p>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false) }}
                  className="text-sm font-medium bg-transparent border-b border-foreground/30 focus:border-foreground outline-none w-40"
                  autoFocus
                  maxLength={20}
                />
                <button onClick={handleSaveName} disabled={isSavingName} className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsEditingName(false); setNameInput(currentName ?? '') }} className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{currentName || <span className="text-muted-foreground italic">이름 없음</span>}</p>
                <button onClick={() => { setIsEditingName(true); setNameInput(currentName ?? '') }} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground/60 mt-0.5">{currentEmail}</p>
          </div>
        </div>
      </section>

      {/* 자산 필터 기준 */}
      <section className="rounded-2xl border border-border bg-card/30 p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground/70 mb-3">자산 필터 기준</h2>
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-foreground mb-1">소액 자산 제외 기준</p>
          <p className="text-xs text-muted-foreground mb-4">
            이 금액 미만의 자산은 자산 배분·등록된 자산 목록에서 제외됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {[10000, 50000, 100000, 500000, 1000000].map(v => (
              <button
                key={v}
                onClick={() => setThreshold(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  threshold === v
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-ring'
                }`}
              >
                {(v / 10000).toLocaleString()}만원
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* AI 설정 */}
      <section className="rounded-2xl border border-border bg-card/30 p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground/70 mb-3">AI 설정</h2>

        {/* 앱 기본 AI */}
        <button
          onClick={aiMode === 'api' ? undefined : handleSwitchToApi}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all mb-2 ${
            aiMode === 'api'
              ? 'border-foreground/20 bg-muted/50'
              : 'border-border hover:bg-muted/30 cursor-pointer'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            aiMode === 'api' ? 'bg-foreground/10' : 'bg-muted'
          }`}>
            <Zap className={`w-4 h-4 ${aiMode === 'api' ? 'text-foreground' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground">앱 기본 AI</p>
            <p className="text-xs text-muted-foreground mt-0.5">GPT-4o-mini · 빠르고 안정적</p>
          </div>
          {aiMode === 'api' && (
            <span className="text-xs font-medium text-foreground/50 flex-shrink-0">사용 중</span>
          )}
        </button>

        {/* 구독 연동 providers */}
        {PROVIDER_CONFIG.map((cfg) => {
          const isActive = aiMode === cfg.id
          const isConnected = connectedProviders.has(cfg.id)
          const isProxyOffline = proxyOnline === false
          const isUnregistered = !isConnected && !isProxyOffline && !statusLoading
          const isDisabled = isProxyOffline || isUnregistered

          const tooltip = isProxyOffline
            ? 'AI 프록시 서버가 오프라인'
            : isUnregistered
              ? `${cfg.label} 공유 계정 미등록`
              : undefined

          return (
            <button
              key={cfg.id}
              onClick={isActive || isDisabled ? undefined : () => handleConnectProvider(cfg.id)}
              disabled={isDisabled}
              title={tooltip}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all mb-2 last:mb-0 ${
                isActive
                  ? `${cfg.activeBorder} ${cfg.activeBg}`
                  : isProxyOffline
                    ? 'border-border opacity-50 cursor-not-allowed'
                    : 'border-border hover:bg-muted/30 cursor-pointer disabled:opacity-40'
              }`}
            >
              {/* 프로바이더 아이콘 */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors font-bold text-sm ${
                isActive || isConnected ? cfg.iconBg : 'bg-muted'
              } ${isActive || isConnected ? cfg.iconColor : 'text-muted-foreground'}`}>
                {cfg.letter}
              </div>

              {/* 텍스트 */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                  {isConnected && !statusLoading && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.badgeBg}`}>가족 공유</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{cfg.sub}</p>
              </div>

              {/* 액션 */}
              {isActive ? (
                <span className={`text-xs font-semibold flex-shrink-0 ${cfg.activeText}`}>사용 중</span>
              ) : isProxyOffline ? (
                <span className="text-[10px] font-medium text-muted-foreground/60 flex-shrink-0 px-2 py-1 rounded-lg bg-muted/50 border border-border">오프라인</span>
              ) : isUnregistered ? (
                <span className="text-[10px] font-medium text-muted-foreground/60 flex-shrink-0 px-2 py-1 rounded-lg bg-muted/50 border border-border">준비 중</span>
              ) : (
                <span className="text-xs font-medium text-foreground/50 flex-shrink-0 px-2 py-1 rounded-lg bg-muted border border-border">전환</span>
              )}
            </button>
          )
        })}
      </section>

      {/* 카테고리 관리 */}
      <section className="rounded-2xl border border-border bg-card/30 p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground/70 mb-3">데이터 관리</h2>
        <Link
          href="/dashboard/settings/categories"
          className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/60 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Tag className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">카테고리 관리</p>
              <p className="text-xs text-muted-foreground mt-0.5">수입/지출 카테고리 및 자산 유형 표시 이름 설정</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        </Link>

        <div className="border-t border-border/50 mt-2 pt-2">
          <div className="flex items-center justify-between p-3 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">0원 계좌 일괄 삭제</p>
                <p className="text-xs text-muted-foreground mt-0.5">잔액이 0원인 자산 계좌를 한번에 삭제</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={isDeletingZero}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  삭제
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>0원 계좌 일괄 삭제</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-1.5">
                    <span className="block">잔액이 ₩0이고 <strong className="text-foreground">거래 내역이 없는</strong> 계좌를 모두 삭제합니다.</span>
                    <span className="block text-amber-400/80">거래 내역이 있는 계좌는 건너뜁니다. 삭제된 계좌는 복구할 수 없습니다.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteZero}
                    className="bg-red-600 hover:bg-red-500 text-white"
                  >
                    {isDeletingZero ? '삭제 중...' : '삭제'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/10 p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">모든 거래 데이터 초기화</p>
            <p className="text-xs text-muted-foreground mt-1">
              모든 지출/수입 내역과 예산을 삭제하고 계좌 잔액을 0으로 초기화합니다.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isLoading}
                className="flex-shrink-0 flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/40 hover:text-red-800 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                초기화
              </button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <AlertDialogTitle>정말 초기화하시겠습니까?</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="space-y-2">
                  <span className="block text-red-600 dark:text-red-400 font-medium text-sm">
                    이 작업은 되돌릴 수 없습니다. 모든 지출/수입 내역이 삭제됩니다.
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    • 가족 전체의 모든 거래 내역 삭제<br />
                    • 모든 예산 설정 삭제<br />
                    • 모든 계좌 잔액 0으로 초기화
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {isLoading ? '초기화 중...' : '초기화 실행'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  )
}

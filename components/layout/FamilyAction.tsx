'use client'

import { useState, useEffect } from 'react'
import { Users, Copy, Check, Loader2, UserPlus, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLatestInviteCode, getFamilyInfo, type FamilyMember } from '@/lib/actions/family'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'

interface FamilyActionProps {
  userRole: 'CFO' | 'MEMBER'
}

export function FamilyAction({ userRole }: FamilyActionProps) {
  const [open, setOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [familyName, setFamilyName] = useState('')

  // 다이얼로그 열릴 때 데이터 로드
  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      userRole === 'CFO' ? getLatestInviteCode() : Promise.resolve({ code: null }),
      getFamilyInfo(),
    ]).then(([codeResult, infoResult]) => {
      if (codeResult.code) setInviteCode(codeResult.code)
      if (infoResult.data) {
        setMembers(infoResult.data.members)
        setFamilyName(infoResult.data.name)
      }
    }).catch(() => {
      toast.error('정보를 불러오지 못했습니다.')
    }).finally(() => setLoading(false))
  }, [open, userRole])

  const handleCopy = async () => {
    if (!inviteCode) return
    const origin = window.location.origin
    const inviteUrl = `${origin}/invite/${inviteCode}`
    const message = `여보, 우리 집 자산 관리를 위해 초대해요! 🏠\n돈독 앱에서 함께 가족 자산을 관리해요.\n\n링크: ${inviteUrl}`
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = message
      textarea.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    toast.success('초대 링크가 복사되었습니다!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">가족 관리</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <Dialog.Title className="text-base font-bold text-white">가족 관리</Dialog.Title>
              {familyName && <p className="text-xs text-zinc-500 mt-0.5">{familyName}</p>}
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors text-lg leading-none">
                ✕
              </button>
            </Dialog.Close>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* ── 초대 코드 (CFO만) ── */}
              {userRole === 'CFO' && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">초대 코드</p>
                  {inviteCode ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center py-3 bg-black rounded-xl border border-zinc-800">
                        <span className="text-2xl font-mono font-bold tracking-[0.3em] text-white">
                          {inviteCode}
                        </span>
                      </div>
                      <button
                        onClick={handleCopy}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-medium transition-all',
                          copied
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600'
                        )}
                      >
                        {copied ? <><Check className="w-4 h-4" />복사됨!</> : <><Copy className="w-4 h-4" />초대 링크 복사</>}
                      </button>
                      <p className="text-[10px] text-zinc-600 text-center">7일간 유효합니다</p>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">코드를 불러오지 못했습니다.</p>
                  )}
                  <div className="my-4 border-t border-zinc-800" />
                </div>
              )}

              {/* ── 가족 구성원 목록 ── */}
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-3">구성원 {members.length}명</p>
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-zinc-300">
                          {(m.name ?? m.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{m.name ?? '이름 없음'}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{m.email}</p>
                      </div>
                      {m.role === 'CFO' && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-800/40">
                          <Crown className="w-2.5 h-2.5 text-amber-500" />
                          <span className="text-[10px] text-amber-500 font-medium">CFO</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-4">구성원 정보를 불러올 수 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Users, Copy, Check, Pencil, X, Crown, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FamilyMember { id: string; name: string | null; email: string; role: string }
interface FamilyInfo { id: string; name: string; members: FamilyMember[]; inviteCode: string | null }

export default function FamilyPage() {
  const [family, setFamily] = useState<FamilyInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<'CFO' | 'MEMBER'>('MEMBER')

  // 가족 이름 인라인 편집
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 초대 코드 복사
  const [copied, setCopied] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const meRes = await fetch('/api/auth/me')
      const me = await meRes.json()
      if (me?.user) {
        setCurrentUserId(me.user.id)
        setCurrentUserRole(me.user.role)
      }

      const familyRes = await fetch('/api/family/info')
      const data = await familyRes.json()
      if (!data.success) {
        toast.error(data.error ?? '데이터를 불러오지 못했습니다.')
      } else {
        setFamily(data.family)
        setInviteCode(data.family.inviteCode)
      }
      setIsLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const handleStartEdit = () => {
    if (!family) return
    setEditName(family.name)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName('')
  }

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === family?.name) {
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    const res = await fetch('/api/family/info', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    const data = await res.json()
    if (!data.success) {
      toast.error(data.error ?? '수정에 실패했습니다.')
    } else {
      setFamily((prev) => prev ? { ...prev, name: editName.trim() } : prev)
      toast.success('가족 이름이 업데이트되었습니다.')
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  const handleRefreshCode = async () => {
    setInviteLoading(true)
    const res = await fetch('/api/family/info')
    const data = await res.json()
    if (!data.success) {
      toast.error(data.error ?? '코드를 불러오지 못했습니다.')
    } else {
      setInviteCode(data.family.inviteCode)
    }
    setInviteLoading(false)
  }

  const handleCopy = async () => {
    let code = inviteCode
    if (!code) {
      setInviteLoading(true)
      const res = await fetch('/api/family/info')
      const data = await res.json()
      setInviteLoading(false)
      if (!data.success || !data.family?.inviteCode) { toast.error('초대 코드를 불러오지 못했습니다.'); return }
      code = data.family.inviteCode
      setInviteCode(code)
    }
    const origin = window.location.origin
    const inviteUrl = `${origin}/invite/${code}`
    const message = `여보, 우리 집 자산 관리를 위해 초대해요! 🏠\n돈독 앱에서 함께 가족 자산을 관리해요.\n\n링크: ${inviteUrl}`
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      const el = document.createElement('textarea')
      el.value = message
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    toast.success('초대 링크가 복사되었습니다. 배우자에게 전달해보세요!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!family) return null

  const cfo = family.members.find((m) => m.role === 'CFO')
  const members = family.members.filter((m) => m.role === 'MEMBER')

  return (
    <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">가족 관리</h1>

        {/* 가족 정보 카드 */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    ref={inputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    maxLength={30}
                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-zinc-500"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isSaving}
                    className="flex-shrink-0 px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '저장'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-shrink-0 p-1.5 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-base font-semibold text-white truncate">{family.name}</p>
                  {currentUserRole === 'CFO' && (
                    <button
                      onClick={handleStartEdit}
                      className="flex-shrink-0 p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="flex-shrink-0 text-xs text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700">
              {family.members.length}명
            </span>
          </div>

          {/* 초대 코드 섹션 */}
          <div className="bg-black rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-zinc-500">초대 코드</p>
              <button
                onClick={handleRefreshCode}
                disabled={inviteLoading}
                className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', inviteLoading && 'animate-spin')} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-2xl font-mono font-bold tracking-[0.3em] text-white">
                {inviteCode ?? '------'}
              </span>
              <button
                onClick={handleCopy}
                disabled={inviteLoading}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-medium transition-all flex-shrink-0',
                  copied
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600'
                )}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '복사됨' : '초대 링크 복사'}
              </button>
            </div>
            <p className="text-xs text-zinc-700 mt-3">링크를 받은 사람은 앱에서 가족에 바로 합류할 수 있어요</p>
          </div>
        </div>

        {/* 멤버 리스트 */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">구성원</h2>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {/* CFO */}
            {cfo && (
              <MemberRow
                member={cfo}
                isCurrentUser={cfo.id === currentUserId}
                role="CFO"
              />
            )}
            {/* 일반 멤버 */}
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isCurrentUser={m.id === currentUserId}
                role="MEMBER"
              />
            ))}
          </div>
      </div>
    </div>
  )
}

function MemberRow({
  member,
  isCurrentUser,
  role,
}: {
  member: FamilyInfo['members'][number]
  isCurrentUser: boolean
  role: 'CFO' | 'MEMBER'
}) {
  const initials = member.name
    ? member.name.slice(0, 2).toUpperCase()
    : member.email.slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {/* 아바타 */}
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold',
        role === 'CFO' ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-800 text-zinc-400'
      )}>
        {initials}
      </div>

      {/* 이름 + 이메일 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">
            {member.name ?? '이름 없음'}
          </p>
          {isCurrentUser && (
            <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full flex-shrink-0">나</span>
          )}
        </div>
        <p className="text-xs text-zinc-500 truncate mt-0.5">{member.email}</p>
      </div>

      {/* 역할 배지 */}
      {role === 'CFO' ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
          <Crown className="w-3 h-3 text-amber-400" />
          <span className="text-xs font-medium text-amber-400">총괄</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 flex-shrink-0">
          <Users className="w-3 h-3 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-400">구성원</span>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Users, Copy, Check, Pencil, X, Crown, Loader2, RefreshCw, ChevronDown, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { AppRole } from '@/lib/roles'
import { inviteMessage } from '@/lib/copy/invite'

interface FamilyMember { id: string; name: string | null; email: string; role: AppRole }
interface FamilyInfo { id: string; name: string; members: FamilyMember[]; inviteCode: string | null }

const ROLE_META: Record<AppRole, { label: string; badge: string; avatar: string; icon: React.ElementType }> = {
  CFO:    { label: '대표 CFO',  badge: 'bg-warning-soft border-warning/20 text-warning',  avatar: 'bg-warning-soft dark:bg-warning-soft text-warning',  icon: Crown },
  CO_CFO: { label: '공동 CFO', badge: 'bg-ai-500/10 border-ai-500/20 text-ai-400', avatar: 'bg-ai-100 dark:bg-ai-500/15 text-ai-600 dark:text-ai-400', icon: Shield },
  MEMBER: { label: '구성원',   badge: 'bg-muted border-border text-muted-foreground',           avatar: 'bg-muted text-muted-foreground',                                          icon: Users },
}

export default function FamilyPage() {
  const [family, setFamily] = useState<FamilyInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<AppRole>('MEMBER')

  // 가족 이름 인라인 편집
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 초대 코드 복사
  const [copied, setCopied] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  // 역할 변경 중인 멤버 id
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null)

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
        toast.error(data.error ?? '데이터를 불러오지 못했어요.')
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
      toast.error(data.error ?? '수정에 실패했어요.')
    } else {
      setFamily((prev) => prev ? { ...prev, name: editName.trim() } : prev)
      toast.success('가족 이름이 업데이트됐어요.')
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  const handleRefreshCode = async () => {
    setInviteLoading(true)
    const res = await fetch('/api/family/info')
    const data = await res.json()
    if (!data.success) {
      toast.error(data.error ?? '코드를 불러오지 못했어요.')
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
      if (!data.success || !data.family?.inviteCode) { toast.error('초대 코드를 불러오지 못했어요.'); return }
      code = data.family.inviteCode
      setInviteCode(code)
    }
    const origin = window.location.origin
    const inviteUrl = `${origin}/invite/${code}`
    const message = inviteMessage(inviteUrl)
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
    toast.success('초대 링크가 복사됐어요. 배우자에게 전달해보세요!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRoleChange = async (memberId: string, newRole: 'CO_CFO' | 'MEMBER') => {
    setChangingRoleFor(memberId)
    const res = await fetch('/api/family/member', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role: newRole }),
    })
    const data = await res.json()
    if (!data.success) {
      toast.error(data.error ?? '역할 변경에 실패했어요.')
    } else {
      setFamily(prev => prev
        ? { ...prev, members: prev.members.map(m => m.id === memberId ? { ...m, role: newRole } : m) }
        : prev
      )
      toast.success(newRole === 'CO_CFO' ? '공동 CFO로 변경됐어요.' : '구성원으로 변경됐어요.')
    }
    setChangingRoleFor(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!family) return null

  const isCFOLevel = currentUserRole === 'CFO' || currentUserRole === 'CO_CFO'
  const sortedMembers = [...family.members].sort((a, b) => {
    const order = { CFO: 0, CO_CFO: 1, MEMBER: 2 }
    return (order[a.role] ?? 9) - (order[b.role] ?? 9)
  })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">가족 관리</h1>

      {/* 가족 정보 카드 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-foreground" />
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
                  className="flex-1 min-w-0 bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-hidden focus:border-ring"
                />
                <button
                  onClick={handleSaveName}
                  disabled={isSaving}
                  className="shrink-0 px-3 py-1.5 bg-foreground text-background text-xs font-semibold rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '저장'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{family.name}</p>
                {isCFOLevel && (
                  <button
                    onClick={handleStartEdit}
                    className="shrink-0 p-1 text-muted-foreground/60 hover:text-foreground/70 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
            {family.members.length}명
          </span>
        </div>

        {/* 초대 코드 섹션 */}
        <div className="bg-background rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">초대 코드</p>
            <button
              onClick={handleRefreshCode}
              disabled={inviteLoading}
              className="p-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', inviteLoading && 'animate-spin')} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-2xl font-mono font-bold tracking-[0.3em] text-foreground">
              {inviteCode ?? '------'}
            </span>
            <button
              onClick={handleCopy}
              disabled={inviteLoading}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-medium transition-all shrink-0',
                copied
                  ? 'bg-income-soft border-(--viz-emerald)/30 text-income'
                  : 'bg-muted border-border text-foreground/70 hover:text-foreground hover:border-ring'
              )}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '복사됨' : '초대 링크 복사'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground/40 mt-3">링크를 받은 사람은 앱에서 가족에 바로 합류할 수 있어요</p>
        </div>
      </div>

      {/* 멤버 리스트 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between rounded-t-2xl">
          <h2 className="text-sm font-semibold text-foreground">구성원</h2>
          <p className="text-[11px] text-muted-foreground/60">CFO · 공동CFO는 모든 자산을 관리할 수 있어요</p>
        </div>

        <div className="divide-y divide-border/60">
          {sortedMembers.map((m, i) => (
            <MemberRow
              key={m.id}
              member={m}
              isCurrentUser={m.id === currentUserId}
              canManage={isCFOLevel && m.role !== 'CFO' && m.id !== currentUserId}
              isChanging={changingRoleFor === m.id}
              isLast={i === sortedMembers.length - 1}
              onRoleChange={handleRoleChange}
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
  canManage,
  isChanging,
  isLast,
  onRoleChange,
}: {
  member: FamilyInfo['members'][number]
  isCurrentUser: boolean
  canManage: boolean
  isLast: boolean
  isChanging: boolean
  onRoleChange: (memberId: string, role: 'CO_CFO' | 'MEMBER') => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const meta = ROLE_META[member.role] ?? ROLE_META.MEMBER
  const RoleIcon = meta.icon

  const initials = member.name
    ? member.name.slice(0, 2).toUpperCase()
    : member.email.slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {/* 아바타 */}
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold', meta.avatar)}>
        {initials}
      </div>

      {/* 이름 + 이메일 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {member.name ?? '이름 없음'}
          </p>
          {isCurrentUser && (
            <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full shrink-0">나</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{member.email}</p>
      </div>

      {/* 역할 배지 + 변경 드롭다운 */}
      <div className="relative shrink-0">
        {canManage ? (
          <button
            onClick={() => setDropdownOpen(v => !v)}
            disabled={isChanging}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
              meta.badge,
              'hover:opacity-80'
            )}
          >
            {isChanging
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RoleIcon className="w-3 h-3" />
            }
            {meta.label}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        ) : (
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium', meta.badge)}>
            <RoleIcon className="w-3 h-3" />
            {meta.label}
          </div>
        )}

        {/* 드롭다운 메뉴 */}
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className={`absolute right-0 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[140px] ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
              {(['CO_CFO', 'MEMBER'] as const).filter(r => r !== member.role).map(role => {
                const m = ROLE_META[role]
                const Icon = m.icon
                return (
                  <button
                    key={role}
                    onClick={() => { setDropdownOpen(false); onRoleChange(member.id, role) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-accent transition-colors text-left"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{role === 'CO_CFO' ? '공동 CFO로 변경' : '구성원으로 변경'}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

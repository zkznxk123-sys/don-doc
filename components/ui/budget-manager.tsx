'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Users, Check, Pencil } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface MemberBudget {
  id: string
  name: string
  role: string
  budget: number
  spent: number
}

interface BudgetManagerProps {
  month: string // "YYYY-MM"
}

export const BudgetManager = ({ month }: BudgetManagerProps) => {
  const [familyBudget, setFamilyBudget] = useState(0)
  const [familySpent, setFamilySpent] = useState(0)
  const [members, setMembers] = useState<MemberBudget[]>([])
  const [editingFamily, setEditingFamily] = useState(false)
  const [familyInput, setFamilyInput] = useState('')
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [memberInputs, setMemberInputs] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [month])

  const load = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/budget?month=${month}`)
      const data = await res.json()
      if (data.success) {
        setFamilyBudget(data.familyBudget)
        setFamilySpent(data.familySpent)
        setMembers(data.members)
      }
    } catch {
      console.error('예산 데이터 로드 실패')
    } finally {
      setIsLoading(false)
    }
  }

  const saveFamilyBudget = async () => {
    const amount = Number(familyInput.replace(/[^0-9]/g, ''))
    if (!amount || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, amount }),
      })
      if ((await res.json()).success) {
        setFamilyBudget(amount)
        setEditingFamily(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const saveMemberBudget = async (memberId: string) => {
    const amount = Number((memberInputs[memberId] || '').replace(/[^0-9]/g, ''))
    if (!amount || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, amount, targetUserId: memberId }),
      })
      if ((await res.json()).success) {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, budget: amount } : m))
        setEditingMember(null)
      }
    } finally {
      setSaving(false)
    }
  }

  const totalAllocated = members.reduce((sum, m) => sum + m.budget, 0)
  const spentPercent = familyBudget > 0 ? Math.min((familySpent / familyBudget) * 100, 100) : 0
  const allocatedPercent = familyBudget > 0 ? Math.min((totalAllocated / familyBudget) * 100, 100) : 0

  if (isLoading) {
    return (
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 animate-pulse">
        <div className="h-5 bg-zinc-800 rounded w-40 mb-6" />
        <div className="h-20 bg-zinc-800 rounded-xl mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-zinc-800 rounded-xl" />
          <div className="h-16 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5" />
          가족 예산 관리
        </h2>
        <span className="text-sm text-zinc-500">{month}</span>
      </div>

      {/* 가족 전체 예산 */}
      <div className="bg-zinc-800 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            우리 집 전체 예산
          </span>
          {editingFamily ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={familyInput}
                onChange={e => setFamilyInput(e.target.value)}
                className="w-32 h-7 bg-zinc-700 border border-zinc-600 rounded-lg px-2 text-xs text-white outline-none focus:border-zinc-400"
                placeholder="금액 입력"
                onKeyDown={e => {
                  if (e.key === 'Enter') saveFamilyBudget()
                  if (e.key === 'Escape') setEditingFamily(false)
                }}
              />
              <button onClick={saveFamilyBudget} disabled={saving} className="p-1 text-emerald-500 hover:text-emerald-400 disabled:opacity-50">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setFamilyInput(String(familyBudget || '')); setEditingFamily(true) }}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {familyBudget > 0 ? formatCurrency(familyBudget) : '예산 설정'}
            </button>
          )}
        </div>

        {familyBudget > 0 ? (
          <>
            {/* 실제 지출 */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>실제 지출</span>
                <span>{formatCurrency(familySpent)} / {formatCurrency(familyBudget)}</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full transition-all', spentPercent > 80 ? 'bg-red-500' : 'bg-emerald-500')}
                  style={{ width: `${spentPercent}%` }}
                />
              </div>
            </div>
            {/* 구성원 배분 현황 */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>구성원 배분</span>
                <span>{formatCurrency(totalAllocated)} ({Math.round(allocatedPercent)}%)</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${allocatedPercent}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              미배분: {formatCurrency(Math.max(familyBudget - totalAllocated, 0))}
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-600">이번 달 가족 전체 예산을 설정해 주세요.</p>
        )}
      </div>

      {/* 멤버별 예산 */}
      <div className="space-y-3">
        {members.map(member => {
          const isEditing = editingMember === member.id
          const usedPercent = member.budget > 0 ? Math.min((member.spent / member.budget) * 100, 100) : 0
          const remaining = Math.max(member.budget - member.spent, 0)

          return (
            <div key={member.id} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300">
                    {(member.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white">{member.name || '이름 없음'}</span>
                      {member.role === 'CFO' && (
                        <span className="text-xs text-amber-500 bg-amber-900/30 px-1.5 py-0.5 rounded">CFO</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">지출 {formatCurrency(member.spent)}</div>
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      value={memberInputs[member.id] || ''}
                      onChange={e => setMemberInputs(prev => ({ ...prev, [member.id]: e.target.value }))}
                      className="w-28 h-7 bg-zinc-700 border border-zinc-600 rounded-lg px-2 text-xs text-white outline-none focus:border-zinc-400"
                      placeholder="한도 입력"
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveMemberBudget(member.id)
                        if (e.key === 'Escape') setEditingMember(null)
                      }}
                    />
                    <button onClick={() => saveMemberBudget(member.id)} disabled={saving} className="p-1 text-emerald-500 hover:text-emerald-400 disabled:opacity-50">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setMemberInputs(prev => ({ ...prev, [member.id]: String(member.budget || '') }))
                      setEditingMember(member.id)
                    }}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    {member.budget > 0 ? formatCurrency(member.budget) : '한도 없음'}
                  </button>
                )}
              </div>

              {member.budget > 0 ? (
                <>
                  <div className="w-full bg-zinc-700 rounded-full h-2 mb-1.5">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        usedPercent > 80 ? 'bg-red-500' : usedPercent > 60 ? 'bg-amber-500' : 'bg-blue-500'
                      )}
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">{Math.round(usedPercent)}% 사용</span>
                    <span className={cn('font-medium', remaining === 0 ? 'text-red-400' : 'text-zinc-400')}>
                      {formatCurrency(remaining)} 남음
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-zinc-600">한도가 설정되지 않았습니다</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

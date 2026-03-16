'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Wallet, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, cn } from '@/lib/utils'

interface Member {
  id: string
  name: string
  role: 'CFO' | 'MEMBER'
  budget: number
  spent: number
}

interface BudgetPageData {
  familyBudget: number
  familySpent: number
  members: Member[]
}

// "YYYY-MM" 형식 헬퍼
function getMonthString(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 7)
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-')
  return `${y}년 ${parseInt(m)}월`
}

export default function BudgetPage() {
  const router = useRouter()
  const [monthOffset, setMonthOffset] = useState(0)
  const month = getMonthString(monthOffset)

  const [data, setData] = useState<BudgetPageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCFO, setIsCFO] = useState(false)

  // 편집 상태 — 화면에 보이는 입력값
  const [familyInput, setFamilyInput] = useState('')
  const [memberInputs, setMemberInputs] = useState<Record<string, string>>({})

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setSaveStatus('idle')
    try {
      const [meRes, budgetRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch(`/api/budget?month=${month}`),
      ])
      const meJson = await meRes.json()
      const budgetJson = await budgetRes.json()

      if (!meJson.success || !meJson.user?.familyId) {
        router.push('/login')
        return
      }

      setIsCFO(meJson.user.role === 'CFO')

      if (budgetJson.success) {
        const d: BudgetPageData = {
          familyBudget: budgetJson.familyBudget,
          familySpent: budgetJson.familySpent,
          members: budgetJson.members,
        }
        setData(d)
        // 입력 초기화
        setFamilyInput(d.familyBudget > 0 ? String(d.familyBudget) : '')
        const inputs: Record<string, string> = {}
        for (const m of d.members) {
          inputs[m.id] = m.budget > 0 ? String(m.budget) : ''
        }
        setMemberInputs(inputs)
      }
    } catch (e) {
      console.error('예산 페이지 로드 오류:', e)
    } finally {
      setIsLoading(false)
    }
  }, [month, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 실시간 계산값
  const parsedFamilyBudget = Number(familyInput.replace(/[^0-9]/g, '')) || 0
  const parsedMemberBudgets = Object.fromEntries(
    Object.entries(memberInputs).map(([id, v]) => [id, Number(v.replace(/[^0-9]/g, '')) || 0])
  )
  const totalAllocated = Object.values(parsedMemberBudgets).reduce((s, v) => s + v, 0)
  const unallocated = Math.max(parsedFamilyBudget - totalAllocated, 0)
  const overAllocated = totalAllocated > parsedFamilyBudget && parsedFamilyBudget > 0

  const handleSave = async () => {
    if (isSaving) return
    setSaveStatus('idle')
    setIsSaving(true)
    try {
      // 가족 전체 예산 저장
      if (parsedFamilyBudget > 0) {
        await fetch('/api/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, amount: parsedFamilyBudget }),
        })
      }

      // 구성원별 예산 저장
      const memberSaves = (data?.members ?? [])
        .map(m => ({ userId: m.id, amount: parsedMemberBudgets[m.id] ?? 0 }))
        .filter(m => m.amount > 0)
        .map(m =>
          fetch('/api/budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month, amount: m.amount, targetUserId: m.userId }),
          })
        )
      await Promise.all(memberSaves)

      setSaveStatus('success')
      await loadData()
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (e) {
      setSaveStatus('error')
      setSaveError(String(e))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="h-8 bg-zinc-800 rounded w-48 mb-8 animate-pulse" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-zinc-900 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto p-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">가족 예산 관리</h1>
            <p className="text-xs text-zinc-500">가족 구성원의 월 예산을 배분하세요</p>
          </div>
        </div>

        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-6">
          <button
            onClick={() => setMonthOffset(o => o - 1)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold text-white">{formatMonthLabel(month)}</span>
          <button
            onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
            disabled={monthOffset >= 0}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 전체 예산 카드 */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-white">우리 집 전체 예산</h2>
          </div>

          {isCFO ? (
            <input
              type="text"
              inputMode="numeric"
              value={familyInput}
              onChange={e => setFamilyInput(e.target.value)}
              placeholder="예: 3000000"
              className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-xl px-4 text-lg font-bold text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
            />
          ) : (
            <div className="h-12 flex items-center px-4 bg-zinc-800 rounded-xl text-lg font-bold text-white">
              {parsedFamilyBudget > 0 ? formatCurrency(parsedFamilyBudget) : '—'}
            </div>
          )}

          {parsedFamilyBudget > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-500 mb-2">
                <span>이번 달 실제 지출</span>
                <span className={cn(data && data.familySpent > parsedFamilyBudget ? 'text-red-400' : 'text-zinc-400')}>
                  {formatCurrency(data?.familySpent ?? 0)} / {formatCurrency(parsedFamilyBudget)}
                </span>
              </div>
              <Progress
                value={parsedFamilyBudget > 0 ? Math.min(((data?.familySpent ?? 0) / parsedFamilyBudget) * 100, 100) : 0}
                className={cn('[&>div]:transition-all', data && data.familySpent / parsedFamilyBudget > 0.8 ? '[&>div]:bg-red-500' : '[&>div]:bg-emerald-500')}
              />
            </div>
          )}
        </div>

        {/* 미배정 예산 요약 */}
        {parsedFamilyBudget > 0 && (
          <div className={cn(
            'rounded-2xl p-4 border mb-6 flex items-center justify-between',
            overAllocated
              ? 'bg-red-900/20 border-red-800'
              : 'bg-zinc-900 border-zinc-800'
          )}>
            <div className="flex items-center gap-2">
              {overAllocated
                ? <AlertCircle className="w-4 h-4 text-red-400" />
                : <CheckCircle2 className="w-4 h-4 text-zinc-500" />
              }
              <span className="text-sm text-zinc-400">
                {overAllocated ? '초과 배정' : '미배정 예산'}
              </span>
            </div>
            <div className="text-right">
              <span className={cn('text-lg font-bold', overAllocated ? 'text-red-400' : 'text-white')}>
                {overAllocated
                  ? `+${formatCurrency(totalAllocated - parsedFamilyBudget)}`
                  : formatCurrency(unallocated)
                }
              </span>
              {parsedFamilyBudget > 0 && (
                <div className="text-xs text-zinc-500">
                  총 {formatCurrency(totalAllocated)} 배정 ({Math.round((totalAllocated / parsedFamilyBudget) * 100)}%)
                </div>
              )}
            </div>
          </div>
        )}

        {/* 구성원별 예산 */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 mb-6 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-zinc-800">
            <Users className="w-4 h-4 text-zinc-400" />
            <h2 className="text-base font-semibold text-white">구성원별 예산 배분</h2>
          </div>

          <div className="divide-y divide-zinc-800">
            {(data?.members ?? []).map((member, idx) => {
              const memberBudget = parsedMemberBudgets[member.id] ?? 0
              const allocationPct = parsedFamilyBudget > 0
                ? Math.min((memberBudget / parsedFamilyBudget) * 100, 100)
                : 0
              const spentPct = memberBudget > 0
                ? Math.min((member.spent / memberBudget) * 100, 100)
                : 0

              const MEMBER_COLORS = [
                '[&>div]:bg-blue-500',
                '[&>div]:bg-violet-500',
                '[&>div]:bg-amber-500',
                '[&>div]:bg-pink-500',
                '[&>div]:bg-teal-500',
              ]
              const colorClass = MEMBER_COLORS[idx % MEMBER_COLORS.length]

              return (
                <div key={member.id} className="px-6 py-5">
                  {/* 이름 + 역할 + 입력 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300 flex-shrink-0">
                        {member.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{member.name}</span>
                          {member.role === 'CFO' && (
                            <span className="text-xs text-amber-500 bg-amber-900/30 px-1.5 py-0.5 rounded-md">CFO</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">
                          지출 {formatCurrency(member.spent)}
                          {memberBudget > 0 && (
                            <span className={cn('ml-1', member.spent > memberBudget ? 'text-red-400' : 'text-zinc-500')}>
                              {' '}/ {formatCurrency(memberBudget)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isCFO ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={memberInputs[member.id] ?? ''}
                        onChange={e => setMemberInputs(prev => ({ ...prev, [member.id]: e.target.value }))}
                        placeholder="한도 미설정"
                        className="w-32 h-9 bg-zinc-800 border border-zinc-700 rounded-xl px-3 text-sm font-semibold text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors text-right"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-white">
                        {memberBudget > 0 ? formatCurrency(memberBudget) : '—'}
                      </span>
                    )}
                  </div>

                  {/* 배분율 바 (전체 예산 기준) */}
                  {parsedFamilyBudget > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-zinc-600 mb-1">
                        <span>전체 예산 중 배분율</span>
                        <span>{Math.round(allocationPct)}%</span>
                      </div>
                      <Progress value={allocationPct} className={colorClass} />
                    </div>
                  )}

                  {/* 지출 현황 바 (개인 예산 기준) */}
                  {memberBudget > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-zinc-600 mb-1">
                        <span>개인 예산 소진율</span>
                        <span className={cn(spentPct > 80 ? 'text-red-400' : '')}>{Math.round(spentPct)}%</span>
                      </div>
                      <Progress
                        value={spentPct}
                        className={cn(spentPct > 80 ? '[&>div]:bg-red-500' : spentPct > 60 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500')}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 전체 배분 시각화 */}
        {parsedFamilyBudget > 0 && (data?.members ?? []).some(m => (parsedMemberBudgets[m.id] ?? 0) > 0) && (
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
            <h3 className="text-sm font-semibold text-zinc-400 mb-4">예산 배분 현황</h3>

            {/* 스택 바 */}
            <div className="flex rounded-full overflow-hidden h-4 mb-4 bg-zinc-800">
              {(data?.members ?? []).map((member, idx) => {
                const memberBudget = parsedMemberBudgets[member.id] ?? 0
                const pct = parsedFamilyBudget > 0 ? (memberBudget / parsedFamilyBudget) * 100 : 0
                if (pct <= 0) return null
                const BG = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500']
                return (
                  <div
                    key={member.id}
                    className={cn('h-full transition-all', BG[idx % BG.length])}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                    title={`${member.name}: ${formatCurrency(memberBudget)}`}
                  />
                )
              })}
              {/* 미배정 영역 */}
              {unallocated > 0 && !overAllocated && (
                <div
                  className="h-full bg-zinc-700"
                  style={{ width: `${(unallocated / parsedFamilyBudget) * 100}%` }}
                />
              )}
            </div>

            {/* 범례 */}
            <div className="grid grid-cols-2 gap-2">
              {(data?.members ?? []).map((member, idx) => {
                const memberBudget = parsedMemberBudgets[member.id] ?? 0
                if (memberBudget <= 0) return null
                const BG = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500']
                const pct = parsedFamilyBudget > 0 ? Math.round((memberBudget / parsedFamilyBudget) * 100) : 0
                return (
                  <div key={member.id} className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-sm flex-shrink-0', BG[idx % BG.length])} />
                    <span className="text-xs text-zinc-400 truncate">{member.name}</span>
                    <span className="text-xs text-zinc-500 ml-auto">{pct}%</span>
                  </div>
                )
              })}
              {unallocated > 0 && !overAllocated && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-zinc-700 flex-shrink-0" />
                  <span className="text-xs text-zinc-500">미배정</span>
                  <span className="text-xs text-zinc-600 ml-auto">
                    {Math.round((unallocated / parsedFamilyBudget) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 저장 상태 메시지 */}
        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-4 px-1">
            <CheckCircle2 className="w-4 h-4" />
            저장되었습니다.
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-4 px-1">
            <AlertCircle className="w-4 h-4" />
            {saveError}
          </div>
        )}

        {/* 저장 버튼 (CFO만) */}
        {isCFO && (
          <button
            onClick={handleSave}
            disabled={isSaving || parsedFamilyBudget <= 0}
            className="w-full h-14 bg-white text-black rounded-2xl text-base font-bold hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? '저장 중...' : '예산 저장'}
          </button>
        )}
      </div>
    </div>
  )
}

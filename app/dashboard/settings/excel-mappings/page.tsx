'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trash2, Loader2, FileSpreadsheet, Plus } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  listExcelMappings,
  deleteExcelMapping,
  upsertExcelMapping,
  listFamilyAccountsForMapping,
  type ExcelMappingData,
  type AccountSummary,
} from '@/lib/actions/excel-mapping'
import type { ExcelMappingType } from '@prisma/client'

const TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  ACCOUNT:      { label: '계좌 매칭',     tone: 'text-foreground bg-muted' },
  CASH_SUB:     { label: '예수금 (부모)', tone: 'text-savings bg-savings-soft' },
  HOLDING_SKIP: { label: '종목 (skip)',   tone: 'text-warning bg-warning-soft' },
  NEW_ACCOUNT:  { label: '신규 계좌',     tone: 'text-income bg-income-soft' },
  IGNORE:       { label: '영구 제외',     tone: 'text-muted-foreground bg-muted/60' },
}

const TYPE_DESC: Record<string, string> = {
  ACCOUNT:      '엑셀 잔액을 해당 계좌에 동기화',
  CASH_SUB:     '엑셀 잔액을 부모 계좌의 자식 "예수금"에 동기화',
  HOLDING_SKIP: '엑셀 row가 부모 계좌의 holding으로 등록됨 — 동기화 skip',
  NEW_ACCOUNT:  '다음 업로드 시 신규 계좌 생성',
  IGNORE:       '동기화 영구 제외 (예: dondoc에 등록 안 하는 카드)',
}

const TYPES_REQUIRING_ACCOUNT: ExcelMappingType[] = ['ACCOUNT', 'CASH_SUB', 'HOLDING_SKIP']

export default function ExcelMappingsPage() {
  const [mappings, setMappings] = useState<ExcelMappingData[]>([])
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 신규 매핑 폼 state
  const [formOpen, setFormOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<ExcelMappingType>('ACCOUNT')
  const [formAccountId, setFormAccountId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const needsAccount = TYPES_REQUIRING_ACCOUNT.includes(formType)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, accs] = await Promise.all([
        listExcelMappings(),
        listFamilyAccountsForMapping(),
      ])
      setMappings(rows)
      setAccounts(accs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setFormName('')
    setFormType('ACCOUNT')
    setFormAccountId('')
    setFormOpen(false)
  }

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('엑셀 표기명을 입력하세요')
      return
    }
    if (needsAccount && !formAccountId) {
      toast.error('대상 계좌를 선택하세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await upsertExcelMapping({
        excelName: formName.trim(),
        mappingType: formType,
        targetAccountId: needsAccount ? formAccountId : null,
      })
      if (res.success) {
        toast.success('매핑이 저장됐어요')
        setMappings(prev => {
          const filtered = prev.filter(m => m.id !== res.data.id)
          return [res.data, ...filtered]
        })
        resetForm()
      } else {
        toast.error(res.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await deleteExcelMapping(id)
      if (res.success) {
        setMappings(prev => prev.filter(m => m.id !== id))
        toast.success('매핑이 삭제됐어요')
      } else {
        toast.error(res.error ?? '삭제 실패')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        설정으로 돌아가기
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-lg font-bold text-foreground">엑셀 매핑 관리</h1>
      </div>
      <p className="text-xs text-muted-foreground mb-6">
        뱅크샐러드 엑셀에서 발견된 표기명을 돈독 계좌에 어떻게 매핑할지 한 번 확정한 결과입니다.
        다음 업로드부터 자동 적용되며, 잘못 매핑된 항목은 여기서 삭제할 수 있습니다.
      </p>

      {/* 신규 매핑 폼 */}
      {!formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          매핑 직접 추가
        </button>
      ) : (
        <div className="mb-4 bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">매핑 추가</h2>
            <button
              onClick={resetForm}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              취소
            </button>
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground mb-1 block">엑셀 표기명</span>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="예: 종합매매, RISE 단기특수은행채액티브"
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground mb-1 block">매핑 타입</span>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as ExcelMappingType)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {(Object.keys(TYPE_LABEL) as ExcelMappingType[]).map(t => (
                  <option key={t} value={t}>{TYPE_LABEL[t].label}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground/70 mt-1">{TYPE_DESC[formType]}</p>
            </label>

            {needsAccount && (
              <label className="block">
                <span className="text-[11px] font-medium text-muted-foreground mb-1 block">대상 계좌</span>
                <select
                  value={formAccountId}
                  onChange={e => setFormAccountId(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="">— 선택 —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !formName.trim() || (needsAccount && !formAccountId)}
            className="w-full px-3 py-2 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
          >
            {submitting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />저장 중</>
              : <><Plus className="w-3.5 h-3.5" />매핑 저장</>}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">매핑 불러오는 중...</p>
        </div>
      ) : mappings.length === 0 ? (
        <div className="bg-muted/30 border border-dashed border-border rounded-2xl py-10 text-center">
          <FileSpreadsheet className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/50">저장된 매핑이 없습니다</p>
          <p className="text-xs text-muted-foreground/40 mt-1">엑셀을 업로드하면 자동으로 매핑이 기억됩니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map(m => {
            const tone = TYPE_LABEL[m.mappingType]?.tone ?? 'text-muted-foreground bg-muted'
            const label = TYPE_LABEL[m.mappingType]?.label ?? m.mappingType
            const desc = TYPE_DESC[m.mappingType]
            return (
              <div
                key={m.id}
                className="bg-card border border-border rounded-2xl px-4 py-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {m.excelName}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tone}`}>
                      {label}
                    </span>
                  </div>
                  {m.targetAccountName && (
                    <p className="text-xs text-muted-foreground mb-1">
                      → {m.targetAccountName}
                      {m.targetAccountType && (
                        <span className="text-muted-foreground/50 ml-1">· {m.targetAccountType}</span>
                      )}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60">{desc}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={deletingId === m.id}
                      className="shrink-0 p-1.5 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                    >
                      {deletingId === m.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>매핑 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        <span className="block">
                          <strong className="text-foreground">{m.excelName}</strong> 매핑을 삭제합니다.
                        </span>
                        <span className="block text-muted-foreground/80 mt-1">
                          다음 업로드 시 자동 매칭으로 다시 결정해야 합니다.
                        </span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(m.id)}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

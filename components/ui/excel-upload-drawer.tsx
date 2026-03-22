'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  Upload, X, FileSpreadsheet, Loader2, AlertCircle,
  CheckCircle2, Sparkles, SkipForward, Globe, Lock, Wand2, Link2,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createManyTransactions, type BulkTransactionRow } from '@/lib/actions/transaction'
import { getFamilyCategories, type CategoryOption } from '@/lib/actions/categories'
import {
  type ColMap, type ExcelPreset,
  detectPreset, buildColMap,
} from '@/constants/excel-presets'
import {
  tryParseBanksalad, type BanksaladRow, type AccountBalance,
} from '@/utils/excel-parser'
import type { MappingResult } from '@/app/api/ai/map-categories/route'
import { InputGuide } from '@/components/dashboard/InputGuide'

// ━━ 내부 타입 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ParsedRow extends BulkTransactionRow {
  _error?: string
  _banksaladCategory?: string
  _paymentMethod?: string
  _time?: string
  // AI 매핑 결과
  categoryId?: string
  categoryName?: string
  categoryIcon?: string
}

type AiStatus = 'idle' | 'loading' | 'done' | 'error' | 'skipped'

// ━━ 범용 파서 유틸 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseDate(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  const m1 = s.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`
  const m2 = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  return s
}

function parseNum(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return NaN
  if (typeof raw === 'number') return raw
  return parseFloat(String(raw).replace(/[,\s원+]/g, ''))
}

function mapRow(raw: Record<string, unknown>, col: ColMap): ParsedRow {
  const date = parseDate(col.date ? raw[col.date] : undefined)
  const description = col.description ? String(raw[col.description] ?? '').trim() : ''
  let amount = NaN
  if (col.amount) {
    amount = parseNum(raw[col.amount])
  } else if (col.withdraw || col.deposit) {
    const dep = col.deposit ? parseNum(raw[col.deposit]) : NaN
    const wit = col.withdraw ? parseNum(raw[col.withdraw]) : NaN
    if (!isNaN(dep) && dep > 0) amount = dep
    else if (!isNaN(wit) && wit > 0) amount = -wit
    else amount = 0
  }
  const category = col.category
    ? String(raw[col.category] ?? '').trim() || (amount >= 0 ? '수입' : '기타')
    : amount >= 0 ? '수입' : '기타'
  let _error: string | undefined
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) _error = '날짜 오류'
  else if (isNaN(amount)) _error = '금액 오류'
  return { date, description, amount: isNaN(amount) ? 0 : amount, category, visibility: 'SHARED', _error }
}

// ━━ 메인 컴포넌트 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ExcelUploadDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userId: string
  familyId: string
}

const PREVIEW_LIMIT = 50

export function ExcelUploadDrawer({ isOpen, onClose, onSuccess, userId, familyId }: ExcelUploadDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  // 파싱 결과
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([])
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [detectedPreset, setDetectedPreset] = useState<ExcelPreset | null>(null)
  const [colMap, setColMap] = useState<ColMap | null>(null)
  const [isBanksalad, setIsBanksalad] = useState(false)
  const [banksaladMeta, setBanksaladMeta] = useState<{ skipped: number; sheet: string } | null>(null)

  // AI 매핑
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle')
  const [aiMappedCount, setAiMappedCount] = useState(0)
  const [categories, setCategories] = useState<CategoryOption[]>([])

  // 뱅샐현황 계좌 잔액 목록
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])

  // 설정
  const [visibility, setVisibility] = useState<'SHARED' | 'PRIVATE'>('SHARED')
  const [isLoading, setIsLoading] = useState(false)

  // 가족 구성원 이름 (이체 필터링용)
  const [familyMemberNames, setFamilyMemberNames] = useState<string[]>([])

  // ── 카테고리 + 가족 정보 로드 ──
  useEffect(() => {
    if (!isOpen) return
    getFamilyCategories().then(setCategories).catch(() => {})
    fetch('/api/family/info')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.family?.members) {
          setFamilyMemberNames(
            (d.family.members as { name?: string; email?: string }[])
              .map(m => m.name || m.email || '')
              .filter(Boolean)
          )
        }
      })
      .catch(() => {})
  }, [isOpen])

  // ── AI 카테고리 매핑 ──
  const runAiMapping = useCallback(async (parsedRows: ParsedRow[]) => {
    setAiStatus('loading')
    try {
      // 고유한 (description, banksaladCategory) 쌍만 추출 — 토큰 절약
      const seen = new Set<string>()
      const uniqueItems: { description: string; banksaladCategory: string }[] = []
      for (const row of parsedRows) {
        if (!row.description || row._error) continue
        const key = `${row.description}||${row._banksaladCategory ?? ''}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueItems.push({
            description: row.description,
            banksaladCategory: row._banksaladCategory ?? '',
          })
        }
      }

      if (uniqueItems.length === 0) { setAiStatus('skipped'); return }

      const res = await fetch('/api/ai/map-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: uniqueItems }),
      })
      const data = await res.json()

      if (data.error && data.mappings.length === 0) {
        setAiStatus('error')
        return
      }

      // description → category 매핑 맵 구성
      const mappingMap = new Map<string, MappingResult>(
        (data.mappings as MappingResult[]).map(m => [m.description, m])
      )

      // 원본 rows에 categoryId / categoryName / categoryIcon 병합
      setRows(prev => prev.map(row => {
        const m = mappingMap.get(row.description)
        if (!m) return row
        return { ...row, categoryId: m.categoryId, categoryName: m.categoryName, categoryIcon: m.categoryIcon }
      }))

      setAiMappedCount(data.mappings.length)
      setAiStatus('done')
    } catch {
      setAiStatus('error')
    }
  }, [])

  // ── 파일 파싱 ──
  const processFile = useCallback((file: File) => {
    setFileName(file.name)
    setAiStatus('idle')
    setAiMappedCount(0)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: false })

        // 뱅크샐러드 전용 파서 우선 시도
        const banksaladResult = tryParseBanksalad(wb, familyMemberNames)
        if (banksaladResult) {
          const parsed: ParsedRow[] = banksaladResult.rows.map((r: BanksaladRow) => ({
            date: r.date, description: r.description, amount: r.amount,
            category: r.category, visibility: 'SHARED',
            accountName: r.paymentMethod || '기본 계좌',
            _banksaladCategory: r.banksaladCategory,
            _paymentMethod: r.paymentMethod,
            _time: r.time,
          }))
          setIsBanksalad(true)
          setBanksaladMeta({ skipped: banksaladResult.skippedCount, sheet: banksaladResult.sheetName })
          setAccountBalances(banksaladResult.accountBalances)
          setRows(parsed)
          setRawHeaders([]); setColMap(null); setRawData([])

          toast.success('뱅크샐러드 양식이 감지되었습니다.', {
            description: `${banksaladResult.rows.length}건 파싱 · 이체 ${banksaladResult.skippedCount}건 제외 · AI 분류 시작...`,
          })
          runAiMapping(parsed)
          return
        }

        // 범용 파서 폴백
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })
        if (json.length === 0) { toast.error('데이터가 없습니다.'); return }

        const headers = Object.keys(json[0])
        const preset = detectPreset(headers)
        const col = buildColMap(headers, preset)
        const parsed = json.map(r => mapRow(r, col))

        setIsBanksalad(false); setBanksaladMeta(null)
        setRawHeaders(headers); setRawData(json)
        setDetectedPreset(preset); setColMap(col)
        setRows(parsed)
        runAiMapping(parsed)
      } catch {
        toast.error('파일을 읽는 중 오류가 발생했습니다.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [runAiMapping, familyMemberNames])

  const handleColChange = useCallback((field: keyof ColMap, header: string) => {
    setColMap(prev => {
      if (!prev) return prev
      const next = { ...prev, [field]: header || null }
      if (field === 'amount' && header) { next.withdraw = null; next.deposit = null }
      else if ((field === 'withdraw' || field === 'deposit') && header) next.amount = null
      const newRows = rawData.map(r => mapRow(r, next))
      setRows(newRows)
      return next
    })
  }, [rawData])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleReset = () => {
    setFileName(null); setDetectedPreset(null); setIsBanksalad(false)
    setBanksaladMeta(null); setColMap(null); setRawData([])
    setRows([]); setRawHeaders([]); setAiStatus('idle'); setAiMappedCount(0)
    setAccountBalances([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => { handleReset(); onClose() }

  const validRows = rows.filter(r => !r._error)
  const errorRows = rows.filter(r => r._error)

  const handleSubmit = async () => {
    if (validRows.length === 0) { toast.error('등록 가능한 내역이 없습니다.'); return }
    setIsLoading(true)
    try {
      const submitRows: BulkTransactionRow[] = validRows.map(r => ({
        amount: r.amount,
        date: r.date,
        description: r.description,
        category: r.categoryName ?? r.category,
        categoryId: r.categoryId,
        visibility,
        accountName: r.accountName || r._paymentMethod || '기본 계좌',
      }))
      const result = await createManyTransactions(
        userId,
        familyId,
        submitRows,
        accountBalances.length > 0 ? { accountBalances } : undefined
      )
      if (result.success) {
        const total = validRows.length
        const saved = result.count ?? 0
        const skipped = result.skippedCount ?? 0
        const syncPart = result.syncedAccountCount
          ? `${result.syncedAccountCount}개 계좌 잔액 동기화`
          : null

        // 중복 스킵 메시지 구성
        const dupDesc = skipped > 0
          ? `총 ${total}건 중 ${skipped}건은 이미 존재하여 무시됨`
          : null

        if (saved === 0) {
          toast.info('모든 내역이 이미 등록되어 있습니다.', {
            description: dupDesc ?? undefined,
          })
        } else {
          const stats = result.monthStats ?? []
          let title = ''
          if (syncPart) title += `${syncPart}, `
          title += `${saved}건 등록 완료`

          let description = dupDesc ?? ''
          if (stats.length === 1) {
            const s = stats[0]
            const statStr = `수입 ${new Intl.NumberFormat('ko-KR').format(s.income)}원 · 지출 ${new Intl.NumberFormat('ko-KR').format(s.expense)}원`
            description = dupDesc ? `${dupDesc} · ${statStr}` : statStr
          } else if (stats.length > 1) {
            const range = `${stats[0].month} ~ ${stats[stats.length - 1].month}`
            description = dupDesc ? `${dupDesc} · ${range}` : range
          }

          toast.success(title, { description: description || undefined })
        }
        handleClose(); onSuccess()
      } else {
        toast.error(result.error ?? '등록에 실패했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const hasFile = rows.length > 0
  const headerOptions = ['', ...rawHeaders]

  return (
    <Drawer open={isOpen} onOpenChange={v => { if (!v) handleClose() }}>
      <DrawerContent className="bg-background border-t border-border max-h-[92vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-foreground text-lg font-bold">엑셀 일괄 등록</DrawerTitle>
            <DrawerClose asChild>
              <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </DrawerClose>
          </div>
          <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv 파일을 지원합니다</p>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">

          {/* ── 업로드 존 ── */}
          {!hasFile ? (
            <>
            <InputGuide />
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 py-14 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                isDragging ? 'border-foreground/40 bg-muted/50' : 'border-border hover:border-ring hover:bg-card/50'
              )}
            >
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">파일을 드래그하거나 탭해서 선택</p>
                <p className="text-xs text-muted-foreground mt-1">뱅크샐러드 · 신한 · KB · 카카오페이 · 하나 · 우리</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
            </div>
            </>
          ) : (
            <>
              {/* ── 파일 정보 ── */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className={cn("w-4 h-4", isBanksalad ? "text-violet-400" : "text-emerald-400")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    총 {rows.length}행
                    {errorRows.length > 0 && <span className="text-amber-400 ml-1">· {errorRows.length}행 오류</span>}
                    {banksaladMeta?.skipped ? <span className="text-muted-foreground/60 ml-1">· 이체 {banksaladMeta.skipped}건 제외</span> : null}
                  </p>
                </div>
                <button onClick={handleReset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── 양식 감지 배지 ── */}
              {isBanksalad ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-300 dark:border-violet-700/40">
                  <Sparkles className="w-4 h-4 text-violet-500 dark:text-violet-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">뱅크샐러드 양식이 감지되었습니다</p>
                    <p className="text-[11px] text-violet-500 dark:text-violet-700 mt-0.5">
                      시트: {banksaladMeta?.sheet} · 날짜·시간·대분류·소분류 자동 매핑
                    </p>
                    {banksaladMeta?.skipped ? (
                      <div className="flex items-center gap-1 mt-1">
                        <SkipForward className="w-3 h-3 text-muted-foreground" />
                        <p className="text-[11px] text-muted-foreground">"이체" {banksaladMeta.skipped}건 자동 제외</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : detectedPreset ? (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{detectedPreset.name} 양식 감지됨</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-700 mt-0.5">{detectedPreset.description}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border">
                  <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">양식 자동 감지 실패 — 아래 헤더 셀렉트에서 직접 지정해주세요</p>
                </div>
              )}

              {/* ── AI 매핑 상태 ── */}
              <AiMappingStatus status={aiStatus} mappedCount={aiMappedCount} totalUnique={rows.filter(r => !r._error && r.description).length} onRetry={() => runAiMapping(rows)} />

              {/* ── 공개 범위 (전체 적용) ── */}
              <div
                onClick={() => setVisibility(v => v === 'SHARED' ? 'PRIVATE' : 'SHARED')}
                className={cn(
                  'flex items-center justify-between rounded-xl p-3.5 border cursor-pointer transition-colors select-none',
                  visibility === 'SHARED'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-amber-500/5 border-amber-500/20'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    visibility === 'SHARED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  )}>
                    {visibility === 'SHARED' ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {visibility === 'SHARED' ? '전체 공개' : '금액만 공개'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {visibility === 'SHARED' ? '가족 모두가 상세 내용을 확인할 수 있어요' : '가족에게는 금액만 노출됩니다 🔒'}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/60">탭하여 변경</p>
              </div>

              {/* ── 계좌 자동 매칭 안내 ── */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card border border-border">
                <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground/70">계좌 자동 매칭</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    엑셀 내역에 포함된 결제수단 정보로 계좌가 자동 매칭됩니다.
                    {accountBalances.length > 0 && (
                      <span className="text-emerald-500 ml-1">
                        · 잔액 동기화 대상 {accountBalances.length}개 계좌 감지됨
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* ── 미리보기 테이블 ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground">미리보기</p>
                  <p className="text-xs text-muted-foreground/60">
                    {rows.length > PREVIEW_LIMIT ? `상위 ${PREVIEW_LIMIT}행 / 전체 ${rows.length}행` : `${rows.length}행`}
                  </p>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  {/* 헤더 */}
                  {isBanksalad ? (
                    <div className="grid grid-cols-[86px_1fr_76px_100px] bg-card border-b border-border px-3 py-2">
                      {['날짜·시간', '내용 / 결제수단', '금액', 'AI 분류'].map(h => (
                        <span key={h} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</span>
                      ))}
                    </div>
                  ) : colMap ? (
                    <div className="grid grid-cols-[100px_1fr_90px_80px] bg-card border-b border-border">
                      <ColSelect label="날짜"     value={colMap.date ?? ''}        options={headerOptions} onChange={v => handleColChange('date', v)}        hasValue={!!colMap.date} />
                      <ColSelect label="내용"     value={colMap.description ?? ''} options={headerOptions} onChange={v => handleColChange('description', v)} hasValue={!!colMap.description} />
                      <ColSelect label="금액"     value={colMap.amount ?? colMap.withdraw ?? ''} options={headerOptions} onChange={v => handleColChange('amount', v)} hasValue={!!(colMap.amount || colMap.withdraw)} />
                      <ColSelect label="카테고리" value={colMap.category ?? ''}    options={headerOptions} onChange={v => handleColChange('category', v)}    hasValue={!!colMap.category} />
                    </div>
                  ) : null}

                  {/* 바디 */}
                  <div className="divide-y divide-border/60 max-h-[300px] overflow-y-auto">
                    {rows.slice(0, PREVIEW_LIMIT).map((row, i) =>
                      isBanksalad
                        ? <BanksaladPreviewRow key={i} row={row} aiStatus={aiStatus} />
                        : <GenericPreviewRow key={i} row={row} aiStatus={aiStatus} />
                    )}
                  </div>
                </div>
              </div>

              {/* ── 오류 안내 ── */}
              {errorRows.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400">
                    {errorRows.length}행 오류 제외 · <strong className="text-foreground">{validRows.length}건</strong> 등록 예정
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 등록 버튼 ── */}
        {hasFile && (
          <DrawerFooter className="flex-shrink-0 pt-0 px-4 pb-6">
            <button
              onClick={handleSubmit}
              disabled={isLoading || validRows.length === 0}
              className={cn(
                'w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                isLoading || validRows.length === 0
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]'
              )}
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />등록 중...</>
                : `${validRows.length}건 등록하기`}
            </button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}

// ━━ AI 매핑 상태 배너 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AiMappingStatus({
  status, mappedCount, totalUnique, onRetry,
}: { status: AiStatus; mappedCount: number; totalUnique: number; onRetry: () => void }) {
  if (status === 'idle') return null

  if (status === 'loading') return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border">
      <Loader2 className="w-4 h-4 text-violet-500 dark:text-violet-400 animate-spin flex-shrink-0" />
      <div>
        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">AI 카테고리 분류 중...</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">고유 내역 {totalUnique}건을 분류하고 있어요</p>
      </div>
    </div>
  )

  if (status === 'done') return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-300 dark:border-violet-800/30">
      <Wand2 className="w-4 h-4 text-violet-500 dark:text-violet-400 flex-shrink-0" />
      <p className="text-xs text-violet-700 dark:text-violet-300">
        <span className="font-semibold">AI 분류 완료</span>
        <span className="text-violet-500 dark:text-violet-600 ml-1.5">{mappedCount}가지 내역 카테고리 매핑됨</span>
      </p>
    </div>
  )

  if (status === 'error') return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <p className="text-xs text-muted-foreground">AI 분류 실패 — 기존 매핑 사용 중</p>
      </div>
      <button onClick={onRetry} className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
        재시도
      </button>
    </div>
  )

  return null
}

// ━━ 뱅크샐러드 미리보기 행 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BanksaladPreviewRow({ row, aiStatus }: { row: ParsedRow; aiStatus: AiStatus }) {
  return (
    <div className={cn('grid grid-cols-[86px_1fr_76px_100px] px-3 py-2.5', row._error && 'bg-red-950/20')}>
      <div>
        <p className={cn('text-xs tabular-nums', row._error ? 'text-red-400' : 'text-muted-foreground')}>{row.date || '—'}</p>
        {row._time && <p className="text-[10px] text-muted-foreground/60">{row._time}</p>}
      </div>
      <div className="min-w-0 pr-2">
        <p className="text-xs text-foreground truncate">{row.description || <span className="text-muted-foreground/60 italic">내용 없음</span>}</p>
        {row._paymentMethod && <p className="text-[10px] text-muted-foreground/60 truncate">{row._paymentMethod}</p>}
      </div>
      <p className={cn('text-xs tabular-nums text-right', row._error ? 'text-red-400' : row.amount > 0 ? 'text-emerald-400' : 'text-foreground')}>
        {row._error ? '?' : (row.amount > 0 ? '+' : '') + formatCurrency(row.amount)}
      </p>
      <div className="pl-1 min-w-0">
        {row._error ? (
          <span className="text-red-400 text-[10px]">{row._error}</span>
        ) : row.categoryId ? (
          <>
            <p className="text-xs text-foreground truncate">{row.categoryIcon} {row.categoryName}</p>
            {row._banksaladCategory && <p className="text-[10px] text-muted-foreground/60 truncate">{row._banksaladCategory}</p>}
          </>
        ) : aiStatus === 'loading' ? (
          <p className="text-[10px] text-muted-foreground/60 animate-pulse">분류 중...</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground truncate">{row.category}</p>
            {row._banksaladCategory && <p className="text-[10px] text-muted-foreground/60 truncate">{row._banksaladCategory}</p>}
          </>
        )}
      </div>
    </div>
  )
}

// ━━ 범용 미리보기 행 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GenericPreviewRow({ row, aiStatus }: { row: ParsedRow; aiStatus: AiStatus }) {
  return (
    <div className={cn('grid grid-cols-[100px_1fr_90px_80px] px-3 py-2.5', row._error && 'bg-red-950/20')}>
      <span className={cn('text-xs tabular-nums', row._error === '날짜 오류' ? 'text-red-400' : 'text-muted-foreground')}>{row.date || '—'}</span>
      <span className="text-xs text-foreground truncate pr-2">{row.description || <span className="text-muted-foreground/60 italic">내용 없음</span>}</span>
      <span className={cn('text-xs tabular-nums text-right', row._error === '금액 오류' ? 'text-red-400' : row.amount > 0 ? 'text-emerald-400' : 'text-foreground')}>
        {row._error === '금액 오류' ? '?' : (row.amount > 0 ? '+' : '') + formatCurrency(row.amount)}
      </span>
      <div className="pl-1 min-w-0">
        {row._error ? (
          <span className="text-red-400 text-[10px]">{row._error}</span>
        ) : row.categoryId ? (
          <span className="text-xs text-foreground">{row.categoryIcon} {row.categoryName}</span>
        ) : aiStatus === 'loading' ? (
          <span className="text-[10px] text-muted-foreground/60 animate-pulse">분류 중...</span>
        ) : (
          <span className="text-xs text-muted-foreground">{row.category}</span>
        )}
      </div>
    </div>
  )
}

// ━━ 헤더 셀렉트 (범용 모드) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ColSelect({ label, value, options, onChange, hasValue }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; hasValue: boolean
}) {
  return (
    <div className="px-2 py-2 border-r border-border last:border-r-0">
      <div className="flex items-center gap-1 mb-1">
        {hasValue ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" /> : <AlertCircle className="w-2.5 h-2.5 text-muted-foreground/60 flex-shrink-0" />}
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide truncate">{label}</span>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full text-[10px] rounded px-1 py-0.5 border outline-none transition-colors truncate',
          hasValue ? 'bg-muted text-foreground/80 border-border' : 'bg-muted/50 text-muted-foreground border-border/50'
        )}
      >
        <option value="">미지정</option>
        {options.filter(Boolean).map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  )
}

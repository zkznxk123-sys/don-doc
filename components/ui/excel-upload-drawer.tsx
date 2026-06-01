'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  Upload, X, FileSpreadsheet, Loader2, AlertCircle,
  CheckCircle2, Sparkles, SkipForward, Wand2,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer'
import { createManyTransactions, syncAccountBalancesOnly, checkTransactionDuplicates, type BulkTransactionRow } from '@/lib/actions/transaction'
import { autoDetectAndExcludeTransfers, autoDetectAndExcludeCancellations, autoDetectAndExcludeSharedCardDuplicates } from '@/lib/actions/transactions/auto-exclude'
import { getFamilyCategories, syncBanksaladCategories, type CategoryOption } from '@/lib/actions/categories'
import { useDefaultVisibility } from '@/lib/hooks/useDefaultVisibility'
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
  // 중복 체크 결과
  _isDuplicate?: boolean
}

type AiStatus = 'idle' | 'pending' | 'loading' | 'done' | 'error' | 'skipped'
type UploadMode = 'both' | 'cashflow' | 'assets'

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

function mapRow(raw: Record<string, unknown>, col: ColMap, visibility: 'SHARED' | 'PRIVATE'): ParsedRow {
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
  return { date, description, amount: isNaN(amount) ? 0 : amount, category, visibility, _error }
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
  const aiAbortRef   = useRef<AbortController | null>(null)
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
  // DB 현재 계좌 잔액 (자산 diff 미리보기용)
  const [dbAccounts, setDbAccounts] = useState<{ name: string; balance: number }[]>([])

  // 월 필터 (뱅크샐러드 전용)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())

  // 업로드 모드 (뱅크샐러드 + 계좌 잔액 있을 때)
  const [uploadMode, setUploadMode] = useState<UploadMode>('both')

  // 가시성: 결정 ③ — 설정의 default visibility 사용 (사용자 기본값, 업로드 후 개별 수정 가능)
  const { visibility: defaultVisibility } = useDefaultVisibility()
  const visibility = defaultVisibility
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

  // ── AI 카테고리 매핑 (중복 체크 선행) ──
  const runAiMapping = useCallback(async (parsedRows: ParsedRow[]) => {
    setAiStatus('loading')
    const abort = new AbortController()
    aiAbortRef.current = abort
    try {
      // ── 중복 체크 먼저 ──
      const dupResults = await checkTransactionDuplicates(
        userId,
        parsedRows.map(r => ({
          date: r.date,
          amount: r.amount,
          description: r.description,
          accountName: r.accountName || r._paymentMethod || '기본 계좌',
        }))
      )
      // parsedRows 기준 중복 키 세트 구성 → 전체 rows에 반영
      const dupKeySet = new Set<string>()
      parsedRows.forEach((r, i) => {
        if (dupResults[i]) dupKeySet.add(`${r.date}|${r.amount}|${r.description}`)
      })
      setRows(prev => prev.map(r => ({
        ...r,
        _isDuplicate: dupKeySet.has(`${r.date}|${r.amount}|${r.description}`),
      })))

      // 새 항목만 AI 분류
      const newRows = parsedRows.filter((_, i) => !dupResults[i])

      // 고유한 (description, banksaladCategory) 쌍만 추출 — 토큰 절약
      const seen = new Set<string>()
      const uniqueItems: { description: string; banksaladCategory: string }[] = []
      for (const row of newRows) {
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
        signal: abort.signal,
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

      // 원본 rows에 categoryId / categoryName / categoryIcon 병합 (중복 아닌 것만)
      setRows(prev => prev.map(row => {
        if (row._isDuplicate) return row
        const m = mappingMap.get(row.description)
        if (!m) return row
        return { ...row, categoryId: m.categoryId, categoryName: m.categoryName, categoryIcon: m.categoryIcon }
      }))

      setAiMappedCount(data.mappings.length)
      setAiStatus('done')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setAiStatus('skipped')
      } else {
        setAiStatus('error')
      }
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
            category: r.category, visibility,
            accountName: r.paymentMethod || '기본 계좌',
            _banksaladCategory: r.banksaladCategory,
            _paymentMethod: r.paymentMethod,
            _time: r.time,
          }))
          const months = Array.from(new Set(parsed.map(r => r.date.slice(0, 7)))).sort()
          setAvailableMonths(months)
          // 기본: 가장 최근 1개월만 선택 (전체 선택은 사용자가 직접)
          setSelectedMonths(new Set(months.length > 0 ? [months[months.length - 1]] : []))

          setIsBanksalad(true)
          setBanksaladMeta({ skipped: banksaladResult.skippedCount, sheet: banksaladResult.sheetName })
          setAccountBalances(banksaladResult.accountBalances)
          setRows(parsed)

          // DB 계좌 잔액 로드 (자산 diff 미리보기용)
          if (banksaladResult.accountBalances.length > 0) {
            fetch('/api/accounts')
              .then(r => r.json())
              .then(d => {
                if (d.success && d.accounts) {
                  setDbAccounts(d.accounts.map((a: { name: string; balance: number }) => ({ name: a.name, balance: a.balance })))
                }
              })
              .catch(() => {})
          }
          setRawHeaders([]); setColMap(null); setRawData([])

          toast.success('뱅크샐러드 양식이 감지되었습니다.', {
            description: `${banksaladResult.rows.length}건 파싱 완료 · 이체 ${banksaladResult.skippedCount}건 제외`,
          })

          // 발견된 대분류를 DB 카테고리로 자동 동기화 (없는 것만 생성)
          if (banksaladResult.uniqueMajorCategories.length > 0) {
            await syncBanksaladCategories(banksaladResult.uniqueMajorCategories)
          }

          setAiStatus('pending')  // 월/모드 선택 후 수동 시작
          return
        }

        // 범용 파서 폴백
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })
        if (json.length === 0) { toast.error('데이터가 없습니다.'); return }

        const headers = Object.keys(json[0])
        const preset = detectPreset(headers)
        const col = buildColMap(headers, preset)
        const parsed = json.map(r => mapRow(r, col, visibility))

        setIsBanksalad(false); setBanksaladMeta(null)
        setRawHeaders(headers); setRawData(json)
        setDetectedPreset(preset); setColMap(col)
        setRows(parsed)
        // 컬럼 매핑 확인/수정할 시간을 주고 사용자가 직접 AI 분류 시작하도록
        setAiStatus('pending')
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
      const newRows = rawData.map(r => mapRow(r, next, visibility))
      setRows(newRows)
      return next
    })
    // 컬럼 매핑 바꾸면 이전 AI 결과는 무효 — pending으로 되돌림
    setAiStatus(prev => (prev === 'done' || prev === 'skipped' || prev === 'error') ? 'pending' : prev)
    setAiMappedCount(0)
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
    setAccountBalances([]); setDbAccounts([])
    setAvailableMonths([]); setSelectedMonths(new Set())
    setUploadMode('both')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => { handleReset(); onClose() }

  const filteredRows = isBanksalad && selectedMonths.size > 0
    ? rows.filter(r => selectedMonths.has(r.date.slice(0, 7)))
    : rows

  // 월 선택 변경 시 분류 결과 초기화 (pending으로 되돌림)
  const resetAiForReselection = () => {
    if (aiStatus === 'done' || aiStatus === 'skipped' || aiStatus === 'error') {
      setAiStatus('pending')
      setAiMappedCount(0)
      setRows(prev => prev.map(r => ({ ...r, _isDuplicate: undefined })))
    }
  }

  const toggleMonth = (month: string) => {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) {
        if (next.size === 1) return prev // 최소 1개 유지
        next.delete(month)
      } else {
        next.add(month)
      }
      return next
    })
    resetAiForReselection()
  }

  const validRows = filteredRows.filter(r => !r._error && !r._isDuplicate)
  const errorRows = filteredRows.filter(r => r._error)
  const duplicateRows = filteredRows.filter(r => r._isDuplicate)

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      // ── 자산만 업데이트 모드 ──
      if (uploadMode === 'assets') {
        const result = await syncAccountBalancesOnly(familyId, userId, accountBalances, { fileName: fileName ?? undefined })
        if (result.success) {
          toast.success(`계좌 잔액 ${result.syncedCount}개 업데이트 완료`)
          handleClose(); onSuccess()
        } else {
          toast.error(result.error ?? '잔액 업데이트에 실패했습니다.')
        }
        return
      }

      // ── 현금흐름 포함 모드 ──
      if (validRows.length === 0) {
        // 신규 거래 없어도 both 모드에서 자산 잔액은 업데이트
        if (uploadMode === 'both' && accountBalances.length > 0) {
          const result = await syncAccountBalancesOnly(familyId, userId, accountBalances, { fileName: fileName ?? undefined })
          if (result.success) {
            toast.success(`계좌 잔액 ${result.syncedCount}개 업데이트 완료`, { description: '새로 등록할 거래 내역이 없습니다.' })
            handleClose(); onSuccess()
          } else {
            toast.error(result.error ?? '잔액 업데이트에 실패했습니다.')
          }
          return
        }
        toast.error('등록 가능한 내역이 없습니다.')
        return
      }

      const submitRows: BulkTransactionRow[] = validRows.map(r => ({
        amount: r.amount,
        date: r.date,
        description: r.description,
        category: r.categoryName ?? r.category,
        categoryId: r.categoryId,
        visibility,
        accountName: r.accountName || r._paymentMethod || '기본 계좌',
      }))
      const submitOptions = {
        ...(uploadMode === 'both' && accountBalances.length > 0 ? { accountBalances } : {}),
        ...(fileName ? { fileName } : {}),
      }
      const result = await createManyTransactions(userId, familyId, submitRows, submitOptions)

      if (result.success) {
        const total = validRows.length
        const saved = result.count ?? 0
        const skipped = result.skippedCount ?? 0
        const syncPart = result.syncedAccountCount
          ? `${result.syncedAccountCount}개 계좌 잔액 동기화`
          : null

        const dupDesc = skipped > 0
          ? `총 ${total}건 중 ${skipped}건은 이미 존재하여 무시됨`
          : null

        if (saved === 0) {
          toast.info('모든 내역이 이미 등록되어 있습니다.', { description: dupDesc ?? undefined })
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

        Promise.all([
          autoDetectAndExcludeTransfers(familyId ?? undefined),
          autoDetectAndExcludeCancellations(familyId ?? undefined),
          autoDetectAndExcludeSharedCardDuplicates(familyId ?? undefined),
        ]).then(([r1, r2, r3]) => {
          const parts = []
          if (r1.success && r1.pairCount > 0) parts.push(`이체 ${r1.pairCount}쌍`)
          if (r2.success && r2.pairCount > 0) parts.push(`취소 ${r2.pairCount}쌍`)
          if (r3.success && r3.dupCount > 0) parts.push(`공용 카드 중복 ${r3.dupCount}건`)
          if (parts.length > 0) toast.info(`${parts.join(', ')} 자동 제외 처리됨`)
        })

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
          <p className="text-left text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv 파일을 지원합니다</p>
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
                  <FileSpreadsheet className={cn("w-4 h-4", isBanksalad ? "text-violet-400" : "text-income")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    총 {rows.length}행
                    {errorRows.length > 0 && <span className="text-warning ml-1">· {errorRows.length}행 오류</span>}
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
                  <Sparkles className="w-4 h-4 text-income dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{detectedPreset.name} 양식 감지됨</p>
                    <p className="text-[10px] text-income dark:text-emerald-700 mt-0.5">{detectedPreset.description}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border">
                  <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">양식 자동 감지 실패 — 아래 헤더 셀렉트에서 직접 지정해주세요</p>
                </div>
              )}

              {/* ── 1. 업데이트 범위 — 최상위 결정 ── */}
              {isBanksalad && accountBalances.length > 0 && (
                <div className="rounded-xl border border-border p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground/70">업데이트 범위</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { value: 'both',     label: '전체',      desc: '거래 + 자산' },
                      { value: 'cashflow', label: '현금흐름만', desc: '거래 내역만' },
                      { value: 'assets',   label: '자산만',    desc: `잔액 ${accountBalances.length}개` },
                    ] as { value: UploadMode; label: string; desc: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setUploadMode(opt.value)}
                        className={cn(
                          'flex flex-col items-center py-2 px-1 rounded-lg border text-center transition-colors',
                          uploadMode === opt.value
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-muted/50 text-muted-foreground border-border hover:border-foreground/30'
                        )}
                      >
                        <span className="text-xs font-semibold">{opt.label}</span>
                        <span className={cn('text-[10px] mt-0.5', uploadMode === opt.value ? 'text-background/70' : 'text-muted-foreground/60')}>{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 2. 💸 현금흐름 카드 — 월 + AI 매핑 + 미리보기 (uploadMode !== 'assets') ── */}
              {uploadMode !== 'assets' && (
                <section className="rounded-xl border border-border overflow-hidden">
                  <header className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                    <span className="text-base">💸</span>
                    <span className="text-xs font-semibold text-foreground/80">현금흐름 — 거래 내역</span>
                  </header>
                  <div className="divide-y divide-border">

                    {/* 업로드할 월 */}
                    {isBanksalad && availableMonths.length > 1 && (
                      <div className="p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground/70">
                            업로드할 월
                            <span className="ml-1.5 font-normal text-muted-foreground/60">
                              ({selectedMonths.size}/{availableMonths.length}개월)
                            </span>
                          </p>
                          <button
                            onClick={() => {
                              setSelectedMonths(
                                selectedMonths.size === availableMonths.length
                                  ? new Set([availableMonths[availableMonths.length - 1]])
                                  : new Set(availableMonths)
                              )
                              resetAiForReselection()
                            }}
                            className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
                          >
                            {selectedMonths.size === availableMonths.length ? '전체 해제' : '전체 선택'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {availableMonths.map(month => {
                            const [y, m] = month.split('-')
                            const label = `${y}년 ${parseInt(m)}월`
                            const active = selectedMonths.has(month)
                            return (
                              <button
                                key={month}
                                onClick={() => toggleMonth(month)}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                                  active
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'bg-muted text-muted-foreground border-border hover:border-foreground/40'
                                )}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* AI 매핑 상태 */}
                    <div className="p-3">
                      <AiMappingStatus
                        status={aiStatus}
                        mappedCount={aiMappedCount}
                        totalUnique={filteredRows.filter(r => !r._error && r.description).length}
                        onStart={() => runAiMapping(filteredRows)}
                        onAbort={() => aiAbortRef.current?.abort()}
                        onRetry={() => runAiMapping(filteredRows)}
                      />
                    </div>

                    {/* 미리보기 표 */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground">미리보기</p>
                        <p className="text-xs text-muted-foreground/60">
                          {duplicateRows.length > 0
                            ? <>신규 <span className="text-foreground font-medium">{validRows.length}</span>건 · 이미 등록 <span className="text-muted-foreground/50">{duplicateRows.length}</span>건</>
                            : filteredRows.length > PREVIEW_LIMIT ? `상위 ${PREVIEW_LIMIT}행 / 전체 ${filteredRows.length}행` : `${filteredRows.length}행`
                          }
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

                        {/* 바디 — 신규 항목 먼저, 중복 항목 뒤로 */}
                        <div className="divide-y divide-border/60 max-h-[300px] overflow-y-auto">
                          {[...filteredRows]
                            .sort((a, b) => (a._isDuplicate ? 1 : 0) - (b._isDuplicate ? 1 : 0))
                            .slice(0, PREVIEW_LIMIT)
                            .map((row, i) =>
                            isBanksalad
                              ? <BanksaladPreviewRow key={i} row={row} aiStatus={aiStatus} />
                              : <GenericPreviewRow key={i} row={row} aiStatus={aiStatus} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ── 3. 🏦 자산 카드 — 계좌별 잔액 변경 (uploadMode !== 'cashflow') ── */}
              {isBanksalad && accountBalances.length > 0 && uploadMode !== 'cashflow' && (
                <section className="rounded-xl border border-border overflow-hidden">
                  <header className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                    <span className="text-base">🏦</span>
                    <span className="text-xs font-semibold text-foreground/80">자산 — 계좌 잔액 변경</span>
                  </header>
                  <div className="p-3">
                    <AccountBalanceDiff accountBalances={accountBalances} dbAccounts={dbAccounts} />
                  </div>
                </section>
              )}

              {/* ── 오류 안내 ── */}
              {errorRows.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    {errorRows.length}행 오류 제외 · <strong className="text-foreground">{validRows.length}건</strong> 등록 예정
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 등록 버튼 ── */}
        {hasFile && (
          <DrawerFooter className="flex-shrink-0 pt-0 px-4 pb-6 space-y-2">
            <button
              onClick={handleSubmit}
              disabled={isLoading || (uploadMode === 'assets' ? false : uploadMode === 'both' && accountBalances.length > 0 ? false : validRows.length === 0)}
              className={cn(
                'w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                isLoading || (uploadMode !== 'assets' && validRows.length === 0)
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]'
              )}
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{uploadMode === 'assets' ? '업데이트 중...' : '등록 중...'}</>
                : uploadMode === 'assets'
                ? `계좌 잔액 ${accountBalances.length}개 업데이트`
                : validRows.length === 0 && uploadMode === 'both' && accountBalances.length > 0
                ? `계좌 잔액 ${accountBalances.length}개 업데이트`
                : aiStatus === 'pending'
                ? `${validRows.length}건 등록하기 (분류 생략)`
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
  status, mappedCount, totalUnique, onStart, onAbort, onRetry,
}: { status: AiStatus; mappedCount: number; totalUnique: number; onStart: () => void; onAbort: () => void; onRetry: () => void }) {
  if (status === 'idle') return null

  if (status === 'pending') return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground/70">AI 카테고리 분류</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">월 · 범위 선택 후 분류를 시작하세요</p>
        </div>
      </div>
      <button
        onClick={onStart}
        className="px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 text-xs font-semibold transition-colors border border-violet-500/20"
      >
        분류 시작
      </button>
    </div>
  )

  if (status === 'loading') return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2.5">
        <Loader2 className="w-4 h-4 text-violet-500 dark:text-violet-400 animate-spin flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">AI 카테고리 분류 중...</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">고유 내역 {totalUnique}건을 분류하고 있어요</p>
        </div>
      </div>
      <button onClick={onAbort} className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">
        중단
      </button>
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
  const isDup = row._isDuplicate
  return (
    <div className={cn(
      'grid grid-cols-[86px_1fr_76px_100px] px-3 py-2.5',
      row._error ? 'bg-red-950/20' : isDup ? 'opacity-40' : ''
    )}>
      <div>
        <p className={cn('text-xs tabular-nums', row._error ? 'text-destructive' : 'text-muted-foreground')}>{row.date || '—'}</p>
        {row._time && <p className="text-[10px] text-muted-foreground/60">{row._time}</p>}
      </div>
      <div className="min-w-0 pr-2">
        <p className="text-xs text-foreground truncate">{row.description || <span className="text-muted-foreground/60 italic">내용 없음</span>}</p>
        {row._paymentMethod && <p className="text-[10px] text-muted-foreground/60 truncate">{row._paymentMethod}</p>}
      </div>
      <p className={cn('text-xs tabular-nums text-right', row._error ? 'text-destructive' : row.amount > 0 ? 'text-income' : 'text-foreground')}>
        {row._error ? '?' : (row.amount > 0 ? '+' : '') + formatCurrency(row.amount)}
      </p>
      <div className="pl-1 min-w-0">
        {row._error ? (
          <span className="text-destructive text-[10px]">{row._error}</span>
        ) : isDup ? (
          <span className="text-[10px] text-muted-foreground/50">이미 등록됨</span>
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
      <span className={cn('text-xs tabular-nums', row._error === '날짜 오류' ? 'text-destructive' : 'text-muted-foreground')}>{row.date || '—'}</span>
      <span className="text-xs text-foreground truncate pr-2">{row.description || <span className="text-muted-foreground/60 italic">내용 없음</span>}</span>
      <span className={cn('text-xs tabular-nums text-right', row._error === '금액 오류' ? 'text-destructive' : row.amount > 0 ? 'text-income' : 'text-foreground')}>
        {row._error === '금액 오류' ? '?' : (row.amount > 0 ? '+' : '') + formatCurrency(row.amount)}
      </span>
      <div className="pl-1 min-w-0">
        {row._error ? (
          <span className="text-destructive text-[10px]">{row._error}</span>
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

// ━━ 자산 잔액 Diff 미리보기 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function normalizeAccountName(s: string) {
  return s.toLowerCase().replace(/\s+/g, '')
}

function matchDbAccount(excelName: string, dbAccounts: { name: string; balance: number }[]): { name: string; balance: number } | null {
  const norm = normalizeAccountName(excelName)
  return dbAccounts.find(a => {
    const aNorm = normalizeAccountName(a.name)
    return aNorm.includes(norm) || norm.includes(aNorm)
  }) ?? null
}

function AccountBalanceDiff({
  accountBalances,
  dbAccounts,
}: {
  accountBalances: AccountBalance[]
  dbAccounts: { name: string; balance: number }[]
}) {
  if (accountBalances.length === 0) return null

  const diffs = accountBalances.map(ab => {
    const matched = matchDbAccount(ab.name, dbAccounts)
    return { name: ab.name, newBalance: ab.balance, currentBalance: matched?.balance ?? null }
  })

  return (
    <div className="mt-1 rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto] bg-muted/40 px-2.5 py-1.5 border-b border-border">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">계좌명</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-right">잔액 변경</span>
      </div>
      <div className="divide-y divide-border/60 max-h-[160px] overflow-y-auto">
        {diffs.map((d, i) => {
          const isNew = d.currentBalance === null
          const diff = isNew ? 0 : d.newBalance - d.currentBalance!
          const diffAbs = Math.abs(diff)
          return (
            <div key={i} className="grid grid-cols-[1fr_auto] items-center px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-xs text-foreground truncate">{d.name}</p>
                {isNew && (
                  <span className="text-[10px] text-violet-400">신규 계좌</span>
                )}
              </div>
              <div className="text-right pl-2 flex-shrink-0">
                {isNew ? (
                  <p className="text-xs text-foreground tabular-nums">{formatCurrency(d.newBalance)}</p>
                ) : (
                  <>
                    <p className="text-xs text-foreground tabular-nums">{formatCurrency(d.newBalance)}</p>
                    {diff !== 0 && (
                      <p className={cn('text-[10px] tabular-nums', diff > 0 ? 'text-income' : 'text-destructive')}>
                        {diff > 0 ? '+' : '-'}{formatCurrency(diffAbs)}
                      </p>
                    )}
                    {diff === 0 && (
                      <p className="text-[10px] text-muted-foreground/50">변동 없음</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
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
        {hasValue ? <CheckCircle2 className="w-2.5 h-2.5 text-income flex-shrink-0" /> : <AlertCircle className="w-2.5 h-2.5 text-muted-foreground/60 flex-shrink-0" />}
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

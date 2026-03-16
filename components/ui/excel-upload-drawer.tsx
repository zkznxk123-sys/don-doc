'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Upload, X, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createManyTransactions, type BulkTransactionRow } from '@/lib/actions/transaction'

// ━━ 타입 ━━
interface ParsedRow extends BulkTransactionRow {
  _error?: string
}

interface ColMap {
  date: string | null
  description: string | null
  amount: string | null     // 부호 포함 단일 금액 열
  withdraw: string | null   // 출금 전용 열
  deposit: string | null    // 입금 전용 열
  category: string | null
}

interface AccountOption {
  id: string
  name: string
  typeLabel: string
  balance: number
}

// ━━ 컬럼 감지 패턴 ━━
const COL = {
  date:        ['날짜', '거래일', '거래일시', '거래일자', 'date', '일자', '거래날짜'],
  description: ['내용', '적요', '거래내역', '메모', '거래명', '거래 내역', 'description', '상호', '가맹점'],
  amount:      ['금액', '거래금액', '금액(원)', 'amount', '거래액'],
  withdraw:    ['출금', '출금액', '출금(원)', '지출', '출금금액'],
  deposit:     ['입금', '입금액', '입금(원)', '수입', '입금금액'],
  category:    ['카테고리', '분류', 'category', '구분'],
}

function detectCols(headers: string[]): ColMap {
  const n = (s: string) => s.trim().toLowerCase()
  const find = (pats: string[]) =>
    headers.find(h => pats.some(p => n(h) === n(p))) ?? null
  return {
    date:        find(COL.date),
    description: find(COL.description),
    amount:      find(COL.amount),
    withdraw:    find(COL.withdraw),
    deposit:     find(COL.deposit),
    category:    find(COL.category),
  }
}

// ━━ 파서 유틸 ━━
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

  const description = col.description
    ? String(raw[col.description] ?? '').trim()
    : ''

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

  return {
    date,
    description,
    amount: isNaN(amount) ? 0 : amount,
    category,
    visibility: 'SHARED',
    _error,
  }
}

// ━━ 메인 컴포넌트 ━━
interface ExcelUploadDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userId: string
  familyId: string
}

const PREVIEW_LIMIT = 50

export function ExcelUploadDrawer({
  isOpen, onClose, onSuccess, userId, familyId,
}: ExcelUploadDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [colMap, setColMap] = useState<ColMap | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [rawHeaders, setRawHeaders] = useState<string[]>([])

  // 계좌 목록 로드
  useEffect(() => {
    if (!isOpen || !familyId) return
    fetch(`/api/accounts?familyId=${familyId}&userId=${userId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAccounts(d.accounts.map((a: any) => ({
            id: a.id,
            name: a.name,
            typeLabel: a.typeLabel,
            balance: a.balance,
          })))
          if (d.accounts.length > 0 && !accountId) setAccountId(d.accounts[0].id)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const processFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: '',
          raw: true,
        })

        if (json.length === 0) {
          toast.error('데이터가 없습니다. 파일을 확인해주세요.')
          return
        }

        const headers = Object.keys(json[0])
        setRawHeaders(headers)
        const detected = detectCols(headers)
        setColMap(detected)
        setRows(json.map(r => mapRow(r, detected)))
      } catch {
        toast.error('파일을 읽는 중 오류가 발생했습니다.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleReset = () => {
    setFileName(null)
    setColMap(null)
    setRows([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const validRows = rows.filter(r => !r._error)
  const errorRows = rows.filter(r => r._error)

  const handleSubmit = async () => {
    if (!accountId) { toast.error('계좌를 선택해주세요.'); return }
    if (validRows.length === 0) { toast.error('등록 가능한 내역이 없습니다.'); return }

    setIsLoading(true)
    try {
      const result = await createManyTransactions(userId, accountId, validRows)
      if (result.success) {
        toast.success(`${result.count}건 등록 완료`)
        handleClose()
        onSuccess()
      } else {
        toast.error(result.error ?? '등록에 실패했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const hasFile = rows.length > 0

  return (
    <Drawer open={isOpen} onOpenChange={v => { if (!v) handleClose() }}>
      <DrawerContent className="bg-black border-t border-zinc-800 max-h-[92vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-white text-lg font-bold">
              엑셀 일괄 등록
            </DrawerTitle>
            <DrawerClose asChild>
              <button onClick={handleClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </DrawerClose>
          </div>
          <p className="text-xs text-zinc-500 mt-1">.xlsx, .xls, .csv 파일을 지원합니다</p>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">

          {/* ── 파일 업로드 존 ── */}
          {!hasFile ? (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 py-14 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                isDragging
                  ? 'border-white/40 bg-zinc-800/50'
                  : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50'
              )}
            >
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
                <Upload className="w-6 h-6 text-zinc-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">파일을 드래그하거나 탭해서 선택</p>
                <p className="text-xs text-zinc-500 mt-1">.xlsx · .xls · .csv</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <>
              {/* ── 파일 정보 + 리셋 ── */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{fileName}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    총 {rows.length}행
                    {errorRows.length > 0 && (
                      <span className="text-amber-400 ml-1">· {errorRows.length}행 오류</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── 컬럼 감지 상태 ── */}
              {colMap && (
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <p className="text-xs font-semibold text-zinc-400 mb-2">열 감지 결과</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {([
                      ['날짜',   colMap.date],
                      ['내용',   colMap.description],
                      ['금액',   colMap.amount ?? colMap.deposit ?? colMap.withdraw],
                      ['카테고리', colMap.category],
                    ] as [string, string | null][]).map(([label, val]) => (
                      <div key={label} className="flex items-center gap-2">
                        {val
                          ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          : <AlertCircle  className="w-3 h-3 text-zinc-600    flex-shrink-0" />
                        }
                        <span className="text-xs text-zinc-400">{label}</span>
                        <span className="text-xs text-zinc-600 truncate">
                          {val ? `"${val}"` : '미감지'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* 실제 헤더 목록 */}
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <p className="text-[10px] text-zinc-600 mb-1.5">파일의 실제 열 이름</p>
                    <div className="flex flex-wrap gap-1">
                      {rawHeaders.map(h => (
                        <span key={h} className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 계좌 선택 ── */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">등록할 계좌</label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-full h-11 bg-zinc-900 border-zinc-800 text-white rounded-xl">
                    <SelectValue placeholder="계좌 선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-white focus:bg-zinc-800">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-zinc-500 text-xs ml-2">{a.typeLabel}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── 미리보기 테이블 ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-400">미리보기</p>
                  <p className="text-xs text-zinc-600">
                    {rows.length > PREVIEW_LIMIT ? `상위 ${PREVIEW_LIMIT}행 표시 (전체 ${rows.length}행)` : `${rows.length}행`}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  {/* 헤더 */}
                  <div className="grid grid-cols-[90px_1fr_80px_70px] gap-0 bg-zinc-900 border-b border-zinc-800 px-3 py-2">
                    {['날짜', '내용', '금액', '카테고리'].map(h => (
                      <span key={h} className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>
                  {/* 바디 */}
                  <div className="divide-y divide-zinc-800/60 max-h-[280px] overflow-y-auto">
                    {rows.slice(0, PREVIEW_LIMIT).map((row, i) => (
                      <div
                        key={i}
                        className={cn(
                          'grid grid-cols-[90px_1fr_80px_70px] gap-0 px-3 py-2.5',
                          row._error ? 'bg-red-950/20' : ''
                        )}
                      >
                        <span className={cn(
                          'text-xs tabular-nums',
                          row._error === '날짜 오류' ? 'text-red-400' : 'text-zinc-400'
                        )}>
                          {row.date || '—'}
                        </span>
                        <span className="text-xs text-white truncate pr-2">
                          {row.description || <span className="text-zinc-600 italic">내용 없음</span>}
                        </span>
                        <span className={cn(
                          'text-xs tabular-nums text-right',
                          row._error === '금액 오류' ? 'text-red-400'
                            : row.amount > 0 ? 'text-emerald-400'
                            : 'text-white'
                        )}>
                          {row._error === '금액 오류' ? '?' : (row.amount > 0 ? '+' : '') + formatCurrency(row.amount)}
                        </span>
                        <span className="text-xs text-zinc-500 truncate pl-1">
                          {row._error ? (
                            <span className="text-red-400 text-[10px]">{row._error}</span>
                          ) : row.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── 오류 행 안내 ── */}
              {errorRows.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400">
                    {errorRows.length}행은 날짜 또는 금액 오류로 제외됩니다.
                    나머지 <strong className="text-white">{validRows.length}건</strong>이 등록됩니다.
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
              disabled={isLoading || validRows.length === 0 || !accountId}
              className={cn(
                'w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                isLoading || validRows.length === 0 || !accountId
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-zinc-200 active:scale-[0.98]'
              )}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />등록 중...</>
              ) : (
                `${validRows.length}건 등록하기`
              )}
            </button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}

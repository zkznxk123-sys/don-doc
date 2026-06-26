'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  Upload, X, FileSpreadsheet, Loader2, AlertCircle,
  Sparkles, SkipForward, Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer'
import {
  createManyTransactions, syncAccountBalancesOnly, checkTransactionDuplicates,
  type BulkTransactionRow,
} from '@/lib/actions/transactions/bulk'
import { autoDetectAndExcludeTransfers, autoDetectAndExcludeCancellations, autoDetectAndExcludeSharedCardDuplicates } from '@/lib/actions/transactions/auto-exclude'
import { syncBanksaladCategories } from '@/lib/actions/categories'
import { useDefaultVisibility } from '@/lib/hooks/useDefaultVisibility'
import { track } from '@/lib/posthog'
import {
  type ColMap, type ExcelPreset,
  detectPreset, buildColMap, detectHeaderRow,
} from '@/constants/excel-presets'
import {
  tryParseBanksalad, type BanksaladRow, type AccountBalance,
} from '@/utils/excel-parser'
import { detectAssetTemplate, type PeriodSnapshot } from '@/utils/asset-templates'
import { aggregateSnapshot } from '@/utils/asset-templates/types'
import { importNetWorthSnapshots } from '@/lib/actions/networth'
import type { MappingResult } from '@/app/api/ai/map-categories/route'
import { InputGuide } from '@/components/dashboard/InputGuide'

import { mapRow, type ParsedRow, type AiStatus, type UploadMode } from './excel-upload-drawer/parsers'
import {
  AiMappingStatus, BanksaladPreviewRow, GenericPreviewRow, AccountBalanceDiff, ColSelect,
  listToggleableBalanceNames,
  type DbAccountWithHoldings,
} from './excel-upload-drawer/preview-components'

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
  // 자산 템플릿(부자공식 등) — 거래 없이 자산 잔액만, 미매칭 계좌 자동 생성
  const [assetTemplate, setAssetTemplate] = useState<{
    name: string; count: number; latestLabel: string | null; periods: PeriodSnapshot[]; monthlyCount: number
  } | null>(null)
  // Phase 3a — 결정형 실패 시 LLM 폴백용 raw 2D 그리드 + 추출 상태
  const [llmGrid, setLlmGrid] = useState<unknown[][] | null>(null)
  const [aiExtracting, setAiExtracting] = useState(false)
  // Phase 3b — 스크린샷(자산 캡처) 대기 이미지 data URL
  const [pendingImage, setPendingImage] = useState<string | null>(null)

  // AI 매핑
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle')
  const [aiMappedCount, setAiMappedCount] = useState(0)

  // 뱅샐현황 계좌 잔액 목록
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])
  // DB 현재 계좌 잔액 (자산 diff 미리보기용). holdingNames 포함 — 종목을 holding으로 옮긴 경우 매칭에 사용
  const [dbAccounts, setDbAccounts] = useState<DbAccountWithHoldings[]>([])
  // 사용자가 잔액 동기화에서 제외한 계좌명 set — 체크박스 unchecked
  const [excludedAccountNames, setExcludedAccountNames] = useState<Set<string>>(new Set())

  // 월 필터 (뱅크샐러드 전용)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())

  // 업로드 모드 (뱅크샐러드 + 계좌 잔액 있을 때)
  // 2026-06-11 [asset-input-redesign 1a]: default 'both' → 'cashflow'.
  // 자산 sheet 동기화는 사용자가 '전체' 또는 '자산만' 명시 선택 시에만 작동(opt-in).
  // 잘못된 자산 잔액 누적 사고 누적(6/10 정산) 방지. 거래는 그대로 자동.
  const [uploadMode, setUploadMode] = useState<UploadMode>('cashflow')

  // 가시성: 결정 ③ — 설정의 default visibility 사용 (사용자 기본값, 업로드 후 개별 수정 가능)
  const { visibility: defaultVisibility } = useDefaultVisibility()
  const visibility = defaultVisibility
  const [isLoading, setIsLoading] = useState(false)

  // 가족 구성원 이름 (이체 필터링용)
  const [familyMemberNames, setFamilyMemberNames] = useState<string[]>([])

  // ── 카테고리 + 가족 정보 로드 ──
  useEffect(() => {
    if (!isOpen) return
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
  }, [userId])

  // ── 파일 파싱 ──
  const processFile = useCallback((file: File) => {
    setFileName(file.name)
    setAiStatus('idle')
    setAiMappedCount(0)
    setAssetTemplate(null)
    setLlmGrid(null)
    setPendingImage(null)

    // 이미지(스크린샷) → vision 추출 대기 상태로 (결정형 파싱 없음)
    if (file.type.startsWith('image/')) {
      const imgReader = new FileReader()
      imgReader.onload = () => {
        setIsBanksalad(false); setBanksaladMeta(null); setDetectedPreset(null)
        setColMap(null); setRawData([]); setRows([]); setRawHeaders([])
        setAccountBalances([]); setExcludedAccountNames(new Set())
        setPendingImage(imgReader.result as string)
        setUploadMode('assets')
      }
      imgReader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: false })

        // 뱅크샐러드 전용 파서 우선 시도.
        // 단 내용 0건(거래·잔액 모두 0)이면 오탐 — 부자공식 등 '가계부' 시트명만
        // 일치하는 파일을 뱅샐로 가로채지 않게 통과시켜 아래 자산 템플릿으로 보낸다.
        const banksaladResult = tryParseBanksalad(wb, familyMemberNames)
        if (banksaladResult && (banksaladResult.rows.length > 0 || banksaladResult.accountBalances.length > 0)) {
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
          setExcludedAccountNames(new Set())   // 새 파일 = 전부 선택 상태로 시작
          setAccountBalances(banksaladResult.accountBalances)
          setRows(parsed)

          // DB 계좌 잔액 로드 (자산 diff 미리보기용)
          if (banksaladResult.accountBalances.length > 0) {
            fetch('/api/accounts')
              .then(r => r.json())
              .then(d => {
                if (d.success && d.accounts) {
                  setDbAccounts((d.accounts as DbAccountWithHoldings[]).map(a => ({
                    name: a.name,
                    balance: a.balance,
                    holdingNames: a.holdingNames ?? [],
                  })))
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

        // 자산 템플릿(부자공식·대차대조표 등) — 거래 없이 자산 잔액만
        const assetResult = detectAssetTemplate(wb)
        if (assetResult) {
          const balances: AccountBalance[] = assetResult.rows.map(r => ({
            name: r.name, balance: r.balance, type: r.type,
          }))
          setIsBanksalad(false); setBanksaladMeta(null)
          setRawHeaders([]); setColMap(null); setRawData([]); setRows([])
          setExcludedAccountNames(new Set())   // 새 파일 = 전부 선택 상태로 시작
          setAccountBalances(balances)
          setAssetTemplate({
            name: assetResult.name, count: balances.length,
            latestLabel: assetResult.latestLabel, periods: assetResult.periods,
            monthlyCount: assetResult.monthlyCount,
          })
          setUploadMode('assets')   // 거래 없음 — 자산만 고정

          fetch('/api/accounts')
            .then(r => r.json())
            .then(d => {
              if (d.success && d.accounts) {
                setDbAccounts((d.accounts as DbAccountWithHoldings[]).map(a => ({
                  name: a.name, balance: a.balance, holdingNames: a.holdingNames ?? [],
                })))
              }
            })
            .catch(() => {})

          toast.success(`${assetResult.name} 양식이 감지되었습니다.`, {
            description: assetResult.monthlyCount > 1
              ? `${assetResult.latestLabel ?? '최신'} 기준 ${balances.length}건 · 순자산 추이 ${assetResult.monthlyCount}개월`
              : `자산·부채 ${balances.length}건 추출 완료`,
          })
          setAiStatus('idle')
          return
        }

        // 범용 파서 폴백
        const ws = wb.Sheets[wb.SheetNames[0]]
        // 헤더가 0행이 아닌 양식(상단 요약 블록) 대응 — 실제 헤더 행을 찾아 거기서부터 파싱.
        const fullGrid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true })
        const headerRow = detectHeaderRow(fullGrid)
        // 숫자 range는 오프셋 시트(!ref가 A1이 아닌 경우)에서 어긋난다 → !ref 기준 절대 주소로 변환.
        let json: Record<string, unknown>[]
        if (headerRow > 0 && ws['!ref']) {
          const rng = XLSX.utils.decode_range(ws['!ref'])
          const shifted = XLSX.utils.encode_range({ s: { r: rng.s.r + headerRow, c: rng.s.c }, e: rng.e })
          json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: shifted, defval: '', raw: true })
        } else {
          json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })
        }
        if (json.length === 0) { toast.error('데이터가 없습니다.'); return }

        const headers = Object.keys(json[0])
        const preset = detectPreset(headers)
        const col = buildColMap(headers, preset)
        const parsed = json.map(r => mapRow(r, col, visibility))

        // LLM 폴백용 raw 2D 그리드 — 헤더부터(상단 요약 블록 제거)
        const grid = headerRow > 0 ? fullGrid.slice(headerRow) : fullGrid
        setLlmGrid(grid)

        setIsBanksalad(false); setBanksaladMeta(null)
        setRawHeaders(headers); setRawData(json)
        setDetectedPreset(preset); setColMap(col)
        setRows(parsed)
        // 컬럼 매핑 확인/수정할 시간을 주고 사용자가 직접 AI 분류 시작하도록
        setAiStatus('pending')
      } catch (err) {
        // 비밀번호(암호화) 걸린 엑셀 — SheetJS가 "password-protected" 류 에러를 던진다.
        const msg = err instanceof Error ? err.message : ''
        if (/password|encrypt/i.test(msg)) {
          toast.error('비밀번호가 걸린 파일은 열 수 없어요.', {
            description: '엑셀에서 비밀번호(읽기 암호)를 해제하고 다시 올려주세요.',
          })
        } else {
          toast.error('파일을 읽는 중 오류가 발생했습니다.')
        }
      }
    }
    reader.readAsArrayBuffer(file)
  }, [familyMemberNames, visibility])

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
  }, [rawData, visibility])

  // Phase 3a — "AI로 읽기": 모르는 양식을 LLM이 자산/거래로 추출
  const handleAiExtract = useCallback(async () => {
    if (!llmGrid) return
    setAiExtracting(true)
    try {
      const res = await fetch('/api/ai/extract-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid: llmGrid }),
      })
      const result = await res.json()

      if (result.kind === 'assets' && Array.isArray(result.assets) && result.assets.length > 0) {
        const balances: AccountBalance[] = result.assets.map((a: { name: string; balance: number; type: AccountBalance['type'] }) => ({
          name: a.name, balance: a.balance, type: a.type,
        }))
        setExcludedAccountNames(new Set())
        setAccountBalances(balances)
        setRows([]); setColMap(null); setDetectedPreset(null)
        setAssetTemplate({
          name: 'AI 인식 (자산)', count: balances.length, latestLabel: null,
          periods: [{ yearMonth: result.yearMonth ?? null, label: 'AI', rows: result.assets }],
          monthlyCount: 0,   // 단일 시점 — 추이 import 안 함(LLM 추정이라 보수적)
        })
        setUploadMode('assets')
        toast.success('AI가 자산으로 읽었어요.', { description: `${balances.length}건 — 확인 후 등록하세요.` })
      } else if (result.kind === 'transactions' && result.colMap) {
        const next = result.colMap as ColMap
        setColMap(next)
        setRows(rawData.map(r => mapRow(r, next, visibility)))
        setAiStatus('pending')
        toast.success('AI가 거래 내역으로 읽었어요.', { description: '컬럼 매핑을 확인 후 등록하세요.' })
      } else {
        toast.error('AI도 양식을 인식하지 못했어요.', { description: '아래 헤더 셀렉트에서 직접 지정해 주세요.' })
      }
    } catch {
      toast.error('AI 추출 중 오류가 발생했어요.')
    } finally {
      setAiExtracting(false)
    }
  }, [llmGrid, rawData, visibility])

  // Phase 3b — "AI로 읽기"(이미지): 스크린샷을 vision으로 자산 추출
  const handleAiExtractImage = useCallback(async () => {
    if (!pendingImage) return
    setAiExtracting(true)
    try {
      const res = await fetch('/api/ai/extract-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: pendingImage }),
      })
      const result = await res.json()

      if (result.kind === 'assets' && Array.isArray(result.assets) && result.assets.length > 0) {
        const balances: AccountBalance[] = result.assets.map((a: { name: string; balance: number; type: AccountBalance['type'] }) => ({
          name: a.name, balance: a.balance, type: a.type,
        }))
        setExcludedAccountNames(new Set())
        setAccountBalances(balances)
        setRows([]); setColMap(null); setDetectedPreset(null)
        setAssetTemplate({
          name: 'AI 인식 (스크린샷)', count: balances.length, latestLabel: null,
          periods: [{ yearMonth: result.yearMonth ?? null, label: 'AI', rows: result.assets }],
          monthlyCount: 0,
        })
        setUploadMode('assets')
        toast.success('AI가 스크린샷에서 자산을 읽었어요.', { description: `${balances.length}건 — 확인 후 등록하세요.` })
      } else {
        toast.error('이미지에서 자산을 인식하지 못했어요.', { description: '잔액이 또렷이 보이는 캡처로 다시 시도해 주세요.' })
      }
    } catch {
      toast.error('AI 이미지 추출 중 오류가 발생했어요.')
    } finally {
      setAiExtracting(false)
    }
  }, [pendingImage])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleReset = () => {
    setFileName(null); setDetectedPreset(null); setIsBanksalad(false)
    setAssetTemplate(null)
    setBanksaladMeta(null); setColMap(null); setRawData([])
    setRows([]); setRawHeaders([]); setAiStatus('idle'); setAiMappedCount(0)
    setAccountBalances([]); setDbAccounts([]); setExcludedAccountNames(new Set())
    setAvailableMonths([]); setSelectedMonths(new Set())
    setUploadMode('cashflow')
    setLlmGrid(null); setAiExtracting(false); setPendingImage(null)
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
    const startedAt = Date.now()
    try {
      // 사용자가 unchecked한 항목은 동기화에서 제외
      const filteredBalances = accountBalances.filter(ab => !excludedAccountNames.has(ab.name))

      // ── 자산만 업데이트 모드 ──
      if (uploadMode === 'assets') {
        // 자산 템플릿 import는 미매칭 계좌 자동 생성 (신규 사용자 순자산 통째 등록)
        const result = await syncAccountBalancesOnly(familyId, userId, filteredBalances, { fileName: fileName ?? undefined, autoCreate: !!assetTemplate })
        if (result.success) {
          const skipCount = result.skipped?.length ?? 0

          // 월별 스냅샷이 2개↑면 순자산 추이로 일괄 import (최신달은 위 현재잔액 겸용)
          let historyCount = 0
          if (assetTemplate && assetTemplate.monthlyCount > 1) {
            const snaps = assetTemplate.periods
              .filter(p => p.yearMonth)
              .map(p => ({ yearMonth: p.yearMonth as string, ...aggregateSnapshot(p.rows) }))
            const hist = await importNetWorthSnapshots(snaps)
            if (hist.success) historyCount = hist.importedCount ?? 0
          }

          const histDesc = historyCount > 0 ? ` · 순자산 추이 ${historyCount}개월 등록` : ''
          if (skipCount > 0) {
            toast.success(`계좌 잔액 ${result.syncedCount}개 업데이트 완료${histDesc}`, {
              description: `계좌를 찾지 못한 ${skipCount}건은 건너뛰었어요. 자산 페이지에서 계좌를 추가한 뒤 다시 업로드해 주세요.`,
            })
          } else {
            toast.success(`계좌 잔액 ${result.syncedCount}개 업데이트 완료${histDesc}`)
          }
          track('excel_upload_completed', {
            upload_mode: 'assets',
            row_count: 0,
            account_count: result.syncedCount ?? 0,
            skipped_sync_count: skipCount,
            duration_ms: Date.now() - startedAt,
            // person property — 최초 1회만 기록 (is_first_upload 판정, spec posthog-metrics)
            $set_once: { first_upload_at: new Date().toISOString() },
          })
          handleClose(); onSuccess()
        } else {
          toast.error(result.error ?? '잔액 업데이트에 실패했습니다.')
        }
        return
      }

      // ── 현금흐름 포함 모드 ──
      if (validRows.length === 0) {
        // 신규 거래 없어도 both 모드에서 자산 잔액은 업데이트
        if (uploadMode === 'both' && filteredBalances.length > 0) {
          const result = await syncAccountBalancesOnly(familyId, userId, filteredBalances, { fileName: fileName ?? undefined })
          if (result.success) {
            const skipCount = result.skipped?.length ?? 0
            const baseDesc = '새로 등록할 거래 내역이 없습니다.'
            const desc = skipCount > 0 ? `${baseDesc} 계좌를 찾지 못한 ${skipCount}건은 건너뛰었어요. 자산 페이지에서 계좌를 추가한 뒤 다시 업로드해 주세요.` : baseDesc
            toast.success(`계좌 잔액 ${result.syncedCount}개 업데이트 완료`, { description: desc })
            track('excel_upload_completed', {
              upload_mode: 'both_assets_only',
              row_count: 0,
              account_count: result.syncedCount ?? 0,
              skipped_sync_count: skipCount,
              duration_ms: Date.now() - startedAt,
              // person property — 최초 1회만 기록 (is_first_upload 판정, spec posthog-metrics)
              $set_once: { first_upload_at: new Date().toISOString() },
            })
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
        ...(uploadMode === 'both' && filteredBalances.length > 0 ? { accountBalances: filteredBalances } : {}),
        ...(fileName ? { fileName } : {}),
      }
      const result = await createManyTransactions(userId, familyId, submitRows, submitOptions)

      if (result.success) {
        const total = validRows.length
        const saved = result.count ?? 0
        const skipped = result.skippedCount ?? 0
        const skippedSyncCount = result.skippedSync?.length ?? 0
        const syncPart = result.syncedAccountCount
          ? `${result.syncedAccountCount}개 계좌 잔액 동기화`
          : null

        const dupDesc = skipped > 0
          ? `총 ${total}건 중 ${skipped}건은 이미 존재하여 무시됨`
          : null
        const syncSkipDesc = skippedSyncCount > 0
          ? `매칭 안 된 계좌 ${skippedSyncCount}개는 신규 자동 생성 차단 — 자산 페이지에서 직접 추가 후 다시 업로드하세요.`
          : null

        if (saved === 0) {
          const desc = [dupDesc, syncSkipDesc].filter(Boolean).join(' · ') || undefined
          toast.info('모든 내역이 이미 등록되어 있습니다.', { description: desc })
        } else {
          const stats = result.monthStats ?? []
          let title = ''
          if (syncPart) title += `${syncPart}, `
          title += `${saved}건 등록 완료`

          const parts: string[] = []
          if (dupDesc) parts.push(dupDesc)
          if (stats.length === 1) {
            const s = stats[0]
            parts.push(`수입 ${new Intl.NumberFormat('ko-KR').format(s.income)}원 · 지출 ${new Intl.NumberFormat('ko-KR').format(s.expense)}원`)
          } else if (stats.length > 1) {
            parts.push(`${stats[0].month} ~ ${stats[stats.length - 1].month}`)
          }
          if (syncSkipDesc) parts.push(syncSkipDesc)

          toast.success(title, { description: parts.join(' · ') || undefined })
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

        track('excel_upload_completed', {
          upload_mode: uploadMode,
          row_count: saved,
          duplicate_row_count: skipped,
          account_count: result.syncedAccountCount ?? 0,
          skipped_sync_count: skippedSyncCount,
          duration_ms: Date.now() - startedAt,
          // person property — 최초 1회만 기록 (is_first_upload 판정, spec posthog-metrics)
          $set_once: { first_upload_at: new Date().toISOString() },
        })
        handleClose(); onSuccess()
      } else {
        toast.error(result.error ?? '등록에 실패했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 거래(rows) 또는 자산 잔액(accountBalances) 또는 대기 이미지 중 하나라도 있으면 로드됨.
  // 자산 템플릿(부자공식·대차대조표)은 거래 0건 + 잔액만이라 accountBalances로 판정.
  const hasFile = rows.length > 0 || accountBalances.length > 0 || !!pendingImage
  // 이미지 추출 전 상태 — 전용 UI(썸네일+AI버튼)만 보이고 일반 컨텐츠는 숨김
  const imagePreExtract = !!pendingImage && accountBalances.length === 0
  const headerOptions = ['', ...rawHeaders]

  return (
    <Drawer open={isOpen} onOpenChange={v => { if (!v) handleClose() }}>
      <DrawerContent className="bg-background border-t border-border max-h-[92vh] flex flex-col">
        <DrawerHeader className="shrink-0 pb-2">
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
                <p className="text-sm font-medium text-foreground">파일·스크린샷을 드래그하거나 탭해서 선택</p>
                <p className="text-xs text-muted-foreground mt-1">엑셀(뱅샐·신한·KB·카카오페이·하나·우리) · 자산 캡처 이미지</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
            </div>
            </>
          ) : imagePreExtract ? (
            <>
              {/* ── 이미지(스크린샷) 추출 전 — 썸네일 + AI로 읽기 ── */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-ai-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">자산 캡처 이미지</p>
                </div>
                <button onClick={handleReset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {pendingImage && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={pendingImage} alt="업로드한 자산 캡처" className="w-full max-h-72 object-contain rounded-xl border border-border bg-muted/30" />
              )}

              <div className="space-y-1.5">
                <button
                  onClick={handleAiExtractImage}
                  disabled={aiExtracting}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors',
                    aiExtracting
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-ai-500 text-white hover:bg-ai-600 dark:bg-ai-600 dark:hover:bg-ai-500'
                  )}
                >
                  {aiExtracting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />AI가 읽는 중...</>
                    : <><Sparkles className="w-4 h-4" />AI로 자산 읽기</>}
                </button>
                <p className="text-[10px] text-muted-foreground/60 text-center">
                  AI 분석 시 이미지가 OpenAI를 경유합니다 · 읽은 결과는 등록 전 확인할 수 있어요
                </p>
              </div>
            </>
          ) : (
            <>
              {/* ── 파일 정보 ── */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <FileSpreadsheet className={cn("w-4 h-4", isBanksalad ? "text-ai-400" : "text-income")} />
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
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-ai-50 dark:bg-ai-950/30 border border-ai-300 dark:border-ai-700/40">
                  <Sparkles className="w-4 h-4 text-ai-500 dark:text-ai-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ai-700 dark:text-ai-300">뱅크샐러드 양식이 감지되었습니다</p>
                    <p className="text-[11px] text-ai-500 dark:text-ai-700 mt-0.5">
                      시트: {banksaladMeta?.sheet} · 날짜·시간·대분류·소분류 자동 매핑
                    </p>
                    {banksaladMeta?.skipped ? (
                      <div className="flex items-center gap-1 mt-1">
                        <SkipForward className="w-3 h-3 text-muted-foreground" />
                        <p className="text-[11px] text-muted-foreground">&ldquo;이체&rdquo; {banksaladMeta.skipped}건 자동 제외</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : assetTemplate ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-ai-50 dark:bg-ai-950/30 border border-ai-300 dark:border-ai-700/40">
                  <Sparkles className="w-4 h-4 text-ai-500 dark:text-ai-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ai-700 dark:text-ai-300">{assetTemplate.name} 양식이 감지되었습니다</p>
                    <p className="text-[11px] text-ai-500 dark:text-ai-700 mt-0.5">
                      {assetTemplate.monthlyCount > 1
                        ? `${assetTemplate.latestLabel ?? '최신'} 기준 ${assetTemplate.count}건 · 순자산 추이 ${assetTemplate.monthlyCount}개월 함께 등록`
                        : `자산·부채 ${assetTemplate.count}건 추출 · 현금·투자·부동산·연금·부채 자동 분류`}
                    </p>
                  </div>
                </div>
              ) : detectedPreset ? (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40">
                  <Sparkles className="w-4 h-4 text-income shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-income">{detectedPreset.name} 양식 감지됨</p>
                    <p className="text-[10px] text-income dark:text-income mt-0.5">{detectedPreset.description}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-card border border-border space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">양식 자동 감지 실패 — AI로 읽거나 아래 헤더에서 직접 지정하세요</p>
                  </div>
                  {llmGrid && (
                    <div className="space-y-1.5">
                      <button
                        onClick={handleAiExtract}
                        disabled={aiExtracting}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-semibold transition-colors',
                          aiExtracting
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-ai-500 text-white hover:bg-ai-600 dark:bg-ai-600 dark:hover:bg-ai-500'
                        )}
                      >
                        {aiExtracting
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />AI가 읽는 중...</>
                          : <><Sparkles className="w-3.5 h-3.5" />AI로 읽기</>}
                      </button>
                      <p className="text-[10px] text-muted-foreground/60 text-center">
                        AI 분석 시 시트 데이터가 OpenAI를 경유합니다
                      </p>
                    </div>
                  )}
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
                        aria-pressed={uploadMode === opt.value}
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
              {(isBanksalad || assetTemplate) && accountBalances.length > 0 && uploadMode !== 'cashflow' && (
                <section className="rounded-xl border border-border overflow-hidden">
                  <header className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                    <span className="text-base">🏦</span>
                    <span className="text-xs font-semibold text-foreground/80">자산 — 계좌 잔액 변경</span>
                  </header>
                  <div className="p-3">
                    <AccountBalanceDiff
                      accountBalances={accountBalances}
                      dbAccounts={dbAccounts}
                      excludedNames={excludedAccountNames}
                      onToggle={name => setExcludedAccountNames(prev => {
                        const next = new Set(prev)
                        if (next.has(name)) next.delete(name)
                        else next.add(name)
                        return next
                      })}
                      onToggleAll={allOn => {
                        if (allOn) setExcludedAccountNames(new Set())
                        else setExcludedAccountNames(new Set(listToggleableBalanceNames(accountBalances, dbAccounts)))
                      }}
                    />
                  </div>
                </section>
              )}

              {/* ── 오류 안내 ── */}
              {errorRows.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40">
                  <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
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
          <DrawerFooter className="shrink-0 pt-0 px-4 pb-6 space-y-2">
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
              {(() => {
                // holding 매칭(서버 skip) 제외 + 사용자 unchecked 제외 = 실제 등록될 개수
                const toggleable = new Set(listToggleableBalanceNames(accountBalances, dbAccounts))
                const syncCount = accountBalances.filter(ab => toggleable.has(ab.name) && !excludedAccountNames.has(ab.name)).length
                if (isLoading) return <><Loader2 className="w-4 h-4 animate-spin" />{uploadMode === 'assets' ? '업데이트 중...' : '등록 중...'}</>
                if (uploadMode === 'assets') return `계좌 잔액 ${syncCount}개 업데이트`
                if (validRows.length === 0 && uploadMode === 'both' && syncCount > 0) return `계좌 잔액 ${syncCount}개 업데이트`
                if (aiStatus === 'pending') return `${validRows.length}건 등록하기 (분류 생략)`
                return `${validRows.length}건 등록하기`
              })()}
            </button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}


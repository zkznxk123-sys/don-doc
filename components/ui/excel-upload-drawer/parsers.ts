/**
 * excel-upload-drawer 범용 파싱 유틸.
 * XLSX serial date·일반 string 날짜·금액 string·row → ParsedRow 변환.
 */

import * as XLSX from 'xlsx'
import type { BulkTransactionRow } from '@/lib/actions/transaction'
import type { ColMap } from '@/constants/excel-presets'

export interface ParsedRow extends BulkTransactionRow {
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

export type AiStatus = 'idle' | 'pending' | 'loading' | 'done' | 'error' | 'skipped'
export type UploadMode = 'both' | 'cashflow' | 'assets'

export function parseDate(raw: unknown): string {
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

export function parseNum(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return NaN
  if (typeof raw === 'number') return raw
  return parseFloat(String(raw).replace(/[,\s원+]/g, ''))
}

export function mapRow(raw: Record<string, unknown>, col: ColMap, visibility: 'SHARED' | 'PRIVATE'): ParsedRow {
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

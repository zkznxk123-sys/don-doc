import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// 금액을 한국어 단위로 변환 (예: 866000000 → "8억 6,600만원")
export function toKoreanUnit(amount: number): string {
  if (!amount || amount === 0) return ''
  const eok  = Math.floor(amount / 100_000_000)
  const man  = Math.floor((amount % 100_000_000) / 10_000)
  const rest = amount % 10_000
  const parts: string[] = []
  if (eok  > 0) parts.push(`${eok.toLocaleString()}억`)
  if (man  > 0) parts.push(`${man.toLocaleString()}만`)
  if (rest > 0) parts.push(rest.toLocaleString())
  return parts.join(' ') + '원'
}

export function formatLargeNumber(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`
  } else if (amount >= 10000) {
    return `${(amount / 10000).toFixed(1)}만`
  }
  return amount.toString()
}

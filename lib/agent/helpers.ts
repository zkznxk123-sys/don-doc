// lib/agent/tools.ts에서 사용하는 작은 헬퍼들.
// 도메인별 tool 파일에서 공통으로 재사용.

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

export function ymRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number)
  return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
}

export function dateRange(from: string, to: string): { gte: Date; lt: Date } {
  const gte = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  toDate.setUTCDate(toDate.getUTCDate() + 1)
  return { gte, lt: toDate }
}

export function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

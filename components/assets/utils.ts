/** 마켓에 따라 Yahoo Finance 티커로 변환 */
export function toYahooTicker(ticker: string, market: string | null): string {
  if (ticker.includes('.')) return ticker // 이미 접미사 포함
  if (market === 'KOSPI' || market === 'KRX') return `${ticker}.KS`
  if (market === 'KOSDAQ') return `${ticker}.KQ`
  // ETF: 숫자 포함(한국 코드)이면 .KS, 순수 알파벳(SPY, QQQ 등)이면 그대로
  if (market === 'ETF') return /\d/.test(ticker) ? `${ticker}.KS` : ticker
  return ticker // NASDAQ, NYSE, CRYPTO, 기타 등은 그대로
}

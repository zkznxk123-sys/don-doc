import { describe, it, expect } from 'vitest'
import { toYahooTicker } from './utils'

describe('toYahooTicker', () => {
  it('returns ticker as-is when it already contains a dot suffix', () => {
    expect(toYahooTicker('AAPL.US', null)).toBe('AAPL.US')
    expect(toYahooTicker('005930.KS', 'KOSPI')).toBe('005930.KS')
  })

  it('appends .KS for KOSPI/KRX', () => {
    expect(toYahooTicker('005930', 'KOSPI')).toBe('005930.KS')
    expect(toYahooTicker('005930', 'KRX')).toBe('005930.KS')
  })

  it('appends .KQ for KOSDAQ', () => {
    expect(toYahooTicker('123456', 'KOSDAQ')).toBe('123456.KQ')
  })

  it('ETF: numeric → .KS, pure-alpha → as-is', () => {
    expect(toYahooTicker('360750', 'ETF')).toBe('360750.KS')
    expect(toYahooTicker('SPY', 'ETF')).toBe('SPY')
    expect(toYahooTicker('QQQ', 'ETF')).toBe('QQQ')
  })

  it('returns ticker as-is for NASDAQ/NYSE/CRYPTO', () => {
    expect(toYahooTicker('AAPL', 'NASDAQ')).toBe('AAPL')
    expect(toYahooTicker('TSLA', 'NYSE')).toBe('TSLA')
    expect(toYahooTicker('BTC-USD', 'CRYPTO')).toBe('BTC-USD')
  })

  it('returns ticker as-is when market is null', () => {
    expect(toYahooTicker('AAPL', null)).toBe('AAPL')
  })
})

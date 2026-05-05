/**
 * 종목 universe — chat agent의 screenUniverse 도구가 검색 대상으로 쓰는 정적 list.
 *
 * 한국 KOSPI/KOSDAQ 시총 상위 + 미국 S&P/NASDAQ 대표 종목.
 * 갱신은 수동 — 새 종목 추가하거나 상장폐지된 종목 제거할 때 직접 수정.
 *
 * yahooTicker 형식:
 *  - 한국: {6자리}.KS (KOSPI) 또는 {6자리}.KQ (KOSDAQ)
 *  - 미국: 그냥 ticker (AAPL, MSFT 등)
 */

export interface UniverseStock {
  yahooTicker: string
  name: string
  market: 'KOSPI' | 'KOSDAQ' | 'NASDAQ' | 'NYSE'
  /** 한국 종목 — DART 보강용 6자리 종목코드 */
  stockCode?: string
}

// ── 한국 — 시총 상위 30종목 ──────────────────────────────────────────────────
export const UNIVERSE_KR: UniverseStock[] = [
  { yahooTicker: '005930.KS', name: '삼성전자',         market: 'KOSPI', stockCode: '005930' },
  { yahooTicker: '000660.KS', name: 'SK하이닉스',       market: 'KOSPI', stockCode: '000660' },
  { yahooTicker: '207940.KS', name: '삼성바이오로직스', market: 'KOSPI', stockCode: '207940' },
  { yahooTicker: '373220.KS', name: 'LG에너지솔루션',   market: 'KOSPI', stockCode: '373220' },
  { yahooTicker: '005380.KS', name: '현대차',           market: 'KOSPI', stockCode: '005380' },
  { yahooTicker: '035420.KS', name: 'NAVER',            market: 'KOSPI', stockCode: '035420' },
  { yahooTicker: '000270.KS', name: '기아',             market: 'KOSPI', stockCode: '000270' },
  { yahooTicker: '105560.KS', name: 'KB금융',           market: 'KOSPI', stockCode: '105560' },
  { yahooTicker: '055550.KS', name: '신한지주',         market: 'KOSPI', stockCode: '055550' },
  { yahooTicker: '005490.KS', name: 'POSCO홀딩스',      market: 'KOSPI', stockCode: '005490' },
  { yahooTicker: '035720.KS', name: '카카오',           market: 'KOSPI', stockCode: '035720' },
  { yahooTicker: '006400.KS', name: '삼성SDI',          market: 'KOSPI', stockCode: '006400' },
  { yahooTicker: '028260.KS', name: '삼성물산',         market: 'KOSPI', stockCode: '028260' },
  { yahooTicker: '012330.KS', name: '현대모비스',       market: 'KOSPI', stockCode: '012330' },
  { yahooTicker: '015760.KS', name: '한국전력',         market: 'KOSPI', stockCode: '015760' },
  { yahooTicker: '017670.KS', name: 'SK텔레콤',         market: 'KOSPI', stockCode: '017670' },
  { yahooTicker: '032830.KS', name: '삼성생명',         market: 'KOSPI', stockCode: '032830' },
  { yahooTicker: '009150.KS', name: '삼성전기',         market: 'KOSPI', stockCode: '009150' },
  { yahooTicker: '018260.KS', name: '삼성에스디에스',   market: 'KOSPI', stockCode: '018260' },
  { yahooTicker: '066570.KS', name: 'LG전자',           market: 'KOSPI', stockCode: '066570' },
  { yahooTicker: '003670.KS', name: '포스코퓨처엠',     market: 'KOSPI', stockCode: '003670' },
  { yahooTicker: '024110.KS', name: '기업은행',         market: 'KOSPI', stockCode: '024110' },
  { yahooTicker: '033780.KS', name: 'KT&G',             market: 'KOSPI', stockCode: '033780' },
  { yahooTicker: '138040.KS', name: '메리츠금융지주',   market: 'KOSPI', stockCode: '138040' },
  { yahooTicker: '000810.KS', name: '삼성화재',         market: 'KOSPI', stockCode: '000810' },
  { yahooTicker: '352820.KS', name: '하이브',           market: 'KOSPI', stockCode: '352820' },
  { yahooTicker: '047810.KS', name: '한국항공우주',     market: 'KOSPI', stockCode: '047810' },
  { yahooTicker: '326030.KS', name: 'SK바이오팜',       market: 'KOSPI', stockCode: '326030' },
  { yahooTicker: '030200.KS', name: 'KT',               market: 'KOSPI', stockCode: '030200' },
  { yahooTicker: '068270.KS', name: '셀트리온',         market: 'KOSPI', stockCode: '068270' },
]

// ── 미국 — 시총 상위 + 인기 종목 ~50 ─────────────────────────────────────────
export const UNIVERSE_US: UniverseStock[] = [
  { yahooTicker: 'AAPL',  name: 'Apple',                market: 'NASDAQ' },
  { yahooTicker: 'MSFT',  name: 'Microsoft',            market: 'NASDAQ' },
  { yahooTicker: 'GOOGL', name: 'Alphabet (Class A)',   market: 'NASDAQ' },
  { yahooTicker: 'AMZN',  name: 'Amazon',               market: 'NASDAQ' },
  { yahooTicker: 'NVDA',  name: 'Nvidia',               market: 'NASDAQ' },
  { yahooTicker: 'META',  name: 'Meta Platforms',       market: 'NASDAQ' },
  { yahooTicker: 'TSLA',  name: 'Tesla',                market: 'NASDAQ' },
  { yahooTicker: 'BRK-B', name: 'Berkshire Hathaway B', market: 'NYSE' },
  { yahooTicker: 'JPM',   name: 'JPMorgan Chase',       market: 'NYSE' },
  { yahooTicker: 'V',     name: 'Visa',                 market: 'NYSE' },
  { yahooTicker: 'UNH',   name: 'UnitedHealth Group',   market: 'NYSE' },
  { yahooTicker: 'JNJ',   name: 'Johnson & Johnson',    market: 'NYSE' },
  { yahooTicker: 'WMT',   name: 'Walmart',              market: 'NYSE' },
  { yahooTicker: 'XOM',   name: 'ExxonMobil',           market: 'NYSE' },
  { yahooTicker: 'PG',    name: 'Procter & Gamble',     market: 'NYSE' },
  { yahooTicker: 'MA',    name: 'Mastercard',           market: 'NYSE' },
  { yahooTicker: 'HD',    name: 'Home Depot',           market: 'NYSE' },
  { yahooTicker: 'LLY',   name: 'Eli Lilly',            market: 'NYSE' },
  { yahooTicker: 'AVGO',  name: 'Broadcom',             market: 'NASDAQ' },
  { yahooTicker: 'CVX',   name: 'Chevron',              market: 'NYSE' },
  { yahooTicker: 'ABBV',  name: 'AbbVie',               market: 'NYSE' },
  { yahooTicker: 'MRK',   name: 'Merck',                market: 'NYSE' },
  { yahooTicker: 'KO',    name: 'Coca-Cola',            market: 'NYSE' },
  { yahooTicker: 'PEP',   name: 'PepsiCo',              market: 'NASDAQ' },
  { yahooTicker: 'COST',  name: 'Costco',               market: 'NASDAQ' },
  { yahooTicker: 'ADBE',  name: 'Adobe',                market: 'NASDAQ' },
  { yahooTicker: 'NFLX',  name: 'Netflix',              market: 'NASDAQ' },
  { yahooTicker: 'CRM',   name: 'Salesforce',           market: 'NYSE' },
  { yahooTicker: 'TMO',   name: 'Thermo Fisher',        market: 'NYSE' },
  { yahooTicker: 'ORCL',  name: 'Oracle',               market: 'NYSE' },
  { yahooTicker: 'ASML',  name: 'ASML',                 market: 'NASDAQ' },
  { yahooTicker: 'TXN',   name: 'Texas Instruments',    market: 'NASDAQ' },
  { yahooTicker: 'CSCO',  name: 'Cisco',                market: 'NASDAQ' },
  { yahooTicker: 'ACN',   name: 'Accenture',            market: 'NYSE' },
  { yahooTicker: 'AMD',   name: 'AMD',                  market: 'NASDAQ' },
  { yahooTicker: 'NKE',   name: 'Nike',                 market: 'NYSE' },
  { yahooTicker: 'DIS',   name: 'Disney',               market: 'NYSE' },
  { yahooTicker: 'INTC',  name: 'Intel',                market: 'NASDAQ' },
  { yahooTicker: 'MCD',   name: "McDonald's",           market: 'NYSE' },
  { yahooTicker: 'PM',    name: 'Philip Morris',        market: 'NYSE' },
  { yahooTicker: 'ABT',   name: 'Abbott',               market: 'NYSE' },
  { yahooTicker: 'LIN',   name: 'Linde',                market: 'NYSE' },
  { yahooTicker: 'QCOM',  name: 'Qualcomm',             market: 'NASDAQ' },
  { yahooTicker: 'WFC',   name: 'Wells Fargo',          market: 'NYSE' },
  { yahooTicker: 'CAT',   name: 'Caterpillar',          market: 'NYSE' },
  { yahooTicker: 'GS',    name: 'Goldman Sachs',        market: 'NYSE' },
  { yahooTicker: 'PFE',   name: 'Pfizer',               market: 'NYSE' },
  { yahooTicker: 'INTU',  name: 'Intuit',               market: 'NASDAQ' },
  { yahooTicker: 'AMGN',  name: 'Amgen',                market: 'NASDAQ' },
  { yahooTicker: 'IBM',   name: 'IBM',                  market: 'NYSE' },
]

export const UNIVERSE_ALL: UniverseStock[] = [...UNIVERSE_KR, ...UNIVERSE_US]

export function findInUniverse(yahooTicker: string): UniverseStock | undefined {
  return UNIVERSE_ALL.find(s => s.yahooTicker === yahooTicker)
}

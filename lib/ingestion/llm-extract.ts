/**
 * Phase 3a — LLM 의미추출 폴백.
 *
 * 결정형 어댑터(부자공식·대차대조표·6은행 프리셋)가 못 잡는 임의 엑셀을
 * LLM이 읽어 표준 포맷으로 변환. 두 갈래:
 *  - assets:       자산 스냅샷(2D·불규칙) → 값 직접 추출(AssetRow[])
 *  - transactions: 거래 리스트(행=레코드) → 컬럼 매핑만 추론(ColMap),
 *                  실제 변환은 호출부가 로컬 mapRow로 (싸고 무한행)
 *
 * chatJSON(lib/ai) 재사용 — JSON 추출 + zod 검증 내장, 프로바이더 무관.
 */
import { z } from 'zod'
import { chatJSON, chatVisionJSON, type AiMode } from '@/lib/ai'
import type { AssetRow } from '@/utils/asset-templates/types'

/** LLM에 보낼 시트 샘플 최대 행 수. 자산 시트(대부분 <60)는 전체, 거래는 헤더+샘플로 충분. */
export const LLM_SAMPLE_ROWS = 60
/** 셀 1개 최대 길이(토큰 절약). */
const CELL_CAP = 40

const AssetRowSchema = z.object({
  name: z.string().min(1),
  balance: z.number(),
  type: z.enum(['CASH', 'INVESTMENT', 'PENSION', 'REAL_ESTATE', 'DEBT']),
  // LLM이 카테고리 없을 때 "" 대신 null을 반환하는 경우가 잦다. .default()는 undefined에만
  // 적용돼 null이면 parse 실패 → 추출 전체가 unknown으로 뭉개졌다(2026-06-28 E2E 발견).
  // null 허용 후 shapeAssets에서 `?? ''`로 정규화. extract-image도 이 스키마 공유.
  sourceCategory: z.string().nullable().optional().default(''),
})

const ColMapSchema = z.object({
  date: z.string().nullable(),
  description: z.string().nullable(),
  amount: z.string().nullable(),
  withdraw: z.string().nullable(),
  deposit: z.string().nullable(),
  category: z.string().nullable(),
})

/** LLM 응답 스키마 — kind로 갈래 구분(자산값 / 거래컬럼매핑 / 판별불가). */
const ExtractSchema = z.object({
  kind: z.enum(['assets', 'transactions', 'unknown']),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  assets: z.array(AssetRowSchema).optional(),
  colMap: ColMapSchema.optional(),
})

export type LlmExtractResult =
  | { kind: 'assets'; yearMonth: string | null; assets: AssetRow[] }
  | { kind: 'transactions'; colMap: z.infer<typeof ColMapSchema> }
  | { kind: 'unknown' }

/** 2D 시트를 LLM용 compact 텍스트 그리드로 직렬화. 빈 행 제거, 셀 cap. */
export function serializeGrid(rows: unknown[][], maxRows = LLM_SAMPLE_ROWS): string {
  return rows
    .slice(0, maxRows)
    .map((r, i) => {
      const cells = (r ?? []).map(c => String(c ?? '').replace(/\s+/g, ' ').trim().slice(0, CELL_CAP))
      if (cells.every(c => c === '')) return null
      return `[${i}] ${cells.join(' | ')}`
    })
    .filter(Boolean)
    .join('\n')
}

function buildPrompt(grid: string): string {
  return `너는 한국 가계부/자산관리 엑셀을 읽는 데이터 추출 AI다. 아래는 한 시트의 상위 행을 [행번호] 셀 | 셀 ... 형식으로 직렬화한 것이다.

이 시트가 (1) **자산 스냅샷**(현금·예금·주식·부동산·연금·대출 등 잔액 목록)인지, (2) **거래 리스트**(날짜별 수입/지출 내역)인지 판단하고 추출하라.

## 시트
${grid}

## 출력 규칙
- 자산 스냅샷이면 kind="assets", assets 배열로. 각 항목:
  - name: 계좌/항목명
  - balance: 금액(양수. 대출·부채도 양수 magnitude)
  - type: CASH(현금·예금·적금·CMA) | INVESTMENT(주식·펀드·청약·코인·외화) | PENSION(국민연금·퇴직연금·IRP·연금저축) | REAL_ESTATE(아파트·부동산·전세/월세보증금) | DEBT(대출·마이너스통장·신용카드잔액·임대보증금부채)
  - sourceCategory: 원본 구분 텍스트
  - 소계·합계·비율 행은 제외. 금액 0/빈칸 제외.
  - 시트에서 기준 연월을 읽을 수 있으면 yearMonth="YYYY-MM", 없으면 null.
- 거래 리스트면 kind="transactions", colMap으로 컬럼 헤더명을 매핑(없으면 null):
  - date(거래일), description(내용/적요), amount(부호포함 단일금액) 또는 withdraw/deposit(출금/입금 분리), category(분류)
- 어느 쪽도 아니면 kind="unknown".

응답은 JSON만.`
}

/**
 * 시트 그리드를 LLM으로 추출. assets면 값 직접, transactions면 colMap.
 * sanity 통과 못 하면 kind='unknown'.
 */
export async function extractSheetWithLLM(
  rows: unknown[][],
  opts: { mode: AiMode; sessionId?: string },
): Promise<LlmExtractResult> {
  const grid = serializeGrid(rows)
  if (!grid.trim()) return { kind: 'unknown' }

  const parsed = await chatJSON(
    [{ role: 'user', content: buildPrompt(grid) }],
    ExtractSchema,
    { mode: opts.mode, sessionId: opts.sessionId, tier: 'fast', temperature: 0.1, maxTokens: 3000, timeoutMs: 45_000 },
  )

  if (parsed.kind === 'assets') {
    return shapeAssets(parsed.assets, parsed.yearMonth ?? null)
  }

  if (parsed.kind === 'transactions' && parsed.colMap) {
    const c = parsed.colMap
    // 최소 sanity: 날짜 + (금액 or 출금/입금) 컬럼이 있어야 거래로 인정
    const hasAmount = !!(c.amount || c.withdraw || c.deposit)
    if (!c.date || !hasAmount) return { kind: 'unknown' }
    return { kind: 'transactions', colMap: c }
  }

  return { kind: 'unknown' }
}

/** LLM 자산 배열 → 표준 AssetRow[] (양수·uncertain·0/빈값 제외). 텍스트·이미지 공용. */
function shapeAssets(
  raw: Array<{ name: string; balance: number; type: AssetRow['type']; sourceCategory?: string | null }> | undefined,
  yearMonth: string | null,
): LlmExtractResult {
  const assets: AssetRow[] = (raw ?? [])
    .filter(a => a.name.trim() && Number.isFinite(a.balance) && a.balance !== 0)
    .map(a => ({
      name: a.name,
      balance: Math.abs(a.balance),
      type: a.type,
      sourceCategory: a.sourceCategory ?? '',
      uncertain: true,   // LLM 추정 → uncertain
    }))
  if (assets.length === 0) return { kind: 'unknown' }
  return { kind: 'assets', yearMonth, assets }
}

// ─── 3b: 스크린샷(vision) 자산 추출 ──────────────────────────────────────
// 스코프 = 자산 캡처(뱅킹·증권 잔액). 거래내역 스샷은 후속.

const ImageAssetSchema = z.object({
  kind: z.enum(['assets', 'unknown']),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  assets: z.array(AssetRowSchema).optional(),
})

function buildImagePrompt(): string {
  return `너는 한국 금융 앱·문서 스크린샷에서 자산을 읽는 추출 AI다. 이미지에 보이는 계좌·잔액·보유자산을 빠짐없이 읽어라.

## 출력 규칙
- 자산/잔액이 보이면 kind="assets", assets 배열:
  - name: 계좌/항목명 (은행·증권사·상품명 등 보이는 그대로)
  - balance: 숫자만, 항상 양수 magnitude. 음수·빨간색·괄호 금액도 부호 떼고 양수로.
  - type: CASH(현금·예금·입출금·파킹) | INVESTMENT(주식·펀드·청약·코인·외화) | PENSION(연금·IRP·퇴직) | REAL_ESTATE(부동산·전세/월세보증금) | DEBT(대출·마이너스통장·카드잔액)
  - sourceCategory: 화면에 보이는 분류/구분 텍스트. 외화면 통화(예 "USD"). 없으면 "".
  - 기준 시점 보이면 yearMonth="YYYY-MM", 없으면 null.
- 자산이 안 보이면(거래내역만·무관한 이미지) kind="unknown".

## 반드시 지킬 것
- **마이너스통장·대출·카드빚은 빠뜨리지 말고 DEBT로.** 계좌 **잔액 자체가 음수**(-93,929,060원처럼 빨간 마이너스 잔액)면 type="DEBT", balance=93929060(양수 magnitude). 부채 누락은 순자산을 과대평가시키는 가장 치명적 실수다.
- **단, 손익·수익률은 잔액이 아니다 — DEBT로 착각 금지.** 주식·펀드의 평가손익(예 -297,769원)·수익률(예 -14.66%)이 빨간색이어도 그건 부채가 아니다. 그 종목의 **평가금액(양수, 예 1,732,500원)**을 balance로 쓰고 type은 자산 성격대로(주식·펀드·ETF=INVESTMENT). 빨간 손익 숫자를 balance로 쓰지 마라.
- **외화 자산도 빠뜨리지 마라.** $·USD·달러 등 외화 평가금액이 보이면 그 숫자를 balance로(원화 환산액이 함께 보이면 원화 우선), type=INVESTMENT, sourceCategory에 통화 표기.
- 한 항목에 여러 숫자(평가금액·매입금액·손익·수익률)가 있으면 **평가금액/평가액/잔액**을 balance로. 손익·수익률·단가·수량은 balance가 아니다.
- **한 계좌/종목은 정확히 한 줄.** 같은 이름을 두 번 내지 마라. 특히 종목의 평가금액 줄과 손익 줄을 따로 만들지 말 것 — 평가금액 한 줄만.
- 합계·총자산·총부채 같은 소계 행만 제외. 개별 계좌·종목·항목은 전부 포함.
- 숫자는 추측 금지 — 화면에 명확히 보이는 것만. 정말 안 읽히는 항목만 제외.

응답은 JSON만. 설명·마크다운 금지.`
}

/**
 * 스크린샷 이미지 → 자산 추출 (vision). imageDataUrl = "data:image/...;base64,...".
 * 자산 캡처 전용. HITL 확인 필수(확률적).
 */
export async function extractImageWithLLM(imageDataUrl: string): Promise<LlmExtractResult> {
  const parsed = await chatVisionJSON(imageDataUrl, buildImagePrompt(), ImageAssetSchema, {
    model: 'gpt-4o', temperature: 0.1, maxTokens: 3000, timeoutMs: 60_000,
  })
  if (parsed.kind === 'assets') return shapeAssets(parsed.assets, parsed.yearMonth ?? null)
  return { kind: 'unknown' }
}

'use client'

/**
 * 가벼운 마크다운 렌더러 — 외부 의존성 없이 핵심만 지원.
 * 지원 문법:
 *  - 헤딩: ##, ###
 *  - 불릿: "- " 또는 "* "
 *  - 표: | a | b | / |---|---|
 *  - 강조: **bold**
 *  - 빈 줄로 문단 분리
 *  - 코드 inline: `code`
 *
 * 미지원:
 *  - 링크, 이미지, 코드블록, 인용, 순서 목록
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  text: string
  className?: string
}

/** **bold** + `code` 처리 — span 단위 inline 변환 */
function renderInline(text: string, key: string | number): ReactNode {
  // bold
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      parts.push(<strong key={`${key}-b-${i}`} className="font-semibold">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('`')) {
      parts.push(<code key={`${key}-c-${i}`} className="px-1 py-0.5 rounded bg-muted text-[0.9em] font-mono">{tok.slice(1, -1)}</code>)
    }
    lastIdx = m.index + tok.length
    i++
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}

interface TableData {
  headers: string[]
  rows: string[][]
}

/** "| a | b |" 형식 한 줄 → 셀 배열 */
function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  const inner = trimmed.slice(1, -1)
  return inner.split('|').map(s => s.trim())
}

/** "|---|:---:|---|" 같은 separator 라인인지 */
function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line)
  if (!cells) return false
  return cells.every(c => /^:?-+:?$/.test(c.replace(/\s/g, '')))
}

/**
 * 라인 시퀀스 [i] 부터 표 시작 가능한지 보고, 끝 인덱스 반환. 표 없으면 null.
 * 표 형식: row + separator + row+
 */
function tryParseTable(lines: string[], i: number): { table: TableData; nextI: number } | null {
  const headerCells = parseTableRow(lines[i])
  if (!headerCells) return null
  if (i + 1 >= lines.length || !isTableSeparator(lines[i + 1])) return null

  const headers = headerCells
  const rows: string[][] = []
  let j = i + 2
  while (j < lines.length) {
    const cells = parseTableRow(lines[j])
    if (!cells) break
    // 데이터 row가 column 수가 헤더와 다르면 padding
    while (cells.length < headers.length) cells.push('')
    rows.push(cells.slice(0, headers.length))
    j++
  }
  return { table: { headers, rows }, nextI: j }
}

export function Markdown({ text, className }: Props) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let bulletBuffer: string[] = []
  let paragraphBuffer: string[] = []
  let blockKey = 0

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return
    const buf = bulletBuffer
    blocks.push(
      <ul key={`b-${blockKey++}`} className="list-disc pl-5 space-y-0.5 my-1">
        {buf.map((b, i) => <li key={i}>{renderInline(b, i)}</li>)}
      </ul>
    )
    bulletBuffer = []
  }

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return
    const buf = paragraphBuffer
    blocks.push(
      <p key={`p-${blockKey++}`} className="my-1.5 leading-relaxed whitespace-pre-wrap">
        {buf.map((line, i) => (
          <span key={i}>
            {renderInline(line, i)}
            {i < buf.length - 1 && <br />}
          </span>
        ))}
      </p>
    )
    paragraphBuffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    // 표 시도
    const tableHit = line.startsWith('|') ? tryParseTable(lines, i) : null
    if (tableHit) {
      flushBullets(); flushParagraph()
      const { table, nextI } = tableHit
      blocks.push(
        <div
          key={`t-${blockKey++}`}
          className="my-2 overflow-x-auto -mx-1 px-1 rounded border border-border/40 bg-background/40"
        >
          <table className="text-[11px] border-collapse" style={{ wordBreak: 'keep-all', minWidth: '100%' }}>
            <thead>
              <tr className="border-b border-border">
                {table.headers.map((h, j) => (
                  <th key={j} className="text-left py-1.5 px-2 font-semibold text-muted-foreground/80 whitespace-nowrap">
                    {renderInline(h, j)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/40 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-1.5 px-2 align-top whitespace-nowrap">
                      {renderInline(cell, ci)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      i = nextI - 1
      continue
    }

    if (line.startsWith('## ')) {
      flushBullets(); flushParagraph()
      blocks.push(
        <h4 key={`h-${blockKey++}`} className="text-[12px] font-bold text-foreground/90 mt-2.5 mb-1">
          {renderInline(line.slice(3), 0)}
        </h4>
      )
    } else if (line.startsWith('### ')) {
      flushBullets(); flushParagraph()
      blocks.push(
        <h5 key={`h-${blockKey++}`} className="text-[11px] font-semibold text-foreground/80 mt-2 mb-0.5">
          {renderInline(line.slice(4), 0)}
        </h5>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph()
      bulletBuffer.push(line.slice(2))
    } else if (line === '') {
      flushBullets(); flushParagraph()
    } else {
      flushBullets()
      paragraphBuffer.push(line)
    }
  }
  flushBullets()
  flushParagraph()

  return <div className={cn('text-sm text-foreground/85 leading-relaxed', className)}>{blocks}</div>
}

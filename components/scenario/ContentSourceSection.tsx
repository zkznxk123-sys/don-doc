'use client'

import { useState } from 'react'
import type React from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Link2, Trash2, RefreshCw, AlertTriangle, CheckCircle2,
  Loader2, Plus, ExternalLink, FileText, ChevronDown, Sparkles,
} from 'lucide-react'
import type { ContentSourceData } from '@/lib/actions/scenario'
import { SCENARIO_CATEGORIES } from '@/lib/scenario-constants'
import { categoryStyle } from './utils'

/**
 * 접힌 상태에서 보여줄 줄바꿈 없는 평문. 마크다운 마크업·헤딩 제거.
 */
function plainPreview(md: string): string {
  return md
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.replace(/^[-*]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1'))
    .join(' · ')
}

/**
 * 가벼운 마크다운 렌더러 — ##/### 헤딩, "- " 불릿, 빈 줄로 문단 구분만 지원.
 * 외부 라이브러리 없이 SummaryMarkdown 한 곳에서만 쓰는 용도.
 */
function SummaryMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let bulletBuffer: string[] = []
  let paragraphBuffer: string[] = []

  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return
    blocks.push(
      <ul key={`b-${key}`} className="list-disc pl-4 space-y-0.5 my-1">
        {bulletBuffer.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    )
    bulletBuffer = []
  }

  const flushParagraph = (key: string) => {
    if (paragraphBuffer.length === 0) return
    blocks.push(
      <p key={`p-${key}`} className="my-1">{paragraphBuffer.join(' ')}</p>
    )
    paragraphBuffer = []
  }

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim()
    const key = String(i)

    if (line.startsWith('## ')) {
      flushBullets(key); flushParagraph(key)
      blocks.push(
        <h4 key={`h-${key}`} className="text-[11px] font-bold text-foreground/90 mt-2 mb-1">
          {line.slice(3)}
        </h4>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph(key)
      bulletBuffer.push(line.slice(2))
    } else if (line === '') {
      flushBullets(key); flushParagraph(key)
    } else {
      flushBullets(key)
      paragraphBuffer.push(line)
    }
  })
  flushBullets('end'); flushParagraph('end')

  return <div className="text-[11px] text-foreground/80 leading-relaxed">{blocks}</div>
}

function ExtractedTextBlock({
  extractedPreview,
  extractedText,
  extractedTextKo,
  extractedLength,
  showFull,
  onToggleFull,
}: {
  extractedPreview: string
  extractedText: string | null
  extractedTextKo: string | null
  extractedLength: number | null
  showFull: boolean
  onToggleFull: () => void
}) {
  const [showOriginal, setShowOriginal] = useState(false)
  const hasTranslation = !!extractedTextKo

  if (hasTranslation && extractedText) {
    const body = showOriginal ? extractedText : extractedTextKo
    return (
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground/70 mb-1 flex items-center gap-1.5">
          <span>{showOriginal ? '추출 원문 (원어)' : '🌏 한글 번역'}</span>
          {extractedLength != null && (
            <span className="text-muted-foreground/50 font-normal">
              (원문 전체 {extractedLength.toLocaleString()}자)
            </span>
          )}
          <button
            onClick={() => setShowOriginal(v => !v)}
            className="ml-auto text-[10px] text-primary/70 hover:text-primary"
          >
            {showOriginal ? '한글 번역 보기' : '원문 보기'}
          </button>
        </div>
        <p className="text-muted-foreground/70 whitespace-pre-wrap font-mono text-[10px] leading-relaxed bg-muted/30 rounded p-2 max-h-96 overflow-y-auto">
          {body}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground/70 mb-1 flex items-center gap-1.5">
        <span>추출 원문{showFull ? '' : ' 프리뷰'}</span>
        {extractedLength != null && (
          <span className="text-muted-foreground/50 font-normal">
            (전체 {extractedLength.toLocaleString()}자{showFull || !extractedText ? '' : `, 표시 ${Math.min(500, extractedLength).toLocaleString()}자`})
          </span>
        )}
        {extractedText && extractedLength != null && extractedLength > 500 && (
          <button
            onClick={onToggleFull}
            className="ml-auto text-[10px] text-primary/70 hover:text-primary"
          >
            {showFull ? '프리뷰만' : '원문 전체 보기'}
          </button>
        )}
      </div>
      <p className={cn(
        'text-muted-foreground/60 whitespace-pre-wrap font-mono text-[10px] leading-relaxed bg-muted/30 rounded p-2 overflow-y-auto',
        showFull ? 'max-h-96' : 'max-h-40'
      )}>
        {showFull && extractedText ? extractedText : extractedPreview}
      </p>
    </div>
  )
}

function SourceStatusBadge({ status }: { status: ContentSourceData['summaryStatus'] }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-income">
        <CheckCircle2 className="w-2.5 h-2.5" />요약 완료
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-destructive">
        <AlertTriangle className="w-2.5 h-2.5" />요약 실패
      </span>
    )
  }
  if (status === 'fetch_failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-destructive">
        <AlertTriangle className="w-2.5 h-2.5" />추출 실패
      </span>
    )
  }
  if (status === 'too_short') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-warning">
        <AlertTriangle className="w-2.5 h-2.5" />본문 부족
      </span>
    )
  }
  return null
}

function SourceRow({
  src,
  onDelete,
  onResummarize,
  onUpdateCategories,
  onGenerateFromSource,
  generating,
}: {
  src: ContentSourceData
  onDelete: (id: string) => void
  onResummarize: (id: string) => Promise<void>
  onUpdateCategories: (id: string, categories: string[]) => Promise<void>
  onGenerateFromSource: (src: ContentSourceData) => void
  generating: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [resummarizing, setResummarizing] = useState(false)
  const [showRawText, setShowRawText] = useState(false)
  const [showFullText, setShowFullText] = useState(false)

  const isFailed = src.summaryStatus === 'failed' || src.summaryStatus === 'fetch_failed'
  const canExpand = !!(src.summary || src.summaryError || src.extractedPreview)

  const handleResummarize = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setResummarizing(true)
    try {
      await onResummarize(src.id)
    } finally {
      setResummarizing(false)
    }
  }

  const toggleCategory = async (cat: string) => {
    const next = src.categories.includes(cat)
      ? src.categories.filter(c => c !== cat)
      : [...src.categories, cat]
    await onUpdateCategories(src.id, next)
  }

  return (
    <div className={cn('px-4 py-3', isFailed && 'bg-red-500/[0.02]')}>
      {/* ── 헤더: 제목 줄 + 메타 줄로 분리 (좁은 화면에서도 안 깨짐) ── */}
      <div
        className={cn('flex items-start gap-2.5', canExpand && 'cursor-pointer')}
        onClick={() => canExpand && setExpanded(v => !v)}
      >
        <div className="flex-shrink-0 mt-0.5">
          {src.type === 'text' ? (
            <FileText className="w-3.5 h-3.5 text-muted-foreground/40" />
          ) : (
            <Link2 className="w-3.5 h-3.5 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {/* 1줄: 제목만 */}
          <p className="text-sm font-medium text-foreground leading-tight break-words pr-1">
            {src.title ?? src.url ?? '텍스트 메모'}
          </p>
          {/* 2줄: 상태 + 카테고리 뱃지 */}
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <SourceStatusBadge status={src.summaryStatus} />
            {src.categories.map(cat => (
              <span
                key={cat}
                className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', categoryStyle(cat))}
              >
                {cat}
              </span>
            ))}
            {src.categories.length === 0 && src.summaryStatus === 'success' && (
              <span className="text-[10px] text-muted-foreground/40 italic">카테고리 미지정</span>
            )}
          </div>
          {/* 3줄(접힌 상태에서만): 요약 프리뷰 또는 에러 */}
          {!expanded && src.summary && (
            <p className="text-[11px] text-muted-foreground/60 mt-1.5 line-clamp-2">{plainPreview(src.summary)}</p>
          )}
          {!expanded && !src.summary && src.summaryError && (
            <p className="text-[11px] text-destructive/70 mt-1.5 line-clamp-1">{src.summaryError}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {canExpand && (
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground/40 transition-transform', expanded && 'rotate-180')} />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(src.id) }}
            className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/40 hover:text-destructive transition-colors"
            aria-label="삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 펼친 영역 ── */}
      {expanded && (
        <div className="mt-4 ml-6 space-y-4">
          {/* 1) 요약 (메인 콘텐츠) */}
          {src.summary && (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <SummaryMarkdown text={src.summary} />
            </div>
          )}

          {src.summaryError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-3 py-2.5">
              <div className="text-[10px] font-semibold text-destructive/80 mb-1">실패 사유</div>
              <p className="text-[11px] text-destructive/80 whitespace-pre-wrap">{src.summaryError}</p>
            </div>
          )}

          {/* 2) 카테고리 (always-editable chips) */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground/70 mb-1.5">
              카테고리 <span className="font-normal text-muted-foreground/40">— 클릭해서 추가/제거</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIO_CATEGORIES.map(cat => {
                const active = src.categories.includes(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                      active
                        ? `${categoryStyle(cat)} border-transparent`
                        : 'bg-transparent border-border text-muted-foreground/50 hover:border-foreground/30 hover:text-foreground/80',
                    )}
                  >
                    {active ? '✓ ' : '+ '}{cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3) 1차 액션: 시나리오 생성 */}
          {src.summaryStatus === 'success' && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateFromSource(src) }}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              이 컨텐츠로 시나리오 생성
            </button>
          )}

          {/* 4) 보조 액션 + 메타 */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-muted-foreground/60">
            <div className="flex items-center gap-3">
              {src.extractedPreview && (
                <button
                  onClick={() => setShowRawText(v => !v)}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ChevronDown className={cn('w-3 h-3 transition-transform', showRawText && 'rotate-180')} />
                  추출 원문 {showRawText ? '숨기기' : '보기'}
                  {src.extractedLength != null && (
                    <span className="text-muted-foreground/40">({src.extractedLength.toLocaleString()}자)</span>
                  )}
                </button>
              )}
              {src.type === 'url' && src.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />출처
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              {src.summarizedAt && (
                <span>
                  {new Date(src.summarizedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              )}
              {src.type === 'url' && (
                <button
                  onClick={handleResummarize}
                  disabled={resummarizing}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {resummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  재요약
                </button>
              )}
            </div>
          </div>

          {/* 5) 추출 원문 (펼침/접힘) */}
          {showRawText && src.extractedPreview && (
            <ExtractedTextBlock
              extractedPreview={src.extractedPreview}
              extractedText={src.extractedText}
              extractedTextKo={src.extractedTextKo}
              extractedLength={src.extractedLength}
              showFull={showFullText}
              onToggleFull={() => setShowFullText(v => !v)}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function ContentSourceSection({
  sources,
  onAdd,
  onDelete,
  onResummarize,
  onUpdateCategories,
  onGenerateFromSource,
  generating,
  adding,
}: {
  sources: ContentSourceData[]
  onAdd: (input: { type: 'url'; url: string } | { type: 'text'; title: string; text: string }) => Promise<void>
  onDelete: (id: string) => void
  onResummarize: (id: string) => Promise<void>
  onUpdateCategories: (id: string, categories: string[]) => Promise<void>
  onGenerateFromSource: (src: ContentSourceData) => void
  generating: boolean
  adding: boolean
}) {
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')

  const handleSubmit = async () => {
    if (inputMode === 'url') {
      let url = urlInput.trim()
      if (!url) return
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url
      await onAdd({ type: 'url', url })
      setUrlInput('')
    } else {
      if (!textTitle.trim() || !textContent.trim()) {
        toast.error('제목과 내용을 모두 입력해주세요')
        return
      }
      await onAdd({ type: 'text', title: textTitle.trim(), text: textContent.trim() })
      setTextTitle('')
      setTextContent('')
    }
  }

  const canSubmit = inputMode === 'url' ? urlInput.trim().length > 0 : textTitle.trim().length > 0 && textContent.trim().length > 0

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-sm font-semibold text-foreground">관심 컨텐츠</span>
          <span className="text-[10px] text-muted-foreground/50">시나리오 생성에 반영됩니다</span>
        </div>
        {/* URL / 텍스트 토글 */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setInputMode('url')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
              inputMode === 'url' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Link2 className="w-3 h-3" />URL
          </button>
          <button
            onClick={() => setInputMode('text')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
              inputMode === 'text' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <FileText className="w-3 h-3" />텍스트
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {inputMode === 'url' ? (
          <>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="https://..."
                disabled={adding}
                className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={adding || !canSubmit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                추가
              </button>
            </div>
            {adding ? (
              <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                추출 → 요약 → 번역 처리 중… 긴 영상은 30초 이상 걸릴 수 있어요
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground/40">
                YouTube/기사 URL · 영어도 OK · 최장 2시간 영상까지 자동 번역
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={textTitle}
              onChange={e => setTextTitle(e.target.value)}
              placeholder="제목 (예: 마통 갈아타기 전략 메모)"
              className="w-full text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <div className="flex gap-2">
              <textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="관심 있는 재무/투자 내용을 자유롭게 입력하세요..."
                rows={3}
                className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={adding || !canSubmit}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity self-start"
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {sources.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {sources.map(src => (
            <SourceRow
              key={src.id}
              src={src}
              onDelete={onDelete}
              onResummarize={onResummarize}
              onUpdateCategories={onUpdateCategories}
              onGenerateFromSource={onGenerateFromSource}
              generating={generating}
            />
          ))}
        </div>
      )}

      {sources.length === 0 && (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground/40">
            관심 기사·유튜브 링크 또는 재무 메모를 추가해보세요
          </p>
        </div>
      )}
    </div>
  )
}

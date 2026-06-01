'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  MessageSquare, Send, Trash2, Pin, PinOff,
  ChevronDown, ChevronUp, MoreHorizontal, Smile, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  getFeedPosts, createPost, deletePost, togglePostPin,
  createComment, deleteComment, toggleReaction,
  type FamilyPostData, type PostCommentData, type PostReactionSummary, type TxnRefData,
} from '@/lib/actions/feed'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ['👍', '✅', '🤔', '❤️', '😮']

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function authorInitial(name: string | null): string {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-income',
  'bg-warning', 'bg-savings', 'bg-rose-500',
]
function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// ── 아바타 ────────────────────────────────────────────────────────────────────

function Avatar({ name, userId, size = 'md' }: { name: string | null; userId: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
      size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs',
      avatarColor(userId),
    )}>
      {authorInitial(name)}
    </div>
  )
}

// ── 댓글 섹션 ─────────────────────────────────────────────────────────────────

function CommentSection({
  postId,
  comments,
  onCommentAdded,
  onCommentDeleted,
}: {
  postId: string
  comments: PostCommentData[]
  onCommentAdded: (comment: PostCommentData) => void
  onCommentDeleted: (commentId: string) => void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    const res = await createComment(postId, text)
    if (res.success && res.comment) {
      onCommentAdded(res.comment)
    } else {
      toast.error(res.error ?? '댓글 작성 실패')
      setInput(text)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleDelete = async (commentId: string) => {
    const res = await deleteComment(commentId)
    if (res.success) onCommentDeleted(commentId)
    else toast.error(res.error ?? '삭제 실패')
  }

  return (
    <div className="border-t border-border/50 pt-3 space-y-2.5">
      {comments.map(c => (
        <div key={c.id} className="flex items-start gap-2">
          <Avatar name={c.author.name} userId={c.author.id} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-3 py-2">
              <p className="text-[11px] font-semibold text-foreground/70 mb-0.5">
                {c.author.name ?? '알 수 없음'}
              </p>
              <p className="text-xs text-foreground/90 break-words">{c.content}</p>
            </div>
            <div className="flex items-center gap-2 mt-0.5 px-1">
              <span className="text-[10px] text-muted-foreground/40">
                {formatRelativeTime(c.createdAt)}
              </span>
              {c.isOwn && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-[10px] text-muted-foreground/30 hover:text-destructive transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* 입력창 */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
          placeholder="댓글 달기..."
          className="flex-1 text-xs bg-muted/50 border border-border rounded-full px-3 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <button
          onClick={submit}
          disabled={!input.trim() || sending}
          className="p-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ── 반응 바 ───────────────────────────────────────────────────────────────────

function ReactionBar({
  reactions,
  onToggle,
}: {
  reactions: PostReactionSummary[]
  onToggle: (emoji: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* 기존 반응들 */}
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
            r.hasReacted
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted',
          )}
        >
          <span>{r.emoji}</span>
          <span className="text-[10px] font-medium tabular-nums">{r.count}</span>
        </button>
      ))}

      {/* 반응 추가 버튼 */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen(v => !v)}
          className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border border-border bg-muted/30 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground transition-colors"
        >
          <Smile className="w-3 h-3" />
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full mb-1 left-0 flex gap-1 bg-popover border border-border rounded-2xl px-2 py-1.5 shadow-lg z-10">
            {REACTION_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => { onToggle(e); setPickerOpen(false) }}
                className="text-base hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 거래 참조 카드 ────────────────────────────────────────────────────────────

function TxnRefCard({ txnRef }: { txnRef: TxnRefData }) {
  const isExpense = txnRef.amount < 0
  const abs = Math.abs(txnRef.amount)
  const formatted = abs.toLocaleString('ko-KR') + '원'
  const dateStr = new Date(txnRef.date).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric',
  })
  const linkHref = `/dashboard/cashflow?txn=${txnRef.id}`

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      txnRef.isMasked
        ? 'bg-muted/30 border-border'
        : isExpense
          ? 'bg-expense-soft border-[var(--viz-red)]/20'
          : 'bg-income-soft border-[var(--viz-emerald)]/20',
    )}>
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] text-muted-foreground/50">{dateStr}</span>
            {!txnRef.isMasked && (
              <span className="text-[10px] bg-muted/50 text-muted-foreground/60 px-1.5 py-0.5 rounded-full">
                {txnRef.category}
              </span>
            )}
          </div>
          <p className={cn(
            'text-xs truncate',
            txnRef.isMasked ? 'text-muted-foreground/40 italic' : 'text-foreground/80',
          )}>
            {txnRef.description}
          </p>
        </div>
        <span className={cn(
          'text-sm font-bold tabular-nums flex-shrink-0',
          txnRef.isMasked
            ? 'text-muted-foreground/40'
            : isExpense ? 'text-expense' : 'text-income',
        )}>
          {txnRef.isMasked ? '비공개' : (isExpense ? '-' : '+') + formatted}
        </span>
      </div>
      {!txnRef.isMasked && (
        <Link
          href={linkHref}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium border-t transition-colors',
            isExpense
              ? 'border-[var(--viz-red)]/15 text-muted-foreground hover:text-expense hover:bg-expense-soft'
              : 'border-[var(--viz-emerald)]/15 text-muted-foreground hover:text-income hover:bg-income-soft',
          )}
        >
          현금흐름에서 확인
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}

// ── 게시물 카드 ───────────────────────────────────────────────────────────────

function PostCard({
  post,
  onDelete,
  onPinToggle,
  onReactionToggle,
  onCommentAdded,
  onCommentDeleted,
  isCFO,
}: {
  post: FamilyPostData
  onDelete: () => void
  onPinToggle: (isPinned: boolean) => void
  onReactionToggle: (reactions: PostReactionSummary[]) => void
  onCommentAdded: (comment: PostCommentData) => void
  onCommentDeleted: (commentId: string) => void
  isCFO: boolean
}) {
  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleDelete = async () => {
    setMenuOpen(false)
    const res = await deletePost(post.id)
    if (res.success) onDelete()
    else toast.error(res.error ?? '삭제 실패')
  }

  const handlePin = async () => {
    setMenuOpen(false)
    const res = await togglePostPin(post.id)
    if (res.success && res.isPinned !== undefined) onPinToggle(res.isPinned)
    else toast.error(res.error ?? '핀 설정 실패')
  }

  const handleReaction = async (emoji: string) => {
    const res = await toggleReaction(post.id, emoji)
    if (res.success && res.reactions) onReactionToggle(res.reactions)
  }

  const commentCount = post.comments.length

  return (
    <div className={cn(
      'bg-card border rounded-2xl overflow-hidden',
      post.isPinned ? 'border-primary/30' : 'border-border',
    )}>
      {post.isPinned && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-primary/5 border-b border-primary/20">
          <Pin className="w-3 h-3 text-primary/60" />
          <span className="text-[10px] text-primary/60 font-medium">고정된 게시물</span>
        </div>
      )}

      <div className="px-4 pt-3.5 pb-3 space-y-3">
        {/* 작성자 + 시간 + 메뉴 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Avatar name={post.author.name} userId={post.author.id} />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {post.author.name ?? '알 수 없음'}
              </p>
              <p className="text-[10px] text-muted-foreground/50">
                {formatRelativeTime(post.createdAt)}
              </p>
            </div>
          </div>

          {/* 더보기 메뉴 */}
          {(post.isOwn || isCFO) && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-lg z-10 overflow-hidden min-w-[120px]">
                  {isCFO && (
                    <button
                      onClick={handlePin}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                    >
                      {post.isPinned
                        ? <><PinOff className="w-3.5 h-3.5" />핀 해제</>
                        : <><Pin className="w-3.5 h-3.5" />상단 고정</>}
                    </button>
                  )}
                  {post.isOwn && (
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />삭제
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 태그된 구성원 */}
        {post.taggedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.taggedUsers.map(u => (
              <span
                key={u.id}
                className="text-[11px] font-medium text-primary/70 bg-primary/8 px-2 py-0.5 rounded-full"
              >
                @{u.name ?? u.id.slice(0, 6)}
              </span>
            ))}
          </div>
        )}

        {/* 본문 */}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </p>

        {/* 거래 참조 카드 */}
        {post.type === 'txn_ref' && post.txnRef && (
          <TxnRefCard txnRef={post.txnRef} />
        )}

        {/* 반응 */}
        <ReactionBar reactions={post.reactions} onToggle={handleReaction} />

        {/* 댓글 토글 버튼 */}
        <button
          onClick={() => setShowComments(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {commentCount > 0 ? (
            <>
              댓글 {commentCount}개
              {showComments
                ? <ChevronUp className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />}
            </>
          ) : (
            '댓글 달기'
          )}
        </button>

        {/* 댓글 섹션 */}
        {showComments && (
          <CommentSection
            postId={post.id}
            comments={post.comments}
            onCommentAdded={onCommentAdded}
            onCommentDeleted={onCommentDeleted}
          />
        )}
      </div>
    </div>
  )
}

// ── 게시물 작성 폼 ────────────────────────────────────────────────────────────

function PostComposer({ onPosted }: { onPosted: (post: FamilyPostData) => void }) {
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const submit = async () => {
    const text = content.trim()
    if (!text || posting) return
    setPosting(true)
    const res = await createPost(text)
    if (res.success && res.post) {
      setContent('')
      setFocused(false)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      onPosted(res.post)
    } else {
      toast.error(res.error ?? '게시 실패')
    }
    setPosting(false)
  }

  return (
    <div className={cn(
      'bg-card border rounded-2xl overflow-hidden transition-all',
      focused ? 'border-primary/30' : 'border-border',
    )}>
      <div className="px-4 pt-3.5 pb-3 space-y-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => { setContent(e.target.value); autoResize() }}
          onFocus={() => setFocused(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
          placeholder="가족에게 공유하고 싶은 내용을 작성하세요..."
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed"
        />
        {focused && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/30">⌘+Enter로 게시</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setContent(''); setFocused(false) }}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors px-2 py-1"
              >
                취소
              </button>
              <button
                onClick={submit}
                disabled={!content.trim() || posting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
              >
                <Send className="w-3 h-3" />
                게시
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [posts, setPosts] = useState<FamilyPostData[]>([])
  const [loading, setLoading] = useState(true)
  const [isCFO, setIsCFO] = useState(false)

  const load = useCallback(async () => {
    const data = await getFeedPosts()
    setPosts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // 피드 방문 시각 저장 — 대시보드 알림 초기화용
    localStorage.setItem('don-doc:lastFeedRead', new Date().toISOString())
  }, [load])

  const handlePosted = (post: FamilyPostData) => {
    setPosts(prev => [post, ...prev])
  }

  const handleDelete = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const handlePinToggle = (postId: string, isPinned: boolean) => {
    setPosts(prev => {
      const updated = prev.map(p => p.id === postId ? { ...p, isPinned } : p)
      return [...updated].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    })
  }

  const handleReactionToggle = (postId: string, reactions: PostReactionSummary[]) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions } : p))
  }

  const handleCommentAdded = (postId: string, comment: PostCommentData) => {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, comment] } : p
    ))
  }

  const handleCommentDeleted = (postId: string, commentId: string) => {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p
    ))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-400" />
        <h1 className="text-lg font-bold text-foreground">가족 피드</h1>
      </div>

      {/* 작성 폼 */}
      <PostComposer onPosted={handlePosted} />

      {/* 게시물 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-2.5 w-12 bg-muted rounded" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-muted/30 border border-dashed border-border rounded-2xl py-14 text-center">
          <MessageSquare className="w-7 h-7 text-muted-foreground/20 mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground/50">아직 게시물이 없습니다</p>
          <p className="text-xs text-muted-foreground/30 mt-1">
            가족과 나누고 싶은 이야기를 작성해보세요
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              isCFO={isCFO}
              onDelete={() => handleDelete(post.id)}
              onPinToggle={isPinned => handlePinToggle(post.id, isPinned)}
              onReactionToggle={reactions => handleReactionToggle(post.id, reactions)}
              onCommentAdded={comment => handleCommentAdded(post.id, comment)}
              onCommentDeleted={commentId => handleCommentDeleted(post.id, commentId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

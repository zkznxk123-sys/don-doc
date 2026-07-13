import { MessageSquare, MessageCircle, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showDemoToast, formatRelative, type DemoData } from '../_shared'

export function FeedView({ data }: { data: DemoData }) {
  const { feedPosts } = data

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold">가족 피드</h2>
        </div>
        <button onClick={showDemoToast}
          className="text-xs font-medium bg-foreground text-background px-3 py-1.5 rounded-xl">
          글 쓰기
        </button>
      </div>

      <div className="space-y-3">
        {feedPosts.map(post => (
          <div
            key={post.id}
            className={cn('bg-card rounded-2xl border overflow-hidden', post.isPinned ? '' : 'border-border')}
            style={post.isPinned ? { borderColor: 'rgba(245,158,11,0.3)' } : undefined}
          >
            {post.isPinned && (
              <div
                className="flex items-center gap-1.5 px-4 py-2 bg-warning-soft border-b"
                style={{ borderColor: 'rgba(245,158,11,0.2)' }}
              >
                <Pin className="w-3 h-3 text-warning" />
                <span className="text-[10px] font-medium text-warning">고정 게시물</span>
              </div>
            )}
            <div className="p-4">
              {/* 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: 'var(--viz-slate)' }}>
                  {(post.authorName ?? '?').charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold">{post.authorName}</p>
                  <p className="text-[10px] text-muted-foreground/60">{formatRelative(post.createdAt)}</p>
                </div>
                {post.type === 'txn_ref' && (
                  <span
                    className="ml-auto text-[10px] bg-warning-soft text-warning border px-1.5 py-0.5 rounded-full"
                    style={{ borderColor: 'rgba(245,158,11,0.2)' }}
                  >
                    거래 공유
                  </span>
                )}
              </div>

              {/* 본문 */}
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">{post.content}</p>

              {/* 반응 */}
              {Object.keys(post.reactions).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(post.reactions).map(([emoji, count]) => (
                    <button key={emoji} onClick={showDemoToast}
                      className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 px-2.5 py-1 rounded-full transition-colors">
                      {emoji} <span className="text-muted-foreground">{count}</span>
                    </button>
                  ))}
                  <button onClick={showDemoToast}
                    className="text-xs text-muted-foreground/60 hover:text-foreground px-2.5 py-1 rounded-full bg-muted/40 transition-colors">
                    + 반응
                  </button>
                </div>
              )}

              {/* 댓글 */}
              {post.comments.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                  {post.comments.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                        {(c.authorName ?? '?').charAt(0)}
                      </div>
                      <div className="bg-muted/40 rounded-xl px-3 py-1.5 flex-1">
                        <p className="text-[10px] font-semibold mb-0.5">{c.authorName}</p>
                        <p className="text-xs text-foreground/70">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <button onClick={showDemoToast}
                    className="w-full flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>댓글 달기...</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 하단 여백 */}
      <div className="h-4" />
    </div>
  )
}

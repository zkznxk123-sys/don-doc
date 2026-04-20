'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// ── 타입 ────────────────────────────────────────────────────────────────────

export interface PostAuthor {
  id: string
  name: string | null
}

export interface PostCommentData {
  id: string
  content: string
  author: PostAuthor
  createdAt: Date
  isOwn: boolean
}

export interface PostReactionSummary {
  emoji: string
  count: number
  hasReacted: boolean
}

export interface TxnRefData {
  id: string
  amount: number
  date: string
  description: string
  category: string
  isMasked: boolean
}

export interface FamilyPostData {
  id: string
  type: string
  content: string
  isPinned: boolean
  author: PostAuthor
  taggedUsers: PostAuthor[]
  comments: PostCommentData[]
  reactions: PostReactionSummary[]
  txnRef: TxnRefData | null
  createdAt: Date
  updatedAt: Date
  isOwn: boolean
}

// ── 가족 멤버 조회 (태그용) ────────────────────────────────────────────────────

export async function getFamilyMembersForTag(): Promise<PostAuthor[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []
  const members = await prisma.user.findMany({
    where: { familyId: user.familyId, id: { not: user.id } },
    select: { id: true, name: true },
  })
  return members.map(m => ({ id: m.id, name: m.name }))
}

// ── 게시물 조회 ──────────────────────────────────────────────────────────────

export async function getFeedPosts(): Promise<FamilyPostData[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const posts = await prisma.familyPost.findMany({
    where: { familyId: user.familyId },
    include: {
      author: { select: { id: true, name: true } },
      taggedUsers: { select: { id: true, name: true } },
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      reactions: { select: { userId: true, emoji: true } },
      transaction: {
        select: {
          id: true, amount: true, date: true,
          description: true, category: true, visibility: true,
        },
      },
    },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
  })

  return posts.map(p => mapPost(p, user.id))
}

function mapPost(p: any, currentUserId: string): FamilyPostData {
  const emojiMap = new Map<string, { count: number; hasReacted: boolean }>()
  for (const r of p.reactions) {
    const cur = emojiMap.get(r.emoji) ?? { count: 0, hasReacted: false }
    emojiMap.set(r.emoji, {
      count: cur.count + 1,
      hasReacted: cur.hasReacted || r.userId === currentUserId,
    })
  }
  const reactions: PostReactionSummary[] = Array.from(emojiMap.entries()).map(
    ([emoji, { count, hasReacted }]) => ({ emoji, count, hasReacted })
  )

  let txnRef: TxnRefData | null = null
  if (p.transaction) {
    const t = p.transaction
    const isMasked = t.visibility === 'PRIVATE'
    txnRef = {
      id: t.id,
      amount: t.amount,
      date: t.date instanceof Date ? t.date.toISOString() : t.date,
      description: isMasked ? '비공개 거래' : t.description,
      category: isMasked ? '-' : t.category,
      isMasked,
    }
  }

  return {
    id: p.id,
    type: p.type,
    content: p.content,
    isPinned: p.isPinned,
    author: { id: p.author.id, name: p.author.name },
    taggedUsers: (p.taggedUsers ?? []).map((u: any) => ({ id: u.id, name: u.name })),
    comments: p.comments.map((c: any) => ({
      id: c.id,
      content: c.content,
      author: { id: c.author.id, name: c.author.name },
      createdAt: c.createdAt,
      isOwn: c.authorId === currentUserId,
    })),
    reactions,
    txnRef,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    isOwn: p.authorId === currentUserId,
  }
}

// ── 게시물 작성 ──────────────────────────────────────────────────────────────

export async function createPost(
  content: string,
  taggedUserIds: string[] = [],
): Promise<{ success: boolean; post?: FamilyPostData; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }
  if (!content.trim()) return { success: false, error: '내용을 입력해주세요' }

  const post = await prisma.familyPost.create({
    data: {
      familyId: user.familyId,
      authorId: user.id,
      content: content.trim(),
      type: 'text',
      taggedUsers: taggedUserIds.length > 0
        ? { connect: taggedUserIds.map(id => ({ id })) }
        : undefined,
    },
    include: {
      author: { select: { id: true, name: true } },
      taggedUsers: { select: { id: true, name: true } },
      comments: { include: { author: { select: { id: true, name: true } } } },
      reactions: { select: { userId: true, emoji: true } },
    },
  })

  return {
    success: true,
    post: {
      id: post.id,
      type: post.type,
      content: post.content,
      isPinned: post.isPinned,
      author: { id: post.author.id, name: post.author.name },
      taggedUsers: post.taggedUsers.map((u: any) => ({ id: u.id, name: u.name })),
      comments: [],
      reactions: [],
      txnRef: null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      isOwn: true,
    },
  }
}

// ── 거래 참조 게시물 ──────────────────────────────────────────────────────────

export async function createTxnRefPost(
  transactionId: string,
  content: string,
  taggedUserIds: string[] = [],
): Promise<{ success: boolean; post?: FamilyPostData; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }
  if (!content.trim()) return { success: false, error: '내용을 입력해주세요' }

  // PRIVATE 거래도 공유 가능하되 내용은 마스킹됨
  const post = await prisma.familyPost.create({
    data: {
      familyId: user.familyId,
      authorId: user.id,
      content: content.trim(),
      type: 'txn_ref',
      transactionId,
      taggedUsers: taggedUserIds.length > 0
        ? { connect: taggedUserIds.map(id => ({ id })) }
        : undefined,
    },
    include: {
      author: { select: { id: true, name: true } },
      taggedUsers: { select: { id: true, name: true } },
      comments: { include: { author: { select: { id: true, name: true } } } },
      reactions: { select: { userId: true, emoji: true } },
      transaction: {
        select: {
          id: true, amount: true, date: true,
          description: true, category: true, visibility: true,
        },
      },
    },
  })

  return { success: true, post: mapPost(post, user.id) }
}

// ── 게시물 삭제 ──────────────────────────────────────────────────────────────

export async function deletePost(
  postId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const post = await prisma.familyPost.findUnique({ where: { id: postId } })
  if (!post) return { success: false, error: '게시물을 찾을 수 없습니다' }
  if (post.authorId !== user.id) return { success: false, error: '삭제 권한이 없습니다' }

  await prisma.familyPost.delete({ where: { id: postId } })
  return { success: true }
}

// ── 핀 토글 (CFO 전용) ────────────────────────────────────────────────────────

export async function togglePostPin(
  postId: string,
): Promise<{ success: boolean; isPinned?: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  if (user.role !== 'CFO') return { success: false, error: 'CFO만 핀 설정 가능합니다' }

  const post = await prisma.familyPost.findUnique({ where: { id: postId } })
  if (!post) return { success: false, error: '게시물을 찾을 수 없습니다' }

  const updated = await prisma.familyPost.update({
    where: { id: postId },
    data: { isPinned: !post.isPinned },
  })
  return { success: true, isPinned: updated.isPinned }
}

// ── 댓글 ─────────────────────────────────────────────────────────────────────

export async function createComment(
  postId: string,
  content: string,
): Promise<{ success: boolean; comment?: PostCommentData; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  if (!content.trim()) return { success: false, error: '내용을 입력해주세요' }

  const comment = await prisma.postComment.create({
    data: { postId, authorId: user.id, content: content.trim() },
    include: { author: { select: { id: true, name: true } } },
  })

  return {
    success: true,
    comment: {
      id: comment.id,
      content: comment.content,
      author: { id: comment.author.id, name: comment.author.name },
      createdAt: comment.createdAt,
      isOwn: true,
    },
  }
}

export async function deleteComment(
  commentId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const comment = await prisma.postComment.findUnique({ where: { id: commentId } })
  if (!comment) return { success: false, error: '댓글을 찾을 수 없습니다' }
  if (comment.authorId !== user.id) return { success: false, error: '삭제 권한이 없습니다' }

  await prisma.postComment.delete({ where: { id: commentId } })
  return { success: true }
}

// ── 반응 ─────────────────────────────────────────────────────────────────────

export async function toggleReaction(
  postId: string,
  emoji: string,
): Promise<{ success: boolean; reactions?: PostReactionSummary[]; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const existing = await prisma.postReaction.findUnique({
    where: { postId_userId_emoji: { postId, userId: user.id, emoji } },
  })

  if (existing) {
    await prisma.postReaction.delete({ where: { id: existing.id } })
  } else {
    await prisma.postReaction.create({ data: { postId, userId: user.id, emoji } })
  }

  // 최신 반응 집계 반환
  const allReactions = await prisma.postReaction.findMany({
    where: { postId },
    select: { userId: true, emoji: true },
  })

  const emojiMap = new Map<string, { count: number; hasReacted: boolean }>()
  for (const r of allReactions) {
    const cur = emojiMap.get(r.emoji) ?? { count: 0, hasReacted: false }
    emojiMap.set(r.emoji, {
      count: cur.count + 1,
      hasReacted: cur.hasReacted || r.userId === user.id,
    })
  }

  const reactions: PostReactionSummary[] = Array.from(emojiMap.entries()).map(
    ([emoji, { count, hasReacted }]) => ({ emoji, count, hasReacted })
  )

  return { success: true, reactions }
}

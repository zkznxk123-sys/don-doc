import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chat, AI_MODELS } from '@/lib/ai'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user?.familyId) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    }

    // 이번 달 거래 내역 조회
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const transactions = await prisma.transaction.findMany({
      where: {
        account: { familyId: user.familyId },
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      select: {
        amount: true,
        category: true,
        description: true,
        date: true,
        visibility: true,
      },
      orderBy: { date: 'desc' },
      take: 200,
    })

    if (transactions.length === 0) {
      return NextResponse.json({
        insights: '이번 달 거래 내역이 없습니다. 지출을 기록하면 AI가 분석해드려요!',
        summary: { totalExpense: 0, totalIncome: 0, topCategory: null },
      })
    }

    // 카테고리별 집계
    const categoryTotals: Record<string, number> = {}
    let totalExpense = 0
    let totalIncome = 0

    for (const t of transactions) {
      if (t.amount < 0) {
        totalExpense += Math.abs(t.amount)
        categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + Math.abs(t.amount)
      } else {
        totalIncome += t.amount
      }
    }

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amount]) => `${cat}: ${amount.toLocaleString()}원`)

    const topCategory = topCategories[0]?.split(':')[0] ?? null

    // LLM 인사이트 생성
    const prompt = `이번 달 가족 가계부 데이터입니다:

총 지출: ${totalExpense.toLocaleString()}원
총 수입: ${totalIncome.toLocaleString()}원
순 잔액: ${(totalIncome - totalExpense).toLocaleString()}원
거래 건수: ${transactions.length}건

카테고리별 지출 TOP 5:
${topCategories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

위 데이터를 바탕으로 한국 가정의 가계 관리 관점에서:
1. 이번 달 지출 패턴의 특징 1가지
2. 개선할 수 있는 점 1가지
3. 다음 달을 위한 실용적인 조언 1가지

각 항목을 2-3문장으로 작성하세요. 친근하고 실용적인 톤으로, 불필요한 서두 없이 바로 내용을 시작하세요.`

    const insights = await chat(
      [
        {
          role: 'system',
          content: '당신은 친절하고 실용적인 한국 가계부 AI 어시스턴트입니다. 데이터 기반으로 구체적이고 실행 가능한 조언을 제공합니다.',
        },
        { role: 'user', content: prompt },
      ],
      { model: AI_MODELS.smart, temperature: 0.7, maxTokens: 400 }
    )

    return NextResponse.json({
      insights,
      summary: {
        totalExpense,
        totalIncome,
        topCategory,
        transactionCount: transactions.length,
        month: `${now.getFullYear()}년 ${now.getMonth() + 1}월`,
      },
    })
  } catch (error) {
    const msg = String(error)
    const isLlmMuxDown = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('llm-mux')
    return NextResponse.json(
      {
        error: isLlmMuxDown
          ? 'llm-mux가 실행 중이지 않습니다. `llm-mux serve` 명령어로 시작해주세요.'
          : msg,
        llmMuxDown: isLlmMuxDown,
      },
      { status: 503 }
    )
  }
}

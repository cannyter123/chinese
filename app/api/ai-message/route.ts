import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateMessage } from '@/lib/claude/generate-message'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { conversation_id, turn_index } = body as {
      conversation_id: number
      turn_index: number
    }

    if (!conversation_id || turn_index == null) {
      return NextResponse.json({ error: 'Missing conversation_id or turn_index' }, { status: 400 })
    }

    const activeWords = await prisma.word.findMany({ where: { is_active: true } })

    // Fetch recent AI sentences for history context
    const recentTurns = await prisma.turn.findMany({
      where: { conversation_id },
      orderBy: { turn_index: 'desc' },
      take: 3,
      select: { ai_chinese: true },
    })
    const recentHistory = recentTurns.map(t => t.ai_chinese).reverse()

    const generated = await generateMessage(activeWords, recentHistory, turn_index)

    const turn = await prisma.turn.create({
      data: {
        conversation_id,
        ai_chinese: generated.chinese,
        ai_pinyin: generated.pinyin,
        turn_index,
      },
    })

    return NextResponse.json({
      turn_id: turn.id,
      ai_chinese: turn.ai_chinese,
      ai_pinyin: turn.ai_pinyin,
    })
  } catch (err) {
    console.error('POST /api/ai-message error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

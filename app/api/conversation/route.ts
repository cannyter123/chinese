import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateMessage } from '@/lib/claude/generate-message'

export async function POST() {
  try {
    const activeWords = await prisma.word.findMany({ where: { is_active: true } })

    if (activeWords.length === 0) {
      return NextResponse.json({ error: 'No active words in word bank' }, { status: 400 })
    }

    const conversation = await prisma.conversation.create({ data: {} })

    const generated = await generateMessage(activeWords, [], 0)

    const turn = await prisma.turn.create({
      data: {
        conversation_id: conversation.id,
        ai_chinese: generated.chinese,
        ai_pinyin: generated.pinyin,
        turn_index: 0,
      },
    })

    await prisma.appState.upsert({
      where: { id: 1 },
      update: { active_conversation_id: conversation.id },
      create: { id: 1, active_conversation_id: conversation.id },
    })

    return NextResponse.json({
      conversation_id: conversation.id,
      first_turn: {
        id: turn.id,
        ai_chinese: turn.ai_chinese,
        ai_pinyin: turn.ai_pinyin,
        turn_index: turn.turn_index,
      },
    })
  } catch (err) {
    console.error('POST /api/conversation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

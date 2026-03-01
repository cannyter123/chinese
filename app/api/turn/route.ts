import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeComprehension } from '@/lib/claude/analyze-comprehension'
import { updateScore, maybeExpandWordBank, computeComprehensionRate } from '@/lib/word-bank'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { turn_id, user_english } = body as { turn_id: number; user_english: string }

    if (!turn_id || !user_english) {
      return NextResponse.json({ error: 'Missing turn_id or user_english' }, { status: 400 })
    }

    // Get the turn
    const turn = await prisma.turn.findUnique({ where: { id: turn_id } })
    if (!turn) {
      return NextResponse.json({ error: 'Turn not found' }, { status: 404 })
    }

    // Save the user's reply
    await prisma.turn.update({
      where: { id: turn_id },
      data: { user_english },
    })

    // Determine which active words were used in the AI sentence
    const activeWords = await prisma.word.findMany({ where: { is_active: true } })
    const wordsUsed = activeWords.filter(w =>
      turn.ai_chinese.includes(w.chinese)
    )

    // Analyze comprehension
    const comprehensionDeltas = await analyzeComprehension(
      turn.ai_chinese,
      wordsUsed,
      user_english
    )

    // Cache the comprehension JSON
    await prisma.turn.update({
      where: { id: turn_id },
      data: { comprehension_json: JSON.stringify(comprehensionDeltas) },
    })

    // Update scores and create word events
    const scoreUpdates: Array<{
      word_id: number
      chinese: string
      pinyin: string
      delta: number
      score_before: number
      score_after: number
    }> = []

    for (const word of wordsUsed) {
      const delta = comprehensionDeltas[word.id] ?? 0.5
      const scoreBefore = word.comprehension_score
      const scoreAfter = updateScore(scoreBefore, delta)

      await prisma.word.update({
        where: { id: word.id },
        data: { comprehension_score: scoreAfter },
      })

      await prisma.wordEvent.create({
        data: {
          word_id: word.id,
          turn_id,
          delta,
          score_before: scoreBefore,
          score_after: scoreAfter,
        },
      })

      scoreUpdates.push({
        word_id: word.id,
        chinese: word.chinese,
        pinyin: word.pinyin,
        delta,
        score_before: scoreBefore,
        score_after: scoreAfter,
      })
    }

    // Trigger expansion if eligible
    const wordsExpanded = await maybeExpandWordBank(prisma)

    // Compute updated stats
    const updatedActive = await prisma.word.findMany({ where: { is_active: true } })
    const comprehensionRate = computeComprehensionRate(updatedActive)

    return NextResponse.json({
      score_updates: scoreUpdates,
      stats: {
        comprehension_rate: comprehensionRate,
        active_word_count: updatedActive.length,
        words_expanded: wordsExpanded,
      },
    })
  } catch (err) {
    console.error('POST /api/turn error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

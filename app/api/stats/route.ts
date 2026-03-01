import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeComprehensionRate } from '@/lib/word-bank'

export async function GET() {
  try {
    const activeWords = await prisma.word.findMany({ where: { is_active: true } })
    const comprehensionRate = computeComprehensionRate(activeWords)

    const masteredCount = activeWords.filter(
      w => !w.is_grammatical && w.comprehension_score >= 80
    ).length

    const inactiveCount = await prisma.word.count({ where: { is_active: false } })

    const N = activeWords.filter(w => !w.is_grammatical).length
    const nextExpansionAdds = Math.round((N * 0.10) / 0.75)

    return NextResponse.json({
      comprehension_rate: comprehensionRate,
      active_word_count: activeWords.length,
      mastered_count: masteredCount,
      expansion_eligible: comprehensionRate >= 0.85,
      next_expansion_adds: nextExpansionAdds,
      inactive_pool_count: inactiveCount,
    })
  } catch (err) {
    console.error('GET /api/stats error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

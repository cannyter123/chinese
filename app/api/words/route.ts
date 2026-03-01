import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter') // 'active' | 'inactive' | 'all'

    const where =
      filter === 'active'
        ? { is_active: true }
        : filter === 'inactive'
        ? { is_active: false }
        : {}

    const words = await prisma.word.findMany({
      where,
      orderBy: { frequency_rank: 'asc' },
      select: {
        id: true,
        chinese: true,
        pinyin: true,
        english: true,
        frequency_rank: true,
        comprehension_score: true,
        is_active: true,
        is_grammatical: true,
      },
    })

    return NextResponse.json({ words })
  } catch (err) {
    console.error('GET /api/words error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

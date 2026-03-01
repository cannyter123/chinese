import { PrismaClient, Word } from '@prisma/client'

export function getWordWeight(word: Word): number {
  if (word.is_grammatical) return 1.0
  return Math.max(0.1, 1 - (word.comprehension_score / 100) * 0.9)
}

export function computeComprehensionRate(activeWords: Word[]): number {
  const scoreable = activeWords.filter(w => !w.is_grammatical)
  if (!scoreable.length) return 0
  return scoreable.reduce((s, w) => s + w.comprehension_score, 0) / scoreable.length / 100
}

export function updateScore(old: number, delta: number): number {
  return Math.min(100, Math.max(0, old * 0.8 + delta * 100 * 0.2))
}

export async function maybeExpandWordBank(prisma: PrismaClient): Promise<number> {
  const active = await prisma.word.findMany({ where: { is_active: true } })
  const rate = computeComprehensionRate(active)
  if (rate < 0.85) return 0

  const N = active.filter(w => !w.is_grammatical).length
  const M = Math.round((N * 0.10) / 0.75)
  if (M <= 0) return 0

  const next = await prisma.word.findMany({
    where: { is_active: false },
    orderBy: { frequency_rank: 'asc' },
    take: M,
  })
  if (!next.length) return 0

  await prisma.word.updateMany({
    where: { id: { in: next.map(w => w.id) } },
    data: { is_active: true, comprehension_score: 0 },
  })

  await prisma.appState.upsert({
    where: { id: 1 },
    update: { last_expansion_at: new Date() },
    create: { id: 1, last_expansion_at: new Date() },
  })

  return next.length
}

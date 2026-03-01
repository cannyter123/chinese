import { Word } from '@prisma/client'
import { anthropic } from '../anthropic'

export interface ComprehensionResult {
  [wordId: number]: number // delta: 0.0–1.0
}

export async function analyzeComprehension(
  aiChinese: string,
  wordsUsed: Word[],
  userEnglish: string
): Promise<ComprehensionResult> {
  const systemPrompt = `You are a Chinese language comprehension analyst.
For each word the AI used, score 0.0–1.0 how clearly the learner's English reply demonstrates understanding.
1.0 = clearly understood. 0.5 = ambiguous. 0.0 = no evidence or contradicts.
Grammatical particles default to 0.5 unless the reply is semantically wrong.
If the reply is nonsense/unrelated, assign 0.1 to all.
Output ONLY JSON: {"word_id": delta, ...}
Example: {"7": 0.9, "3": 0.5}`

  const wordList = wordsUsed
    .map(w => `- id=${w.id}, chinese=${w.chinese}, pinyin=${w.pinyin}, english=${w.english}${w.is_grammatical ? ' (grammatical)' : ''}`)
    .join('\n')

  const userMessage = `AI said: ${aiChinese}
Words used:
${wordList}
User replied: "${userEnglish}"`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const raw = JSON.parse(jsonMatch[0])
    const result: ComprehensionResult = {}
    for (const [key, value] of Object.entries(raw)) {
      const id = parseInt(key)
      const delta = typeof value === 'number' ? Math.min(1, Math.max(0, value)) : 0.5
      if (!isNaN(id)) result[id] = delta
    }
    return result
  } catch {
    // Fallback: neutral scores for all words
    const fallback: ComprehensionResult = {}
    for (const w of wordsUsed) {
      fallback[w.id] = w.is_grammatical ? 0.5 : 0.5
    }
    return fallback
  }
}

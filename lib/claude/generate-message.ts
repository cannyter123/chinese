import { Word } from '@prisma/client'
import { anthropic } from '../anthropic'
import { getWordWeight } from '../word-bank'
import { validateChinese, buildFallbackSentence } from './validate-chinese'

interface GenerateResult {
  chinese: string
  pinyin: string
}

export async function generateMessage(
  activeWords: Word[],
  recentHistory: string[],
  turnIndex: number
): Promise<GenerateResult> {
  const wordBankEntries = activeWords.map(w => ({
    chinese: w.chinese,
    pinyin: w.pinyin,
    english: w.english,
    weight: parseFloat(getWordWeight(w).toFixed(2)),
  }))

  const systemPrompt = `You are a Chinese language tutor using Comprehensible Input.
Write ONE short Chinese sentence using ONLY the words in the WORD BANK below.
HARD RULE: Do not use any Chinese character not present in the word bank. This is a critical constraint.
Prefer words with higher weight values — these need more practice.
Keep sentences natural, simple, and 4–10 characters long.
Output JSON only: {"chinese": "...", "pinyin": "..."}
No explanation, no English.

WORD BANK:
${JSON.stringify(wordBankEntries, null, 2)}

RECENT HISTORY (avoid repeating these exact sentences):
${recentHistory.length > 0 ? recentHistory.join('\n') : '(none yet)'}`

  const userMessage = `Generate turn ${turnIndex}.`

  async function attempt(): Promise<GenerateResult | null> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Extract JSON (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) return null

    let parsed: GenerateResult
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return null
    }

    if (!parsed.chinese || !parsed.pinyin) return null

    const { valid } = validateChinese(parsed.chinese, activeWords)
    if (!valid) return null

    return parsed
  }

  // Try twice, then fall back
  const first = await attempt()
  if (first) return first

  const second = await attempt()
  if (second) return second

  return buildFallbackSentence(activeWords)
}

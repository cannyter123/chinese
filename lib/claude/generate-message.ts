import { Word } from '@prisma/client'
import { anthropic } from '../anthropic'
import { getWordWeight } from '../word-bank'
import { validateChinese, buildFallbackSentence } from './validate-chinese'

interface GenerateResult {
  chinese: string
  pinyin: string
}

interface HistoryTurn {
  ai_chinese: string
  ai_pinyin: string | null
  user_english: string | null
}

export async function generateMessage(
  activeWords: Word[],
  recentHistory: HistoryTurn[],
  _turnIndex: number
): Promise<GenerateResult> {
  // Build explicit character whitelist — every character Claude can use
  const allChars = new Set<string>()
  for (const w of activeWords) {
    for (const ch of w.chinese) allChars.add(ch)
  }
  const charWhitelist = Array.from(allChars).sort().join(' ')

  const wordUsageCount = new Map<number, number>()
  for (const turn of recentHistory) {
    for (const w of activeWords) {
      if (turn.ai_chinese.includes(w.chinese)) {
        wordUsageCount.set(w.id, (wordUsageCount.get(w.id) ?? 0) + 1)
      }
    }
  }

  const wordBankLines = activeWords
    .map(w => {
      const count = wordUsageCount.get(w.id) ?? 0
      const tag = count > 0 ? ` [used ${count}x recently]` : ''
      return `${w.chinese} (${w.pinyin}) = ${w.english} [weight: ${parseFloat(getWordWeight(w).toFixed(2))}]${tag}`
    })
    .join('\n')

  const lastTurn = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1] : null
  const lastUserReply = lastTurn?.user_english ?? null

  const continuationInstruction = lastUserReply
    ? `The learner just replied: "${lastUserReply}". Try to acknowledge or follow up on what was said — but ONLY if you can do so using characters from the allowed list. If a natural follow-up would require unavailable characters, pick a related or new topic that fits within the allowed characters. Character adherence always takes priority over conversational continuity.`
    : `Start a friendly opening sentence.`

  const systemPrompt = `You are a Chinese language tutor using Comprehensible Input.
Write ONE short Chinese sentence (4–10 characters) using ONLY words from the WORD BANK.

WORD USAGE RULES:
1. Use only COMPLETE words from the WORD BANK. Never use a single character from a multi-character word as a standalone — e.g. if 中国 is in the bank, you cannot write 中 alone.
2. Every character in your sentence must appear in a word from the WORD BANK.
3. Prefer high-weight words NOT marked [used Nx recently] to introduce fresh vocabulary. The higher the count, the more you must avoid that word.
4. Vary the topic each turn — do not write about the same subject (eating, drinking, going somewhere) turn after turn.

ALLOWED CHARACTERS (for reference — but rule 1 above takes priority):
${charWhitelist}

Output JSON only: {"chinese": "...", "pinyin": "..."}

WORD BANK:
${wordBankLines}`

  // Build multi-turn messages so Claude sees the actual conversation history.
  // Anthropic API requires messages to start with 'user' and alternate roles.
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (let i = 0; i < recentHistory.length; i++) {
    const turn = recentHistory[i]
    // user prompt that preceded this AI turn
    const prevReply = i === 0 ? null : recentHistory[i - 1].user_english
    const userMsg = i === 0
      ? 'Start the conversation.'
      : prevReply
        ? `Learner: "${prevReply}". Continue.`
        : 'Continue.'
    messages.push({ role: 'user', content: userMsg })
    messages.push({ role: 'assistant', content: JSON.stringify({ chinese: turn.ai_chinese, pinyin: turn.ai_pinyin ?? '' }) })
  }
  // Final user message — triggers the new generation
  const finalMsg = lastUserReply
    ? `Learner: "${lastUserReply}". ${continuationInstruction}`
    : 'Generate the opening sentence.'
  messages.push({ role: 'user', content: finalMsg })

  async function attempt(attemptNum: number): Promise<GenerateResult | null> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: systemPrompt,
      messages,
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

    const { valid, invalidChars } = validateChinese(parsed.chinese, activeWords)
    if (!valid) {
      console.warn(`[generateMessage] attempt ${attemptNum} invalid — chars not in bank: ${invalidChars.join(', ')} (sentence: ${parsed.chinese})`)
      return null
    }

    return parsed
  }

  // Try up to 3 times, then fall back
  for (let i = 1; i <= 3; i++) {
    const result = await attempt(i)
    if (result) return result
  }

  console.warn('[generateMessage] all attempts failed, using fallback')
  return buildFallbackSentence(activeWords)
}

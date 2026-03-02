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

  const usedSentences = new Set(recentHistory.map(t => t.ai_chinese))

  const continuationInstruction = lastUserReply
    ? `The learner replied: "${lastUserReply}". Use their reply as a cue: if they understood, build on that theme; if they seem confused, try a simpler adjacent idea. Pick the closest topic available in the WORD BANK — your sentence doesn't need to be a direct translation of their words, just topically connected.`
    : `Start a friendly opening sentence.`

  const usedSentenceBlock = recentHistory.length > 0
    ? `\nSENTENCES YOU HAVE ALREADY USED — never repeat these exactly:\n${recentHistory.map(t => t.ai_chinese).join('\n')}\n`
    : ''

  const systemPrompt = `You are a Chinese language tutor using Comprehensible Input.
Write ONE short Chinese sentence (4–10 characters) using ONLY words from the WORD BANK.

WORD USAGE RULES:
1. Use only COMPLETE words from the WORD BANK. Never use a single character from a multi-character word as a standalone — e.g. if 中国 is in the bank, you cannot write 中 alone.
2. Every character in your sentence must appear in a word from the WORD BANK.
3. Prefer high-weight words NOT marked [used Nx recently] to introduce fresh vocabulary. The higher the count, the more you must avoid that word.
4. TOPIC VARIETY — rotate across these domains, never repeat the same domain two turns in a row:
   • People & identity (你/我/他/她/家/名字)
   • Actions & movement (来/去/跑/走/跳/进/出)
   • Eating & drinking (吃/喝/水/饭/茶)
   • Feelings & state (好/快乐/累/忙/笑)
   • Size, quantity & time (大/小/多/少/三/今天/快/慢)
   • Location & direction (里/上/下/家/学校)
   • Questions & observations (是/有/不/会/能/可以)
${usedSentenceBlock}
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
    ? `${continuationInstruction}`
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

    // Reject exact repeats of sentences already used this session
    if (usedSentences.has(parsed.chinese)) {
      console.warn(`[generateMessage] attempt ${attemptNum} duplicate sentence — "${parsed.chinese}"`)
      return null
    }

    const { valid, invalidChars } = validateChinese(parsed.chinese, activeWords)
    if (!valid) {
      console.warn(`[generateMessage] attempt ${attemptNum} invalid — chars not in bank: ${invalidChars.join(', ')} (sentence: ${parsed.chinese})`)
      return null
    }

    return parsed
  }

  // Try up to 5 times, then fall back
  for (let i = 1; i <= 5; i++) {
    const result = await attempt(i)
    if (result) return result
  }

  console.warn('[generateMessage] all attempts failed, using fallback')
  return buildFallbackSentence(activeWords)
}

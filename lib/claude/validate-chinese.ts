import { Word } from '@prisma/client'

// Build character set from all active words
function buildCharSet(words: Word[]): Set<string> {
  const chars = new Set<string>()
  for (const word of words) {
    for (const ch of word.chinese) {
      chars.add(ch)
    }
  }
  return chars
}

// Chinese punctuation that is always allowed
const ALLOWED_PUNCTUATION = new Set([
  '。', '，', '！', '？', '、', '；', '：', '"', '"', '\'', '\'',
  '（', '）', '【', '】', '…', '—', '～', ' ', '\n',
  '.', ',', '!', '?', ';', ':', '"', "'", '(', ')', '[', ']',
])

export function validateChinese(text: string, activeWords: Word[]): {
  valid: boolean
  invalidChars: string[]
} {
  const charSet = buildCharSet(activeWords)
  const invalidChars: string[] = []

  for (const ch of text) {
    // Skip ASCII, punctuation, and spaces
    if (ch.charCodeAt(0) < 128 || ALLOWED_PUNCTUATION.has(ch)) continue
    if (!charSet.has(ch)) {
      invalidChars.push(ch)
    }
  }

  return { valid: invalidChars.length === 0, invalidChars }
}

// Build a fallback sentence from the top-weighted active words
export function buildFallbackSentence(activeWords: Word[]): {
  chinese: string
  pinyin: string
} {
  const nonGram = activeWords
    .filter(w => !w.is_grammatical)
    .sort((a, b) => a.frequency_rank - b.frequency_rank)
    .slice(0, 5)

  if (nonGram.length === 0) {
    return { chinese: '你好', pinyin: 'nǐ hǎo' }
  }

  // Use first available word to construct simple sentence
  const word = nonGram[0]
  return {
    chinese: `${word.chinese}好吗？`,
    pinyin: `${word.pinyin} hǎo ma?`,
  }
}

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

// Build a fallback sentence using a pronoun subject — "X好吗？" is natural Chinese
export function buildFallbackSentence(activeWords: Word[]): {
  chinese: string
  pinyin: string
} {
  // Pronouns make natural subjects for "X好吗？" questions
  const subjectCandidates = ['你', '他', '她', '我们', '你们']
  for (const s of subjectCandidates) {
    const subjectWord = activeWords.find(w => w.chinese === s)
    if (subjectWord) {
      return {
        chinese: `${s}好吗？`,
        pinyin: `${subjectWord.pinyin} hǎo ma?`,
      }
    }
  }
  return { chinese: '你好！', pinyin: 'nǐ hǎo!' }
}

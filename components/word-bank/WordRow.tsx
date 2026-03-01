'use client'

interface Word {
  id: number
  chinese: string
  pinyin: string
  english: string
  frequency_rank: number
  comprehension_score: number
  is_active: boolean
  is_grammatical: boolean
}

function getBadge(word: Word) {
  if (!word.is_active) return { label: 'Upcoming', cls: 'bg-gray-100 text-gray-500' }
  if (word.is_grammatical) return { label: 'Grammar', cls: 'bg-purple-100 text-purple-700' }
  if (word.comprehension_score >= 80) return { label: 'Mastered', cls: 'bg-green-100 text-green-700' }
  if (word.comprehension_score >= 30) return { label: 'Learning', cls: 'bg-blue-100 text-blue-700' }
  return { label: 'New', cls: 'bg-orange-100 text-orange-700' }
}

export default function WordRow({ word }: { word: Word }) {
  const badge = getBadge(word)
  const score = Math.round(word.comprehension_score)

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-400 text-sm">{word.frequency_rank}</td>
      <td className="px-4 py-3 text-xl font-medium">{word.chinese}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{word.pinyin}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{word.english}</td>
      <td className="px-4 py-3">
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </td>
      <td className="px-4 py-3 w-32">
        {word.is_active && !word.is_grammatical && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  score >= 80 ? 'bg-green-500' : score >= 30 ? 'bg-blue-500' : 'bg-orange-400'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{score}%</span>
          </div>
        )}
        {word.is_grammatical && (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  )
}

'use client'

interface ScoreUpdate {
  word_id: number
  chinese: string
  pinyin: string
  delta: number
  score_before: number
  score_after: number
}

interface ScoreUpdatePanelProps {
  updates: ScoreUpdate[]
}

function colorClass(delta: number): string {
  if (delta >= 0.6) return 'text-green-700 bg-green-50 border-green-200'
  if (delta >= 0.3) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
  return 'text-gray-500 bg-gray-50 border-gray-200'
}

function arrow(before: number, after: number) {
  if (after > before) return '▲'
  if (after < before) return '▼'
  return '='
}

export default function ScoreUpdatePanel({ updates }: ScoreUpdatePanelProps) {
  if (!updates.length) return null

  return (
    <div className="mx-4 mb-3 flex flex-wrap gap-2">
      {updates.map(u => (
        <div
          key={u.word_id}
          className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-1 text-xs font-medium ${colorClass(u.delta)}`}
        >
          <span className="font-bold">{u.chinese}</span>
          <span className="text-gray-400">{u.pinyin}</span>
          <span>
            {arrow(u.score_before, u.score_after)}
            {Math.round(u.score_before)}→{Math.round(u.score_after)}
          </span>
        </div>
      ))}
    </div>
  )
}

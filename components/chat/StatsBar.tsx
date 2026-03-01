'use client'

interface StatsBarProps {
  comprehensionRate: number
  activeWordCount: number
  wordsExpanded?: number
}

export default function StatsBar({ comprehensionRate, activeWordCount, wordsExpanded }: StatsBarProps) {
  const pct = Math.round(comprehensionRate * 100)
  const threshold = 85

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Comprehension:</span>
        <span className="font-semibold text-gray-800">{pct}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Active words:</span>
        <span className="font-semibold text-gray-800">{activeWordCount}</span>
      </div>
      <div className="flex-1 flex items-center gap-2 max-w-xs">
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= threshold ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-400">{threshold}%</span>
      </div>
      {wordsExpanded != null && wordsExpanded > 0 && (
        <div className="text-green-600 font-medium animate-pulse">
          +{wordsExpanded} new words unlocked!
        </div>
      )}
      <a href="/word-bank" className="ml-auto text-blue-600 hover:underline text-xs">
        Word Bank →
      </a>
    </div>
  )
}

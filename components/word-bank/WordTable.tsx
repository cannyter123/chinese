'use client'

import { useState } from 'react'
import WordRow from './WordRow'

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

interface WordTableProps {
  words: Word[]
}

type Tab = 'active' | 'upcoming' | 'all'
type SortKey = 'frequency_rank' | 'comprehension_score' | 'chinese'

export default function WordTable({ words }: WordTableProps) {
  const [tab, setTab] = useState<Tab>('active')
  const [sortKey, setSortKey] = useState<SortKey>('frequency_rank')
  const [sortAsc, setSortAsc] = useState(true)

  const filtered = words.filter(w => {
    if (tab === 'active') return w.is_active
    if (tab === 'upcoming') return !w.is_active
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'frequency_rank') cmp = a.frequency_rank - b.frequency_rank
    else if (sortKey === 'comprehension_score') cmp = a.comprehension_score - b.comprehension_score
    else if (sortKey === 'chinese') cmp = a.chinese.localeCompare(b.chinese)
    return sortAsc ? cmp : -cmp
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col
    return (
      <th
        className="px-4 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none"
        onClick={() => handleSort(col)}
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: `Active (${words.filter(w => w.is_active).length})` },
    { key: 'upcoming', label: `Upcoming (${words.filter(w => !w.is_active).length})` },
    { key: 'all', label: `All (${words.length})` },
  ]

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Rank" col="frequency_rank" />
              <SortHeader label="Chinese" col="chinese" />
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Pinyin</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">English</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              <SortHeader label="Score" col="comprehension_score" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(word => (
              <WordRow key={word.id} word={word} />
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-400">No words found</div>
        )}
      </div>
    </div>
  )
}

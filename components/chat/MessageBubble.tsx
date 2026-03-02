'use client'

import { useState, useEffect } from 'react'

interface WordInfo {
  pinyin: string
  english: string
  score: number
}

interface MessageBubbleProps {
  role: 'ai' | 'user'
  chinese?: string
  pinyin?: string
  english?: string
  wordInfoMap?: Record<string, WordInfo>
  loading?: boolean
}

function CharPopover({ char, info, show }: { char: string; info?: WordInfo; show: boolean }) {
  if (!show || !info) return null
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 shadow-lg whitespace-nowrap pointer-events-none">
      <div className="font-medium">{info.pinyin}</div>
      <div className="text-gray-300">{info.english}</div>
      <div className="mt-1 flex items-center gap-1">
        <div className="w-12 bg-gray-600 rounded-full h-1">
          <div
            className="h-full rounded-full bg-blue-400"
            style={{ width: `${info.score}%` }}
          />
        </div>
        <span className="text-gray-400">{Math.round(info.score)}%</span>
      </div>
    </div>
  )
}

export default function MessageBubble({
  role,
  chinese,
  pinyin,
  english,
  wordInfoMap = {},
  loading = false,
}: MessageBubbleProps) {
  const [showPinyin, setShowPinyin] = useState(true)
  const [hoveredChar, setHoveredChar] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (chinese) speak()
  }, [chinese])

  function speak() {
    if (!chinese) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(chinese)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.85
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-xs text-sm">
          {english}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-start mb-3">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs">
          <div className="flex gap-1 items-center h-6">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    )
  }

  if (!chinese) return null

  const chars = Array.from(chinese)

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-sm shadow-sm">
        {/* Chinese characters with hover popover */}
        <div className="flex flex-wrap gap-0.5 text-2xl font-medium text-gray-900">
          {chars.map((ch, i) => {
            const info = wordInfoMap[ch]
            const isHoverable = !!info
            return (
              <span
                key={i}
                className={`relative ${isHoverable ? 'cursor-pointer hover:text-blue-600' : ''}`}
                onMouseEnter={() => isHoverable && setHoveredChar(ch)}
                onMouseLeave={() => setHoveredChar(null)}
              >
                <CharPopover char={ch} info={info} show={hoveredChar === ch} />
                {ch}
              </span>
            )
          })}
        </div>

        {/* Pinyin row */}
        {showPinyin && pinyin && (
          <div className="mt-1 text-sm text-gray-500 tracking-wide">{pinyin}</div>
        )}

        {/* Controls row */}
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => setShowPinyin(p => !p)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showPinyin ? 'Hide pinyin' : 'Show pinyin'}
          </button>
          <button
            onClick={speak}
            title="Listen"
            className={`text-gray-400 hover:text-blue-500 transition-colors ${speaking ? 'text-blue-500' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 3.75a.75.75 0 0 0-1.264-.546L4.703 7H3.167a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 2 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0 0 10 16.25V3.75ZM15.95 5.05a.75.75 0 0 0-1.06 1.061 5.5 5.5 0 0 1 0 7.778.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.899ZM13.828 7.172a.75.75 0 0 0-1.06 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 0 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

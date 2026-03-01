'use client'

import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import ScoreUpdatePanel from './ScoreUpdatePanel'

interface WordInfo {
  pinyin: string
  english: string
  score: number
}

interface ScoreUpdate {
  word_id: number
  chinese: string
  pinyin: string
  delta: number
  score_before: number
  score_after: number
}

export interface ChatMessage {
  id: string
  role: 'ai' | 'user'
  chinese?: string
  pinyin?: string
  english?: string
  wordInfoMap?: Record<string, WordInfo>
  loading?: boolean
  scoreUpdates?: ScoreUpdate[]
}

interface ChatWindowProps {
  messages: ChatMessage[]
}

export default function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((msg, idx) => (
        <div key={msg.id}>
          <MessageBubble
            role={msg.role}
            chinese={msg.chinese}
            pinyin={msg.pinyin}
            english={msg.english}
            wordInfoMap={msg.wordInfoMap}
            loading={msg.loading}
          />
          {msg.scoreUpdates && msg.scoreUpdates.length > 0 && (
            <ScoreUpdatePanel updates={msg.scoreUpdates} />
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

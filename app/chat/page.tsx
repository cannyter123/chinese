'use client'

import { useState, useEffect, useCallback } from 'react'
import ChatWindow, { ChatMessage } from '@/components/chat/ChatWindow'
import InputBar from '@/components/chat/InputBar'
import StatsBar from '@/components/chat/StatsBar'

interface Stats {
  comprehension_rate: number
  active_word_count: number
  words_expanded?: number
}

interface ActiveWord {
  id: number
  chinese: string
  pinyin: string
  english: string
  comprehension_score: number
  is_grammatical: boolean
}

function buildWordInfoMap(activeWords: ActiveWord[]): Record<string, { pinyin: string; english: string; score: number }> {
  const map: Record<string, { pinyin: string; english: string; score: number }> = {}
  for (const w of activeWords) {
    // Map each character to its info (for single-char words; multi-char use first char)
    for (const ch of w.chinese) {
      if (!map[ch]) {
        map[ch] = { pinyin: w.pinyin, english: w.english, score: w.comprehension_score }
      }
    }
  }
  return map
}

let msgIdCounter = 0
function nextId() { return `msg-${++msgIdCounter}` }

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [currentTurnId, setCurrentTurnId] = useState<number | null>(null)
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [stats, setStats] = useState<Stats>({ comprehension_rate: 0, active_word_count: 0 })
  const [activeWords, setActiveWords] = useState<ActiveWord[]>([])
  const [loading, setLoading] = useState(false)
  const [inputDisabled, setInputDisabled] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [lastExpanded, setLastExpanded] = useState(0)

  // Fetch active words for word info map
  async function refreshActiveWords() {
    try {
      const res = await fetch('/api/words?filter=active')
      const data = await res.json()
      setActiveWords(data.words ?? [])
    } catch { /* ignore */ }
  }

  // Fetch stats
  async function refreshStats() {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats({
        comprehension_rate: data.comprehension_rate,
        active_word_count: data.active_word_count,
      })
    } catch { /* ignore */ }
  }

  // Start a new conversation
  const startConversation = useCallback(async () => {
    setLoading(true)
    setInputDisabled(true)

    // Show loading bubble
    const loadingId = nextId()
    setMessages([{
      id: loadingId,
      role: 'ai',
      loading: true,
    }])

    try {
      await refreshActiveWords()
      const res = await fetch('/api/conversation', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setConversationId(data.conversation_id)
      setCurrentTurnId(data.first_turn.id)
      setCurrentTurnIndex(1)

      const wordInfoMap = buildWordInfoMap(activeWords)

      setMessages([{
        id: nextId(),
        role: 'ai',
        chinese: data.first_turn.ai_chinese,
        pinyin: data.first_turn.ai_pinyin,
        wordInfoMap,
      }])

      setInputDisabled(false)
    } catch (err) {
      setMessages([{
        id: nextId(),
        role: 'ai',
        english: 'Failed to start conversation. Please check your API key and try again.',
      }])
    } finally {
      setLoading(false)
    }
  }, [activeWords])

  // Initialize on mount
  useEffect(() => {
    if (!initialized) {
      setInitialized(true)
      refreshActiveWords().then(() => startConversation())
      refreshStats()
    }
  }, [initialized, startConversation])

  async function handleSend(userText: string) {
    if (!conversationId || !currentTurnId || inputDisabled) return

    setInputDisabled(true)

    // Add user message
    const userMsgId = nextId()
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      english: userText,
    }])

    try {
      // Submit reply, get score updates
      const turnRes = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turn_id: currentTurnId, user_english: userText }),
      })
      const turnData = await turnRes.json()

      if (!turnRes.ok) throw new Error(turnData.error)

      const wordsExpanded = turnData.stats?.words_expanded ?? 0
      const newStats: Stats = {
        comprehension_rate: turnData.stats.comprehension_rate,
        active_word_count: turnData.stats.active_word_count,
        words_expanded: wordsExpanded,
      }
      setStats(newStats)
      if (wordsExpanded > 0) {
        setLastExpanded(wordsExpanded)
        setTimeout(() => setLastExpanded(0), 5000)
      }

      // Show score updates on the user message
      if (turnData.score_updates?.length > 0) {
        setMessages(prev => prev.map(m =>
          m.id === userMsgId
            ? { ...m, scoreUpdates: turnData.score_updates }
            : m
        ))
      }

      // Refresh active words (may have expanded)
      await refreshActiveWords()

      // Add loading AI bubble
      const aiLoadingId = nextId()
      setMessages(prev => [...prev, { id: aiLoadingId, role: 'ai', loading: true }])

      // Request next AI message
      const aiRes = await fetch('/api/ai-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, turn_index: currentTurnIndex }),
      })
      const aiData = await aiRes.json()

      if (!aiRes.ok) throw new Error(aiData.error)

      setCurrentTurnId(aiData.turn_id)
      setCurrentTurnIndex(prev => prev + 1)

      // Get fresh word info for new AI message
      const freshWordsRes = await fetch('/api/words?filter=active')
      const freshWordsData = await freshWordsRes.json()
      const freshWords: ActiveWord[] = freshWordsData.words ?? []
      const wordInfoMap = buildWordInfoMap(freshWords)

      // Replace loading with actual AI message
      setMessages(prev => prev.map(m =>
        m.id === aiLoadingId
          ? {
              id: nextId(),
              role: 'ai',
              chinese: aiData.ai_chinese,
              pinyin: aiData.ai_pinyin,
              wordInfoMap,
            }
          : m
      ))
    } catch (err) {
      console.error('handleSend error:', err)
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'ai',
        english: 'Something went wrong. Please try again.',
      }])
    } finally {
      setInputDisabled(false)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <StatsBar
        comprehensionRate={stats.comprehension_rate}
        activeWordCount={stats.active_word_count}
        wordsExpanded={lastExpanded}
      />
      <ChatWindow messages={messages} />
      <InputBar onSend={handleSend} disabled={inputDisabled} />
    </div>
  )
}

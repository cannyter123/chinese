import WordTable from '@/components/word-bank/WordTable'

async function getWords() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/words`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.words ?? []
}

export default async function WordBankPage() {
  const words = await getWords()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Word Bank</h1>
            <p className="text-gray-500 text-sm mt-1">
              Your comprehensible input vocabulary tracker
            </p>
          </div>
          <a
            href="/chat"
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            ← Back to Chat
          </a>
        </div>
        <WordTable words={words} />
      </div>
    </div>
  )
}

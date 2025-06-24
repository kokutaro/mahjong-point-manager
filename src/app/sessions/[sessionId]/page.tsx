'use client'

import SessionHistoryTable from '@/components/SessionHistoryTable'
import { useRouter } from 'next/navigation'
import { use } from 'react'

interface SessionDetailPageProps {
  params: Promise<{
    sessionId: string
  }>
}

export default function SessionDetailPage({ params }: SessionDetailPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const { sessionId } = resolvedParams

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">セッション詳細</h1>
          
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/sessions')}
              className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
            >
              セッション一覧
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              ホーム
            </button>
          </div>
        </div>

        {/* セッション履歴テーブル */}
        <SessionHistoryTable sessionId={sessionId} />
      </div>
    </div>
  )
}
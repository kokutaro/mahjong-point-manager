'use client'

import ErrorDisplay from '@/components/ErrorDisplay'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface SessionSummary {
  id: string
  sessionCode: string
  name: string | null
  status: string
  createdAt: string
  endedAt: string | null
  hostPlayer: {
    id: string
    name: string
  }
  totalGames: number
  participants: {
    playerId: string
    name: string
    position: number
    totalSettlement: number
    gamesPlayed: number
  }[]
  settings: any
}

interface SessionsResponse {
  sessions: SessionSummary[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalSessions, setTotalSessions] = useState(0)
  
  const sessionsPerPage = 10

  const fetchSessions = async (page: number = 1) => {
    try {
      setIsLoading(true)
      setError('')

      const offset = (page - 1) * sessionsPerPage
      const params = new URLSearchParams({
        limit: sessionsPerPage.toString(),
        offset: offset.toString()
      })

      const response = await fetch(`/api/sessions?${params}`, {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'セッション一覧の取得に失敗しました')
      }

      if (data.success) {
        setSessions(data.data.sessions)
        setTotalSessions(data.data.pagination.total)
      } else {
        throw new Error(data.error?.message || 'セッション一覧の取得に失敗しました')
      }
    } catch (error) {
      console.error('Sessions fetch error:', error)
      setError(error instanceof Error ? error.message : 'セッション一覧の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions(currentPage)
  }, [currentPage])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '進行中'
      case 'PAUSED': return '一時停止'
      case 'FINISHED': return '終了'
      case 'CANCELLED': return 'キャンセル'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-50'
      case 'PAUSED': return 'text-yellow-600 bg-yellow-50'
      case 'FINISHED': return 'text-gray-600 bg-gray-50'
      case 'CANCELLED': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const totalPages = Math.ceil(totalSessions / sessionsPerPage)

  if (isLoading && sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">セッション一覧を読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">連続対局セッション</h1>
              <p className="text-gray-600 mt-1">連続対局の履歴と統計を確認できます</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/history')}
                className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
              >
                単発対局履歴
              </button>
              <button
                onClick={() => router.push('/')}
                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
              >
                ホームに戻る
              </button>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <ErrorDisplay
            error={{ type: 'general', message: error, isRetryable: true }}
            onRetry={() => fetchSessions(currentPage)}
            onDismiss={() => setError('')}
          />
        )}

        {/* セッション一覧 */}
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* セッション情報ヘッダー */}
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-gray-800">
                      {session.name || `セッション ${session.sessionCode}`}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {getStatusLabel(session.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>ホスト: {session.hostPlayer.name}</div>
                    <div>対局数: {session.totalGames}局</div>
                  </div>
                </div>
              </div>

              {/* 参加者結果 */}
              <div className="p-4 sm:p-6">
                <div className="grid gap-3 sm:gap-4">
                  {session.participants
                    .sort((a, b) => a.position - b.position)
                    .map((participant) => (
                      <div
                        key={participant.playerId}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                            {participant.position + 1}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">
                              {participant.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {participant.gamesPlayed}局参加
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            participant.totalSettlement >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {participant.totalSettlement >= 0 ? '+' : ''}{participant.totalSettlement.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            累計精算
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* 詳細表示ボタン */}
                <div className="mt-4 text-center">
                  <button
                    onClick={() => router.push(`/sessions/${session.id}`)}
                    className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    詳細履歴を表示
                  </button>
                </div>
              </div>

              {/* 日時情報 */}
              <div className="bg-gray-50 px-4 sm:px-6 py-2 border-t text-xs text-gray-600">
                <div>開始: {new Date(session.createdAt).toLocaleString()}</div>
                {session.endedAt && (
                  <div>終了: {new Date(session.endedAt).toLocaleString()}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mt-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600">
                {(currentPage - 1) * sessionsPerPage + 1}-{Math.min(currentPage * sessionsPerPage, totalSessions)} / {totalSessions}件
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  前へ
                </button>
                
                {/* ページ番号 */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  次へ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 空状態 */}
        {!isLoading && sessions.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">セッション履歴がありません</h3>
            <p className="text-gray-600 mb-4">まだ連続対局セッションが作成されていません。</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              セッションを開始する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
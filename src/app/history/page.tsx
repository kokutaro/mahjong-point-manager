'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ErrorDisplay from '@/components/ErrorDisplay'

interface GameHistory {
  id: string
  roomCode: string
  gameType: 'TONPUU' | 'HANCHAN'
  startedAt: string
  endedAt: string
  duration: number | null
  players: {
    playerId: string
    name: string
    position: number
    finalPoints: number
    finalRank: number
    uma: number
    oka: number
    settlement: number
  }[]
  settings: {
    gameType: string
    initialPoints: number
    basePoints: number
    uma: any
    oka: number
  }
}

interface HistoryResponse {
  games: GameHistory[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export default function HistoryPage() {
  const router = useRouter()
  const [games, setGames] = useState<GameHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalGames, setTotalGames] = useState(0)
  
  const gamesPerPage = 10

  const fetchHistory = async (page: number = 1, gameType: string = '') => {
    try {
      setIsLoading(true)
      setError('')

      const offset = (page - 1) * gamesPerPage
      const params = new URLSearchParams({
        limit: gamesPerPage.toString(),
        offset: offset.toString()
      })

      if (gameType) {
        params.append('gameType', gameType)
      }

      const response = await fetch(`/api/history?${params}`, {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || '履歴の取得に失敗しました')
      }

      if (data.success) {
        setGames(data.data.games)
        setTotalGames(data.data.pagination.total)
      } else {
        throw new Error(data.error?.message || '履歴の取得に失敗しました')
      }
    } catch (error) {
      console.error('History fetch error:', error)
      setError(error instanceof Error ? error.message : '履歴の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory(currentPage, gameTypeFilter)
  }, [currentPage, gameTypeFilter])

  const handleGameTypeChange = (type: string) => {
    setGameTypeFilter(type)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`
  }

  const getRankColor = (rank: number | null) => {
    if (rank === null || rank === undefined) return 'text-gray-600 bg-gray-50'
    switch (rank) {
      case 1: return 'text-yellow-600 bg-yellow-50'
      case 2: return 'text-gray-600 bg-gray-50'
      case 3: return 'text-orange-600 bg-orange-50'
      case 4: return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getRankEmoji = (rank: number | null) => {
    if (rank === null || rank === undefined) return '-'
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      case 4: return '4位'
      default: return rank.toString()
    }
  }

  const totalPages = Math.ceil(totalGames / gamesPerPage)

  if (isLoading && games.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">履歴を読み込み中...</div>
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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">対局履歴</h1>
              <p className="text-gray-600 mt-1">過去の対局結果を確認できます</p>
            </div>
            
            <button
              onClick={() => router.push('/')}
              className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
            >
              ホームに戻る
            </button>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <ErrorDisplay
            error={{ type: 'general', message: error, isRetryable: true }}
            onRetry={() => fetchHistory(currentPage, gameTypeFilter)}
            onDismiss={() => setError('')}
          />
        )}

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="text-sm font-medium text-gray-700">
              ゲームタイプ:
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleGameTypeChange('')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  gameTypeFilter === ''
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => handleGameTypeChange('TONPUU')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  gameTypeFilter === 'TONPUU'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                東風戦
              </button>
              <button
                onClick={() => handleGameTypeChange('HANCHAN')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  gameTypeFilter === 'HANCHAN'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                半荘戦
              </button>
            </div>
            
            <div className="ml-auto text-sm text-gray-600">
              総対局数: {totalGames}局
            </div>
          </div>
        </div>

        {/* 対局一覧 */}
        <div className="space-y-4">
          {games.map((game) => (
            <div key={game.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* ゲーム情報ヘッダー */}
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-gray-800">
                      {game.gameType === 'TONPUU' ? '東風戦' : '半荘戦'}
                    </span>
                    <span className="text-sm text-gray-600">
                      ルーム: {game.roomCode}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>{new Date(game.endedAt).toLocaleString()}</div>
                    <div>所要時間: {formatDuration(game.duration)}</div>
                  </div>
                </div>
              </div>

              {/* プレイヤー結果 */}
              <div className="p-4 sm:p-6">
                <div className="grid gap-3 sm:gap-4">
                  {game.players
                    .sort((a, b) => a.finalRank - b.finalRank)
                    .map((player) => (
                      <div
                        key={player.playerId}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          player.finalRank === 1 ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${getRankColor(player.finalRank)}`}>
                            {getRankEmoji(player.finalRank)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">
                              {player.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {player.finalPoints.toLocaleString()}点
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            player.settlement >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {player.settlement >= 0 ? '+' : ''}{player.settlement.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            ウマ: {player.uma >= 0 ? '+' : ''}{player.uma}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mt-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600">
                {(currentPage - 1) * gamesPerPage + 1}-{Math.min(currentPage * gamesPerPage, totalGames)} / {totalGames}件
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
        {!isLoading && games.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">対局履歴がありません</h3>
            <p className="text-gray-600 mb-4">まだ完了した対局がありません。</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              対局を開始する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UnifiedHistoryProps {
  defaultView?: 'sessions' | 'games'
  showToggle?: boolean
}

interface SessionData {
  id: string
  sessionCode: string
  name?: string
  status: string
  createdAt: string
  endedAt?: string
  hostPlayer: {
    id: string
    name: string
  }
  totalGames: number
  participants: Array<{
    playerId: string
    name: string
    position: number
    totalSettlement: number
    gamesPlayed: number
  }>
}

interface GameData {
  id: string
  roomCode: string
  gameType: string
  startedAt: string
  endedAt: string
  duration: number
  players: Array<{
    playerId: string
    name: string
    position: number
    finalPoints: number
    finalRank: number
    uma: number
    settlement: number
  }>
}

export default function UnifiedHistory({ 
  defaultView = 'sessions', 
  showToggle = true 
}: UnifiedHistoryProps) {
  const [currentView, setCurrentView] = useState<'sessions' | 'games'>(defaultView)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [games, setGames] = useState<GameData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (currentView === 'sessions') {
      fetchSessions()
    } else {
      fetchGames()
    }
  }, [currentView])

  const fetchSessions = async () => {
    try {
      setIsLoading(true)
      setError('')
      
      const response = await fetch('/api/sessions', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setSessions(data.data.sessions || [])
      } else {
        throw new Error(data.error?.message || 'セッション取得に失敗しました')
      }
    } catch (error) {
      console.error('Sessions fetch error:', error)
      setError(error instanceof Error ? error.message : 'セッション取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGames = async () => {
    try {
      setIsLoading(true)
      setError('')
      
      const response = await fetch('/api/history', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setGames(data.data.games || [])
      } else {
        throw new Error(data.error?.message || '履歴取得に失敗しました')
      }
    } catch (error) {
      console.error('Games fetch error:', error)
      setError(error instanceof Error ? error.message : '履歴取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
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

  const formatGameType = (gameType: string) => {
    return gameType === 'TONPUU' ? '東風戦' : '半荘戦'
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}時間${mins}分`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                対局履歴
              </h1>
              <p className="text-gray-600 mt-1">
                過去の対局結果と統計を確認できます
              </p>
            </div>
            
            <button
              onClick={() => router.push('/')}
              className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
            >
              ホームに戻る
            </button>
          </div>

          {/* タブ切り替え */}
          {showToggle && (
            <div className="mt-6 border-b">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setCurrentView('sessions')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    currentView === 'sessions'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  セッション履歴
                </button>
                <button
                  onClick={() => setCurrentView('games')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    currentView === 'games'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  単発対局履歴
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-600">{error}</div>
            <button
              onClick={() => currentView === 'sessions' ? fetchSessions() : fetchGames()}
              className="mt-2 bg-red-600 text-white py-1 px-3 rounded text-sm hover:bg-red-700"
            >
              再試行
            </button>
          </div>
        )}

        {/* ローディング */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-xl text-gray-600">読み込み中...</div>
          </div>
        )}

        {/* セッション履歴 */}
        {!isLoading && currentView === 'sessions' && (
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="text-gray-500 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">セッション履歴がありません</h3>
                <p className="text-gray-600">まだ連続対局セッションが作成されていません。</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
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

                    <div className="mt-4 text-center">
                      <button
                        onClick={() => router.push(`/sessions/${session.id}`)}
                        className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        詳細履歴を表示
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-4 sm:px-6 py-2 border-t text-xs text-gray-600">
                    <div>開始: {new Date(session.createdAt).toLocaleString()}</div>
                    {session.endedAt && (
                      <div>終了: {new Date(session.endedAt).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 単発対局履歴 */}
        {!isLoading && currentView === 'games' && (
          <div className="space-y-4">
            {games.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="text-gray-500 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">単発対局履歴がありません</h3>
                <p className="text-gray-600">まだ単発対局が記録されていません。</p>
              </div>
            ) : (
              games.map((game) => (
                <div key={game.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-gray-800">
                          {formatGameType(game.gameType)}
                        </span>
                        <span className="text-sm text-gray-600">
                          ルーム: {game.roomCode}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>{formatDuration(game.duration)}</div>
                        <div>{new Date(game.endedAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6">
                    <div className="grid gap-3">
                      {game.players
                        .sort((a, b) => a.finalRank - b.finalRank)
                        .map((player) => (
                          <div
                            key={player.playerId}
                            className="flex items-center justify-between p-3 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                player.finalRank === 1 ? 'bg-yellow-100 text-yellow-800' :
                                player.finalRank === 2 ? 'bg-gray-100 text-gray-800' :
                                player.finalRank === 3 ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {player.finalRank}
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
                                精算
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
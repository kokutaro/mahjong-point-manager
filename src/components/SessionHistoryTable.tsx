'use client'

import { useEffect, useState } from 'react'
import ErrorDisplay from './ErrorDisplay'

interface SessionPlayer {
  playerId: string
  name: string
  position: number
  totalGames: number
  totalSettlement: number
  firstPlace: number
  secondPlace: number
  thirdPlace: number
  fourthPlace: number
}

interface GameResult {
  gameNumber: number
  gameId: string
  gameType: 'TONPUU' | 'HANCHAN'
  endedAt: string | null
  results: Record<string, number> // playerId -> settlement
}

interface SessionDetails {
  session: {
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
  }
  players: SessionPlayer[]
  gameResults: GameResult[]
  totalRow: Record<string, number>
  settings: {
    gameType?: string
    initialPoints?: number
    uma?: number[]
  } | null
}

interface SessionHistoryTableProps {
  sessionId: string
}

export default function SessionHistoryTable({ sessionId }: SessionHistoryTableProps) {
  const [sessionData, setSessionData] = useState<SessionDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchSessionDetails = async () => {
    try {
      setIsLoading(true)
      setError('')

      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'セッション詳細の取得に失敗しました')
      }

      if (data.success) {
        setSessionData(data.data)
      } else {
        throw new Error(data.error?.message || 'セッション詳細の取得に失敗しました')
      }
    } catch (error) {
      console.error('Session details fetch error:', error)
      setError(error instanceof Error ? error.message : 'セッション詳細の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-xl text-gray-600">セッション履歴を読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorDisplay
        error={{ type: 'general', message: error, isRetryable: true }}
        onRetry={fetchSessionDetails}
        onDismiss={() => setError('')}
      />
    )
  }

  if (!sessionData) {
    return (
      <div className="text-center p-8">
        <div className="text-gray-500">セッションデータがありません</div>
      </div>
    )
  }

  const { session, players, gameResults, totalRow } = sessionData

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* セッション情報ヘッダー */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {session.name || `セッション ${session.sessionCode}`}
            </h2>
            <div className="text-sm text-gray-600 mt-1">
              ホスト: {session.hostPlayer.name} | 総対局数: {gameResults.length}局
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <div>開始: {new Date(session.createdAt).toLocaleString()}</div>
            {session.endedAt && (
              <div>終了: {new Date(session.endedAt).toLocaleString()}</div>
            )}
          </div>
        </div>
      </div>

      {/* 対局履歴テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700 border-r">局数</th>
              {players
                .sort((a, b) => a.position - b.position)
                .map((player) => (
                  <th 
                    key={player.playerId} 
                    className="px-4 py-3 text-center font-medium text-gray-700 border-r last:border-r-0"
                  >
                    {player.name}
                    <div className="text-xs text-gray-500 font-normal">
                      (座席{player.position + 1})
                    </div>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {/* 各対局の結果 */}
            {gameResults.map((game) => (
              <tr key={game.gameNumber} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 border-r">
                  {game.gameNumber}局
                  <div className="text-xs text-gray-500">
                    {game.gameType === 'TONPUU' ? '東風' : '半荘'}
                  </div>
                </td>
                {players
                  .sort((a, b) => a.position - b.position)
                  .map((player) => {
                    const settlement = game.results[player.playerId] || 0
                    return (
                      <td 
                        key={player.playerId} 
                        className="px-4 py-3 text-center border-r last:border-r-0"
                      >
                        <span className={`font-medium ${
                          settlement > 0 
                            ? 'text-green-600' 
                            : settlement < 0 
                              ? 'text-red-600' 
                              : 'text-gray-600'
                        }`}>
                          {settlement > 0 ? '+' : ''}{settlement.toLocaleString()}
                        </span>
                      </td>
                    )
                  })}
              </tr>
            ))}
            
            {/* 合計行 */}
            {gameResults.length > 0 && (
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                <td className="px-4 py-3 text-gray-800 border-r">合計</td>
                {players
                  .sort((a, b) => a.position - b.position)
                  .map((player) => {
                    const total = totalRow[player.playerId] || 0
                    return (
                      <td 
                        key={player.playerId} 
                        className="px-4 py-3 text-center border-r last:border-r-0"
                      >
                        <span className={`text-lg font-bold ${
                          total > 0 
                            ? 'text-green-600' 
                            : total < 0 
                              ? 'text-red-600' 
                              : 'text-gray-600'
                        }`}>
                          {total > 0 ? '+' : ''}{total.toLocaleString()}
                        </span>
                      </td>
                    )
                  })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 対局がない場合 */}
      {gameResults.length === 0 && (
        <div className="text-center p-8">
          <div className="text-gray-500">まだ完了した対局がありません</div>
        </div>
      )}

      {/* セッション統計 */}
      {gameResults.length > 0 && (
        <div className="bg-gray-50 px-6 py-4 border-t">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">セッション統計</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {players
              .sort((a, b) => a.position - b.position)
              .map((player) => (
                <div key={player.playerId} className="text-center">
                  <div className="font-medium text-gray-800">{player.name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    <div>1位: {player.firstPlace}回</div>
                    <div>2位: {player.secondPlace}回</div>
                    <div>3位: {player.thirdPlace}回</div>
                    <div>4位: {player.fourthPlace}回</div>
                  </div>
                  <div className="text-sm font-semibold mt-2">
                    平均: {player.totalGames > 0 
                      ? (player.totalSettlement / player.totalGames).toFixed(1)
                      : '0'
                    }
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
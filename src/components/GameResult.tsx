'use client'

import { useCallback, useEffect, useState } from 'react'
import { useMatchHistory } from '@/hooks/useMatchHistory'
import { useSessionStore, useUIStore } from '@/store/useAppStore'
import { useAuth } from '@/contexts/AuthContext'
import { io, Socket } from 'socket.io-client'

interface PlayerResult {
  playerId: string
  name: string
  finalPoints: number
  rank: number
  uma: number
  settlement: number
}

interface GameResultData {
  gameId: string
  roomCode: string
  results: PlayerResult[]
  gameType: 'TONPUU' | 'HANCHAN'
  endReason: string
  endedAt: string
  basePoints: number
  sessionId?: string
  sessionCode?: string
  sessionName?: string
}

interface GameResultProps {
  gameId: string
  onBack: () => void
}

export default function GameResult({ gameId, onBack }: GameResultProps) {
  const [resultData, setResultData] = useState<GameResultData | null>(null)
  const [error, setError] = useState('')
  const { addResult } = useMatchHistory()
  
  // 全員合意システム用のstate
  const [continueVotes, setContinueVotes] = useState<Record<string, boolean>>({})
  const [isWaitingForVotes, setIsWaitingForVotes] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  
  // Zustand ストア
  const { setSession } = useSessionStore()
  const { isLoading, setLoading, setError: setGlobalError } = useUIStore()
  const { user } = useAuth()

  const fetchGameResult = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/game/${gameId}/result`, {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      console.log('GameResult API Response:', { status: response.status, data })

      if (!response.ok) {
        throw new Error(data.error?.message || '結果の取得に失敗しました')
      }

      if (data.success) {
        console.log('Setting result data:', data.data)
        setResultData(data.data)
      } else {
        throw new Error(data.error?.message || '結果の取得に失敗しました')
      }
    } catch (error) {
      console.error('fetchGameResult error:', error)
      setError(error instanceof Error ? error.message : '結果の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    fetchGameResult()
  }, [fetchGameResult])

  // WebSocket接続とイベントハンドリング
  useEffect(() => {
    if (!resultData) return
    
    const socketInstance = io('/', {
      query: { gameId }
    })
    
    setSocket(socketInstance)
    
    // WebSocket接続完了後にルームに参加
    socketInstance.on('connect', () => {
      console.log('WebSocket connected, joining room for game result')
      console.log('User:', user)
      console.log('ResultData:', resultData)
      if (user && resultData) {
        console.log(`🔌 Attempting to join room: ${resultData.roomCode} with playerId: ${user.playerId}`)
        socketInstance.emit('join_room', {
          roomCode: resultData.roomCode,
          playerId: user.playerId
        })
        console.log(`🔌 join_room event emitted for room ${resultData.roomCode}`)
      }
    })
    
    // ルーム参加成功の確認
    socketInstance.on('game_state', (gameState) => {
      console.log('🔌 Received game_state after joining room:', gameState)
    })
    
    // エラーハンドリング
    socketInstance.on('error', (error) => {
      console.error('🔌 WebSocket error:', error)
    })
    
    // セッション継続投票の受信
    socketInstance.on('continue-vote', ({ playerId, vote }: { playerId: string, vote: boolean }) => {
      setContinueVotes(prev => ({ ...prev, [playerId]: vote }))
    })
    
    // 全員合意後の新ルーム通知
    socketInstance.on('new-room-ready', ({ roomCode }: { roomCode: string }) => {
      window.location.href = `/room/${roomCode}`
    })
    
    // 投票キャンセル通知
    socketInstance.on('vote-cancelled', ({ message }: { message: string }) => {
      setIsWaitingForVotes(false)
      setContinueVotes({})
      alert(message)
    })
    
    return () => {
      socketInstance.disconnect()
    }
  }, [resultData, gameId])

  useEffect(() => {
    if (resultData) {
      try {
        const scores = resultData.results.map(r => ({
          playerId: r.playerId,
          name: r.name,
          points: r.finalPoints
        }))
        addResult({ gameId: resultData.gameId, scores })
      } catch (err) {
        console.error('Failed to add result to match history:', err)
        // LocalStorageエラーがあっても処理を継続
      }
    }
  }, [resultData]) // addResultを依存配列から削除

  const handleContinueSession = () => {
    if (!resultData || !socket || !user) return
    
    // 投票を送信
    setIsWaitingForVotes(true)
    socket.emit('continue-vote', { 
      gameId: resultData.gameId, 
      playerId: user.playerId, 
      vote: true 
    })
  }

  const handleNewSession = async () => {
    if (!resultData) return
    try {
      setLoading(true)
      const res = await fetch(`/api/game/${resultData.gameId}/rematch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          continueSession: false,
          newSessionName: '新しいセッション'
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // 新セッション情報を設定（LocalStorageエラーを無視）
        try {
          if (data.data.sessionId) {
            setSession({
              id: data.data.sessionId,
              sessionCode: data.data.sessionCode,
              name: '新しいセッション',
              status: 'ACTIVE',
              hostPlayerId: resultData.results[0].playerId,
              totalGames: 0,
              createdAt: new Date().toISOString()
            })
          }
        } catch (storageErr) {
          console.error('Failed to save session to localStorage:', storageErr)
          // LocalStorageエラーは無視して処理継続
        }
        window.location.href = `/room/${data.data.roomCode}`
      } else {
        setGlobalError(data.error?.message || '新セッション作成に失敗しました')
      }
    } catch (err) {
      console.error('New session failed:', err)
      // LocalStorageエラーとネットワークエラーを区別
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        setGlobalError('ストレージ容量不足です。ブラウザのデータをクリアしてください。')
      } else {
        setGlobalError('新セッション作成に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }



  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-600 bg-yellow-50'
      case 2: return 'text-gray-600 bg-gray-50'
      case 3: return 'text-orange-600 bg-orange-50'
      case 4: return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      case 4: return '4位'
      default: return rank.toString()
    }
  }

  const formatPoints = (points: number) => {
    return points >= 0 ? `+${points.toLocaleString()}` : points.toLocaleString()
  }

  const formatSettlement = (settlement: number) => {
    return settlement >= 0 ? `+${settlement.toLocaleString()}` : settlement.toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">結果を読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={onBack}
            className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  if (!resultData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-gray-600 mb-4">結果が見つかりません</div>
          <div className="text-xs text-gray-400 mb-4">Debug: resultData is {JSON.stringify(resultData)}</div>
          <button
            onClick={onBack}
            className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">対局結果</h1>
            <div className="text-gray-600">
              <div className="mb-1">
                {resultData.gameType === 'TONPUU' ? '東風戦' : '半荘戦'}
              </div>
              {resultData.sessionId && (
                <div className="text-sm mb-1">
                  セッション: {resultData.sessionName || `#${resultData.sessionCode}`}
                </div>
              )}
              <div className="text-sm">
                終了理由: {resultData.endReason}
              </div>
              <div className="text-sm">
                終了時刻: {new Date(resultData.endedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* 順位表 */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-gray-50 px-6 py-3 border-b">
            <h2 className="text-xl font-semibold text-gray-800">最終順位</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    順位
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    プレイヤー
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最終点数
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ウマ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    精算
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {resultData.results.map((result) => (
                  <tr key={result.playerId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRankColor(result.rank)}`}>
                        <span className="mr-2">{getRankEmoji(result.rank)}</span>
                        {result.rank}位
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {result.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-mono text-gray-900">
                        {result.finalPoints.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-mono ${result.uma >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPoints(result.uma)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-lg font-bold font-mono ${result.settlement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatSettlement(result.settlement)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 点数詳細 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">精算詳細</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {resultData.results.map((result) => (
              <div key={result.playerId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-gray-900">{result.name}</div>
                  <div className={`px-2 py-1 rounded text-sm font-medium ${getRankColor(result.rank)}`}>
                    {result.rank}位
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">最終点数:</span>
                    <span className="font-mono">{result.finalPoints.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">基準点差分:</span>
                    <span className="font-mono">
                      {formatPoints(result.finalPoints - 30000)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">精算点数:</span>
                    <span className="font-mono">
                      {(() => {
                        if (result.rank === 1) {
                          // 1位の場合は、他のプレイヤーの精算点数の合計の符号反転
                          const othersTotal = resultData.results
                            .filter(r => r.rank !== 1)
                            .reduce((sum, r) => {
                              const diff = r.finalPoints - 30000
                              return sum + (diff >= 0 ? Math.floor(diff / 1000) : Math.ceil(diff / 1000))
                            }, 0)
                          return othersTotal > 0 ? `+${-othersTotal}` : `${-othersTotal}`
                        } else {
                          // 1位以外の場合は通常計算
                          const diff = result.finalPoints - 30000
                          if (diff >= 0) {
                            return `+${Math.floor(diff / 1000)}`
                          } else {
                            return `${Math.ceil(diff / 1000)}`
                          }
                        }
                      })()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">ウマ:</span>
                    <span className={`font-mono ${result.uma >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPoints(result.uma)}
                    </span>
                  </div>
                  
                  <hr className="my-2" />
                  
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>計算式:</span>
                    <span className="font-mono">
                      {(() => {
                        let roundedDiff: number
                        if (result.rank === 1) {
                          // 1位の場合は、他のプレイヤーの精算点数の合計の符号反転
                          const othersTotal = resultData.results
                            .filter(r => r.rank !== 1)
                            .reduce((sum, r) => {
                              const diff = r.finalPoints - (resultData.basePoints || 30000)
                              return sum + (diff >= 0 ? Math.floor(diff / 1000) : Math.ceil(diff / 1000))
                            }, 0)
                          roundedDiff = -othersTotal
                        } else {
                          // 1位以外の場合は通常計算
                          const diff = result.finalPoints - (resultData.basePoints || 30000)
                          roundedDiff = diff >= 0 ? Math.floor(diff / 1000) : Math.ceil(diff / 1000)
                        }
                        
                        const uma = result.uma
                        return `${roundedDiff > 0 ? '+' : ''}${roundedDiff} + ${uma > 0 ? '+' : ''}${uma}`
                      })()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-800">精算:</span>
                    <span className={`font-mono text-lg ${result.settlement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatSettlement(result.settlement)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="text-center">
          <div className="mb-4">
            <button
              onClick={onBack}
              className="bg-gray-500 text-white py-3 px-6 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors mr-4"
            >
              ゲームに戻る
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              ホームに戻る
            </button>
          </div>

          {/* 継続オプション */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-3">対局を続けますか？</h3>
            
            {isWaitingForVotes ? (
              <div className="space-y-4">
                <div className="text-center text-green-700 font-medium">
                  全員の合意を待っています...
                </div>
                
                {/* 投票状況の表示 */}
                <div className="grid grid-cols-2 gap-2">
                  {resultData.results.map((result) => {
                    // 自分の場合は常に「合意」として表示
                    const isMyself = user?.playerId === result.playerId
                    const voteStatus = isMyself 
                      ? true 
                      : continueVotes[result.playerId]
                    
                    return (
                      <div key={result.playerId} className="flex items-center justify-between p-2 bg-white rounded">
                        <span className="text-sm font-medium">{result.name}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          voteStatus === true
                            ? 'bg-green-100 text-green-800'
                            : voteStatus === false
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {voteStatus === true 
                            ? '合意' 
                            : voteStatus === false 
                              ? '辞退' 
                              : '待機中'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                <button
                  onClick={() => {
                    if (!resultData || !socket || !user) return
                    
                    // キャンセル投票を送信（vote: false）
                    socket.emit('continue-vote', { 
                      gameId: resultData.gameId, 
                      playerId: user.playerId, 
                      vote: false 
                    })
                    
                    setIsWaitingForVotes(false)
                    setContinueVotes({})
                  }}
                  className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {resultData.sessionId ? (
                  <button
                    onClick={handleContinueSession}
                    className="w-full sm:w-auto bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors mr-0 sm:mr-4 mb-3 sm:mb-0"
                  >
                    セッション継続（全員合意）
                  </button>
                ) : null}
                
                <button
                  onClick={handleNewSession}
                  className="w-full sm:w-auto bg-emerald-600 text-white py-3 px-6 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
                >
                  新しいセッション
                </button>
              </div>
            )}
            
            <div className="mt-3 text-sm text-green-700">
              {resultData.sessionId ? (
                <p>
                  <strong>セッション継続:</strong> 全員が合意すると自動的に次局を開始
                  <br />
                  <strong>新しいセッション:</strong> 同じメンバーで新しいセッションを作成
                </p>
              ) : (
                <p>同じメンバーで新しいセッションを開始します</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
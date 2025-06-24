'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useMatchHistory } from '@/hooks/useMatchHistory'
import { useUIStore } from '@/store/useAppStore'
import { useAuth } from '@/contexts/AuthContext'
import { io, Socket } from 'socket.io-client'
import ForceEndConfirmModal from './ForceEndConfirmModal'
import AlertModal from './AlertModal'
import VotingProgress, { VoteOption, VoteState } from './VotingProgress'
import { analyzeVotes, VoteResult } from '@/lib/vote-analysis'

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
  hostPlayerId?: string
}

interface GameResultProps {
  gameId: string
  onBack: () => void
}

export default function GameResult({ gameId, onBack }: GameResultProps) {
  const [resultData, setResultData] = useState<GameResultData | null>(null)
  const [error, setError] = useState('')
  const { addResult } = useMatchHistory()
  
  // 全員合意システム用のstate（従来の継続投票）
  const [continueVotes, setContinueVotes] = useState<Record<string, boolean>>({})
  const [isWaitingForVotes, setIsWaitingForVotes] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  
  // Phase 3: 3択投票システム用のstate
  const [sessionVotes, setSessionVotes] = useState<VoteState>({})
  const [isWaitingForSessionVotes, setIsWaitingForSessionVotes] = useState(false)
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null)
  const [voteTimeout, setVoteTimeout] = useState<NodeJS.Timeout | null>(null)
  const [voteStartTime, setVoteStartTime] = useState<string | null>(null)
  
  // 強制終了システム用のstate
  const [showForceEndModal, setShowForceEndModal] = useState(false)
  const [isForceEnding, setIsForceEnding] = useState(false)
  const [notification, setNotification] = useState<{
    message: string
    countdown?: number
    action?: () => void
  } | null>(null)

  // Next game transition helper refs
  const nextRoomCodeRef = useRef<string | null>(null)
  const hasSentContinueRef = useRef(false)

  const startNextGameCountdown = useCallback(() => {
    const code = nextRoomCodeRef.current
    if (!code) return
    setNotification({
      message: '次の対局の準備ができました。5秒後に自動的に遷移します。',
      countdown: 5,
      action: () => {
        window.location.href = `/room/${code}`
      },
    })
  }, [])
  
  // Zustand ストア
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
      nextRoomCodeRef.current = roomCode
      hasSentContinueRef.current = false
      setIsWaitingForVotes(false)
      startNextGameCountdown()
    })
    
    // 投票キャンセル通知
    socketInstance.on('vote-cancelled', ({ message }: { message: string }) => {
      setIsWaitingForVotes(false)
      setContinueVotes({})
      hasSentContinueRef.current = false
      setNotification({ message, action: () => setNotification(null) })
    })
    
    // セッション強制終了通知
    socketInstance.on('session_force_ended', ({ reason, endedBy }: { 
      reason: string, 
      endedBy: { playerId: string, name: string } 
    }) => {
      // ホスト以外のプレイヤーに通知
      if (user?.playerId !== endedBy.playerId) {
        setNotification({
          message: `セッションが${endedBy.name}により強制終了されました。\n理由: ${reason}\n\n5秒後にホームページに遷移します。`,
          countdown: 5,
          action: () => {
            window.location.href = '/'
          }
        })
      }
    })
    
    // Phase 3: セッション投票関連のWebSocketイベント
    socketInstance.on('session_vote_update', ({ votes, result, voterName }: { 
      votes: VoteState, 
      result: VoteResult, 
      voterName: string 
    }) => {
      setSessionVotes(votes)
      setVoteResult(result)
      
      // 投票が入った通知（自分以外）
      if (user?.name !== voterName) {
        console.log(`${voterName}が投票しました`)
      }
    })
    
    // 全員合意によるセッション終了
    socketInstance.on('session_ended_by_consensus', ({ reason, voteDetails }: {
      reason: string,
      voteDetails: any
    }) => {
      setNotification({
        message: `セッションが終了しました。\n理由: ${reason}\n\n5秒後にホームページに遷移します。`,
        countdown: 5,
        action: () => {
          window.location.href = '/'
        }
      })
    })
    
    // 継続合意によるプロセス開始
    socketInstance.on('session_continue_agreed', ({ continueVotes }: {
      continueVotes: number
    }) => {
      startNextGameCountdown()

      if (!nextRoomCodeRef.current) {
        setNotification({
          message: `${continueVotes}名が継続を希望しています。次の対局を準備中です...`,
          action: () => setNotification(null),
        })
      }

      if (!hasSentContinueRef.current) {
        hasSentContinueRef.current = true
        handleContinueSession()
      }

      // move existing vote state into continuation phase
      resetSessionVote()
    })
    
    // 投票タイムアウト通知
    socketInstance.on('vote_timeout', () => {
      setNotification({
        message: '投票がタイムアウトしました。投票をリセットします。',
        action: () => setNotification(null)
      })
      hasSentContinueRef.current = false
      resetSessionVote()
    })
    
    return () => {
      // Phase 3: 新しいイベントリスナーのクリーンアップ
      socketInstance.off('session_vote_update')
      socketInstance.off('session_ended_by_consensus')
      socketInstance.off('session_continue_agreed')
      socketInstance.off('new-room-ready')
      socketInstance.off('vote_timeout')
      
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

  // ホスト専用強制終了ハンドラー
  const handleHostForceEnd = () => {
    setShowForceEndModal(true)
  }

  const handleForceEndConfirm = async (reason: string) => {
    if (!resultData) return
    
    try {
      setIsForceEnding(true)
      const response = await fetch(`/api/game/${resultData.gameId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setGlobalError('ホスト権限が必要です')
        } else if (response.status === 401) {
          setGlobalError('認証が必要です')
        } else {
          setGlobalError(data.error?.message || 'セッション終了に失敗しました')
        }
        return
      }

      // 成功時はモーダルを閉じて、少し待ってからホームに遷移
      setShowForceEndModal(false)
      
      // 他のプレイヤーが通知を確認できるよう2秒待機
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)

    } catch (error) {
      console.error('Force end failed:', error)
      setGlobalError('セッション終了に失敗しました')
    } finally {
      setIsForceEnding(false)
    }
  }

  const handleForceEndCancel = () => {
    setShowForceEndModal(false)
  }

  // Phase 3: 3択投票システムのハンドラー
  const handleSessionVote = async (vote: VoteOption) => {
    if (!resultData || !socket || !user) return
    
    try {
      // 投票状態を即座に更新
      setSessionVotes(prev => ({ ...prev, [user.playerId]: vote }))
      setIsWaitingForSessionVotes(true)
      
      // 投票開始時刻を記録
      if (!voteStartTime) {
        setVoteStartTime(new Date().toISOString())
      }
      
      // サーバーに投票を送信
      const response = await fetch(`/api/game/${resultData.gameId}/vote-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vote })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // 失敗した場合は投票を取り消し
        setSessionVotes(prev => {
          const newVotes = { ...prev }
          delete newVotes[user.playerId]
          return newVotes
        })
        setGlobalError(data.error?.message || '投票に失敗しました')
        return
      }
      
      // 投票タイムアウトを設定
      startVoteTimeout()
      
    } catch (error) {
      console.error('Session vote failed:', error)
      // 失敗した場合は投票を取り消し
      setSessionVotes(prev => {
        const newVotes = { ...prev }
        delete newVotes[user.playerId]
        return newVotes
      })
      setGlobalError('投票に失敗しました')
    }
  }

  const handleCancelSessionVote = async () => {
    if (!resultData || !socket || !user) return
    
    try {
      // 投票取り消しをサーバーに送信
      const response = await fetch(`/api/game/${resultData.gameId}/cancel-vote-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        // ローカル状態を更新
        setSessionVotes(prev => {
          const newVotes = { ...prev }
          delete newVotes[user.playerId]
          return newVotes
        })
        
        // 投票者が一人もいない場合は投票をリセット
        const remainingVotes = Object.keys(sessionVotes).filter(id => id !== user.playerId)
        if (remainingVotes.length === 0) {
          resetSessionVote()
        }
      }
    } catch (error) {
      console.error('Cancel session vote failed:', error)
      setGlobalError('投票の取り消しに失敗しました')
    }
  }

  const resetSessionVote = () => {
    setSessionVotes({})
    setIsWaitingForSessionVotes(false)
    setVoteResult(null)
    setVoteStartTime(null)
    
    if (voteTimeout) {
      clearTimeout(voteTimeout)
      setVoteTimeout(null)
    }
  }

  const startVoteTimeout = useCallback(() => {
    if (voteTimeout) {
      clearTimeout(voteTimeout)
    }
    
    const timeout = setTimeout(() => {
      // タイムアウト時の処理
      console.log('Vote timeout reached')
      resetSessionVote()
      
      // タイムアウト通知
      if (socket && resultData) {
        socket.emit('vote-timeout', { gameId: resultData.gameId })
      }
      
      setNotification({
        message: '投票がタイムアウトしました。投票をリセットします。',
        action: () => setNotification(null)
      })
    }, 5 * 60 * 1000) // 5分
    
    setVoteTimeout(timeout)
  }, [voteTimeout, socket, resultData])

  // 投票結果の分析
  useEffect(() => {
    if (!resultData) return
    
    const result = analyzeVotes(sessionVotes, resultData.results.length)
    setVoteResult(result)
    
    // 全員投票済みで結果が確定した場合の処理
    if (result.action !== 'wait' && result.details.votedPlayers === result.details.totalPlayers) {
      // タイムアウトをクリア
      if (voteTimeout) {
        clearTimeout(voteTimeout)
        setVoteTimeout(null)
      }
      
      // 自動的に次のアクションを実行（WebSocketイベントで処理される）
    }
  }, [sessionVotes, resultData, voteTimeout])


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
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {result.name}
                        </div>
                        {result.playerId === resultData.hostPlayerId && (
                          <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-300">
                            👑 ホスト
                          </span>
                        )}
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
                  <div className="flex items-center">
                    <div className="font-medium text-gray-900">{result.name}</div>
                    {result.playerId === resultData.hostPlayerId && (
                      <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-300">
                        👑 ホスト
                      </span>
                    )}
                  </div>
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
          <div className="mb-4 flex flex-wrap justify-center gap-3">
            <button
              onClick={onBack}
              className="bg-gray-500 text-white py-3 px-6 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              ゲームに戻る
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              ホームに戻る
            </button>

            {/* ホスト専用強制終了ボタン */}
            {user?.playerId === resultData.hostPlayerId && resultData.sessionId && !isWaitingForVotes && (
              <button
                onClick={handleHostForceEnd}
                disabled={isForceEnding}
                className="bg-red-600 text-white py-3 px-6 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed flex items-center"
              >
                {isForceEnding ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    処理中...
                  </>
                ) : (
                  <>⚠️ セッション強制終了</>
                )}
              </button>
            )}
          </div>

          {/* 継続オプション */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-3">
              {isWaitingForSessionVotes ? 'セッションをどうしますか？' : '対局を続けますか？'}
            </h3>
            
            {isWaitingForSessionVotes ? (
              // Phase 3: 3択投票システムの進行状況表示
              <VotingProgress
                votes={sessionVotes}
                players={resultData.results}
                currentUser={user}
                onCancelVote={handleCancelSessionVote}
                timeRemaining={voteStartTime ? Math.max(0, Math.floor((5 * 60 * 1000 - (Date.now() - new Date(voteStartTime).getTime())) / 1000)) : undefined}
              />
            ) : isWaitingForVotes ? (
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
              <div className="space-y-4">
                {/* Phase 3: 3択投票ボタン */}
                {resultData.sessionId && (
                  <div className="mb-4">
                    <div className="text-sm text-green-700 mb-3 font-medium">
                      💭 全員でセッションの方針を決めましょう
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => handleSessionVote('continue')}
                        className="bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
                      >
                        <span className="mr-2">🔄</span>
                        <span>セッション継続</span>
                      </button>
                      
                      <button
                        onClick={() => handleSessionVote('end')}
                        className="bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
                      >
                        <span className="mr-2">✋</span>
                        <span>セッション終了</span>
                      </button>
                      
                      <button
                        onClick={() => handleSessionVote('pause')}
                        className="bg-yellow-600 text-white py-3 px-4 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
                      >
                        <span className="mr-2">⏸️</span>
                        <span>保留・様子見</span>
                      </button>
                    </div>
                    <div className="text-xs text-green-600 mt-2 bg-green-100 p-2 rounded">
                      <strong>継続:</strong> セッションを続ける | <strong>終了:</strong> セッションを終了する | <strong>保留:</strong> 他の人の判断を待つ
                    </div>
                  </div>
                )}
                
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

        {/* 強制終了確認モーダル */}
        <ForceEndConfirmModal
          isOpen={showForceEndModal}
          onClose={handleForceEndCancel}
          onConfirm={handleForceEndConfirm}
          sessionName={resultData.sessionName}
          isLoading={isForceEnding}
        />
        <AlertModal
          isOpen={notification !== null}
          message={notification?.message || ''}
          countdownSeconds={notification?.countdown}
          onConfirm={() => {
            if (notification?.action) {
              notification.action()
            } else {
              setNotification(null)
            }
          }}
        />
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSocket } from '@/hooks/useSocket'

interface GamePlayer {
  playerId: string
  name: string
  position: number
  points: number
  isReach: boolean
  isConnected: boolean
}

interface GameState {
  gameId: string
  players: GamePlayer[]
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
  gamePhase: 'waiting' | 'playing' | 'finished'
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated, refreshAuth } = useAuth()
  const { socket, isConnected, joinRoom, gameState: socketGameState } = useSocket()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [roomInfo, setRoomInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  const roomCode = params.roomCode as string

  const fetchRoomInfo = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/room/${roomCode}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'ルーム情報の取得に失敗しました')
      }

      if (data.success) {
        console.log('Room info fetched:', data.data)
        console.log('Current user:', user)
        setRoomInfo(data.data)
        setGameState({
          gameId: data.data.gameId,
          players: data.data.players,
          currentRound: data.data.currentRound,
          currentOya: data.data.currentOya,
          honba: data.data.honba,
          kyotaku: data.data.kyotaku,
          gamePhase: data.data.gamePhase
        })
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ルーム情報の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [roomCode, user])

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchRoomInfo()
    }
  }, [isAuthenticated, user, fetchRoomInfo])

  // Socket game state を監視
  useEffect(() => {
    if (socketGameState) {
      console.log('Socket game state updated:', socketGameState)
      setGameState(socketGameState)
    }
  }, [socketGameState])

  useEffect(() => {
    if (socket && user && roomCode && roomInfo && isConnected) {
      // プレイヤーがこのゲームに参加しているかチェック
      const isParticipant = roomInfo.players?.some((p: any) => p.playerId === user.playerId)
      console.log('WebSocket connection check:', { 
        isConnected,
        isParticipant, 
        userId: user.playerId, 
        players: roomInfo.players,
        socketId: socket.id 
      })
      
      // プレイヤーが参加者の場合のみWebSocket接続
      if (isParticipant) {
        console.log('Joining room via WebSocket:', roomCode)
        joinRoom(roomCode, user.playerId)
        
        // Socket events - using socket instance directly for more control
        socket.on('game_state', (state: GameState) => {
          console.log('Received game_state:', state)
          setGameState(state)
        })

        socket.on('player_joined', (data: any) => {
          console.log('Player joined event received:', data)
          if (data.gameState) {
            setGameState(data.gameState)
            // ルーム情報も更新
            setRoomInfo((prevRoomInfo: any) => ({
              ...prevRoomInfo,
              players: data.gameState.players
            }))
          }
          // 念のためルーム情報を再取得
          setTimeout(() => fetchRoomInfo(), 100)
        })

        socket.on('player_rejoined', (data: any) => {
          console.log('Player rejoined event received:', data)
          if (data.gameState) {
            setGameState(data.gameState)
          }
          // ルーム情報も更新して最新のプレイヤー情報を反映
          setTimeout(() => fetchRoomInfo(), 100)
        })

        socket.on('game_started', (data: any) => {
          console.log('Game started event received:', data)
          if (data.gameState) {
            setGameState(data.gameState)
            // ゲーム開始時は全員を自動的にゲーム画面に遷移
            router.push(`/game/${data.gameState.gameId}`)
          }
        })

        socket.on('error', (error: any) => {
          console.error('WebSocket error:', error)
          setError(error.message)
        })

        return () => {
          socket.off('game_state')
          socket.off('player_joined')
          socket.off('player_rejoined')
          socket.off('game_started')
          socket.off('error')
        }
      } else {
        console.log('User is not a participant in this room, skipping WebSocket connection')
      }
    }
  }, [socket, user, roomCode, roomInfo, isConnected, joinRoom, router, fetchRoomInfo])

  const handleJoinRoom = async () => {
    if (!user) return

    try {
      setError('')
      
      const response = await fetch('/api/room/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomCode: roomCode,
          playerName: user.name
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'ルーム参加に失敗しました')
      }

      if (data.success) {
        // ルーム情報を再取得
        await fetchRoomInfo()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ルーム参加に失敗しました')
    }
  }

  const handleRejoinRoom = async () => {
    if (!user) return

    try {
      setError('')
      
      const response = await fetch(`/api/room/${roomCode}/rejoin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerName: user.name
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'ルーム再参加に失敗しました')
      }

      if (data.success) {
        console.log('Rejoin successful:', data.data)
        
        // 認証情報を更新
        await refreshAuth()
        
        // ルーム情報を再取得
        await fetchRoomInfo()
        
        // 少し遅延させてからWebSocket接続を確認
        setTimeout(() => {
          if (socket) {
            joinRoom(roomCode, data.data.playerId)
          }
        }, 300)
      }
    } catch (error) {
      console.error('Rejoin failed:', error)
      setError(error instanceof Error ? error.message : 'ルーム再参加に失敗しました')
    }
  }

  const handleStartGame = async () => {
    if (!roomInfo || !user) return

    try {
      setIsStarting(true)
      setError('')

      console.log('Starting game with:', {
        gameId: roomInfo.gameId,
        hostPlayerId: user.playerId,
        roomInfo: roomInfo,
        user: user
      })

      const response = await fetch(`/api/game/${roomInfo.gameId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hostPlayerId: user.playerId
        }),
        credentials: 'include'
      })

      const data = await response.json()
      console.log('Game start response:', { response: response.status, data })

      if (!response.ok) {
        throw new Error(data.error?.message || 'ゲーム開始に失敗しました')
      }

      if (data.success) {
        router.push(`/game/${data.data.gameId}` as any)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ゲーム開始に失敗しました')
    } finally {
      setIsStarting(false)
    }
  }

  const getPositionName = (position: number) => {
    const positions = ['東', '南', '西', '北']
    return positions[position] || '?'
  }

  const isHost = user && roomInfo && user.playerId === roomInfo.hostPlayer?.id
  const canStartGame = roomInfo?.players.length === 4 && roomInfo?.status === 'WAITING'

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">ログインが必要です</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (error && !roomInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            ホームに戻る
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                ルーム: {roomCode}
              </h1>
              <p className="text-gray-600">
                ホスト: {roomInfo?.hostPlayer?.name}
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? '✓ 接続中' : '✗ 切断'}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {gameState?.players.length || 0}/4 プレイヤー
              </div>
            </div>
          </div>
        </div>

        {/* プレイヤー一覧 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">プレイヤー</h2>
          <div className="grid gap-4">
            {[0, 1, 2, 3].map((position) => {
              const player = gameState?.players.find(p => p.position === position)
              return (
                <div
                  key={position}
                  className={`p-4 rounded-lg border-2 ${
                    player 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center font-semibold text-gray-700">
                        {getPositionName(position)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">
                          {player?.name || '待機中...'}
                        </div>
                        {player && (
                          <div className="text-sm text-gray-500">
                            {player.points.toLocaleString()}点
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {player?.isConnected && (
                        <span className="text-green-600 text-sm">●</span>
                      )}
                      {player?.isReach && (
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                          リーチ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ゲーム設定 */}
        {roomInfo?.settings && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">ゲーム設定</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">ゲームタイプ:</span>
                <span className="ml-2 font-medium">
                  {roomInfo.settings.gameType === 'HANCHAN' ? '半荘戦' : '東風戦'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">初期点数:</span>
                <span className="ml-2 font-medium">
                  {roomInfo.settings.initialPoints?.toLocaleString()}点
                </span>
              </div>
              <div>
                <span className="text-gray-600">ウマ:</span>
                <span className="ml-2 font-medium">
                  {roomInfo.settings.uma?.join(', ')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">オカ:</span>
                <span className="ml-2 font-medium">
                  {roomInfo.settings.oka}点
                </span>
              </div>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-600">{error}</div>
            <button
              onClick={() => setError('')}
              className="text-red-500 hover:text-red-700 text-sm mt-2"
            >
              閉じる
            </button>
          </div>
        )}

        {/* デバッグ情報 */}
        {process.env.NODE_ENV === 'development' && roomInfo && user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="text-blue-800 text-xs space-y-1">
              <div><strong>Debug Info:</strong></div>
              <div>Current User ID: <code>{user.playerId}</code></div>
              <div>Current User Name: <code>{user.name}</code></div>
              <div>WebSocket Connected: <code>{isConnected ? 'Yes' : 'No'}</code></div>
              <div>Players in room: <code>{JSON.stringify(roomInfo.players?.map((p: any) => ({ id: p.playerId, name: p.name })))}</code></div>
              <div>Is Participant: <code>{roomInfo.players?.some((p: any) => p.playerId === user.playerId) ? 'Yes' : 'No'}</code></div>
              <div>Same name exists: <code>{roomInfo.players?.some((p: any) => p.name === user.name) ? 'Yes' : 'No'}</code></div>
              <div>Is Host: <code>{isHost ? 'Yes' : 'No'}</code></div>
              <div>Can Start Game: <code>{canStartGame ? 'Yes' : 'No'}</code></div>
              <div>Room Status: <code>{roomInfo.status}</code></div>
              <div>Room Code: <code>{roomCode}</code></div>
            </div>
          </div>
        )}

        {/* プレイヤーがルーム参加者でない場合の参加ボタン */}
        {roomInfo && user && !roomInfo.players?.some((p: any) => p.playerId === user.playerId) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="text-yellow-800">
              {(() => {
                // 同じ名前のプレイヤーが既に参加している場合は再参加ボタンを表示
                const existingPlayerWithSameName = roomInfo.players?.find((p: any) => p.name === user.name)
                
                if (existingPlayerWithSameName) {
                  return (
                    <>
                      <div className="font-semibold mb-2">同じ名前でプレイヤーが参加しています</div>
                      <div className="text-sm mb-4">
                        このルームに「{user.name}」として参加し直しますか？
                      </div>
                      <button
                        onClick={handleRejoinRoom}
                        className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                      >
                        ルームに再参加
                      </button>
                    </>
                  )
                } else if (roomInfo.players.length < 4) {
                  return (
                    <>
                      <div className="font-semibold mb-2">このルームに参加しますか？</div>
                      <div className="text-sm mb-4">
                        現在 {roomInfo.players.length}/4 人が参加しています。
                      </div>
                      <button
                        onClick={handleJoinRoom}
                        className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                      >
                        ルームに参加
                      </button>
                    </>
                  )
                } else {
                  return (
                    <>
                      <div className="font-semibold mb-2">ルームが満員です</div>
                      <div className="text-sm">
                        このルームは既に4人揃っているため参加できません。
                      </div>
                    </>
                  )
                }
              })()}
            </div>
          </div>
        )}


        {/* アクションボタン */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              ホームに戻る
            </button>
            
            {isHost && canStartGame && (
              <button
                onClick={handleStartGame}
                disabled={isStarting}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isStarting ? 'ゲーム開始中...' : 'ゲーム開始'}
              </button>
            )}
            
            {!canStartGame && roomInfo?.players.length !== 4 && (
              <div className="flex-1 bg-gray-200 text-gray-600 py-3 px-4 rounded-md text-center">
                4人揃うまでお待ちください ({roomInfo?.players.length || 0}/4)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
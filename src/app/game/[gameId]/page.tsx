'use client'

import ErrorDisplay, { ErrorInfo } from '@/components/ErrorDisplay'
import GameEndScreen from '@/components/GameEndScreen'
import GameInfo from '@/components/GameInfo'
import GameResult from '@/components/GameResult'
import SessionHistoryModal from '@/components/SessionHistoryModal'
import MenuDrawer from '@/components/MenuDrawer'
import PlayerStatus from '@/components/PlayerStatus'
import PointAnimation from '@/components/PointAnimation'
import RyukyokuForm from '@/components/RyukyokuForm'
import ScoreInputForm from '@/components/ScoreInputForm'
import { useAuth } from '@/contexts/AuthContext'
import { useMatchHistory } from '@/hooks/useMatchHistory'
import { useSocket } from '@/hooks/useSocket'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

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

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { socket, isConnected, error: socketError, isReconnecting, reconnectTimeLeft, manualReconnect, joinRoom } = useSocket()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameInfo, setGameInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showScoreInput, setShowScoreInput] = useState(false)
  const [activeAction, setActiveAction] = useState<'tsumo' | 'ron' | null>(null)
  const [selectedLoserId, setSelectedLoserId] = useState<string | null>(null)
  const [showRyukyokuForm, setShowRyukyokuForm] = useState(false)
  const [showPointAnimation, setShowPointAnimation] = useState(false)
  const [pointChanges, setPointChanges] = useState<Array<{ playerId: string; change: number; newPoints: number }>>([])
  const [previousGameState, setPreviousGameState] = useState<GameState | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showGameEnd, setShowGameEnd] = useState(false)
  const [gameEndReason, setGameEndReason] = useState('')
  const previousGameStateRef = useRef<GameState | null>(null)
  const gameStateRef = useRef<GameState | null>(null)
  const pointChangesRef = useRef<Array<{ playerId: string; change: number; newPoints: number }>>([])

  const [showMenu, setShowMenu] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const gameId = params.gameId as string

  // 点数変動を検出してアニメーションを開始
  const triggerPointAnimation = useCallback((newGameState: GameState, fromWebSocket = false) => {
    console.log('=== triggerPointAnimation START ===')
    console.log('Called with:', { 
      fromWebSocket,
      newGameState: {
        players: newGameState.players.map(p => ({ name: p.name, points: p.points }))
      },
      previousGameStateRef: previousGameStateRef.current ? {
        players: previousGameStateRef.current.players.map(p => ({ name: p.name, points: p.points }))
      } : null,
      currentGameStateRef: gameStateRef.current ? {
        players: gameStateRef.current.players.map(p => ({ name: p.name, points: p.points }))
      } : null
    })

    // WebSocketの場合は、現在のgameStateRefを基準にする
    let compareState: GameState | null = null
    if (fromWebSocket) {
      // WebSocketイベントの場合は、現在のgameStateRefを使用
      compareState = gameStateRef.current
      console.log('Using current gameStateRef for WebSocket comparison:', compareState ? {
        players: compareState.players.map(p => ({ name: p.name, points: p.points }))
      } : null)
    } else {
      // fetchGameStateの場合はpreviousGameStateRefを使用
      compareState = previousGameStateRef.current
      console.log('Using previousGameStateRef for comparison:', compareState ? {
        players: compareState.players.map(p => ({ name: p.name, points: p.points }))
      } : null)
    }

    if (!compareState) {
      console.log('No comparison state, setting initial state')
      previousGameStateRef.current = newGameState
      gameStateRef.current = newGameState
      setPreviousGameState(newGameState)
      setGameState(newGameState)
      return
    }

    // 点数変動を検出
    const changes: Array<{ playerId: string; change: number; newPoints: number }> = []
    let hasChanges = false

    console.log('Checking for point changes...')
    newGameState.players.forEach(newPlayer => {
      const oldPlayer = compareState!.players.find(p => p.playerId === newPlayer.playerId)
      if (oldPlayer) {
        const pointsDiff = newPlayer.points - oldPlayer.points
        if (pointsDiff !== 0) {
          changes.push({
            playerId: newPlayer.playerId,
            change: pointsDiff,
            newPoints: newPlayer.points
          })
          hasChanges = true
          console.log(`✓ Point change: ${newPlayer.name} ${oldPlayer.points} -> ${newPlayer.points} (${pointsDiff > 0 ? '+' : ''}${pointsDiff})`)
        } else {
          console.log(`- No change: ${newPlayer.name} ${newPlayer.points}`)
        }
      }
    })

    if (hasChanges) {
      console.log('✅ STARTING ANIMATION with changes:', changes)
      // すべてのプレイヤーを含める（変動なしも含む）
      newGameState.players.forEach(newPlayer => {
        if (!changes.find(c => c.playerId === newPlayer.playerId)) {
          changes.push({
            playerId: newPlayer.playerId,
            change: 0,
            newPoints: newPlayer.points
          })
        }
      })
      
      pointChangesRef.current = changes
      setPointChanges(changes)
      setShowPointAnimation(true)
      
      // アニメーション完了後に状態更新するため、新しい状態を保存しておく
      gameStateRef.current = newGameState
    } else {
      console.log('❌ NO CHANGES detected, updating state directly')
      // 点数変動がない場合は即座に状態更新
      previousGameStateRef.current = newGameState
      gameStateRef.current = newGameState
      setPreviousGameState(newGameState)
      setGameState(newGameState)
    }
    console.log('=== triggerPointAnimation END ===')
  }, []) // gameStateを依存配列から削除してrefを使用

  const onAnimationComplete = useCallback(() => {
    console.log('Animation completed, applying final state')
    setShowPointAnimation(false)
    setPointChanges([])
    
    // アニメーション完了後に最新状態を適用
    if (gameStateRef.current) {
      console.log('Applying final game state:', gameStateRef.current)
      previousGameStateRef.current = gameStateRef.current
      setPreviousGameState(gameStateRef.current)
      setGameState(gameStateRef.current)
      
      // ゲームが終了している場合は終了画面を表示
      if (gameStateRef.current.gamePhase === 'finished') {
        setShowGameEnd(true)
      }
    }
  }, [])

  const fetchGameState = useCallback(async () => {
    try {
      setIsLoading(true)
      setError('')

      console.log('Fetching game state for gameId:', gameId)

      const response = await fetch(`/api/game/${gameId}`, {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      console.log('Game state response:', { status: response.status, data })

      if (!response.ok) {
        // HTTPステータスコードに基づいてエラータイプを判定
        let errorType: ErrorInfo['type'] = 'server'
        let errorMessage = data.error?.message || 'ゲーム状態の取得に失敗しました'
        
        if (response.status === 404) {
          errorMessage = 'ゲームが見つかりません'
        } else if (response.status === 403) {
          errorMessage = 'ゲームへのアクセス権限がありません'
        } else if (response.status >= 500) {
          errorType = 'server'
          errorMessage = 'サーバーエラーが発生しました'
        } else if (response.status >= 400) {
          errorType = 'validation'
        }
        
        throw new Error(JSON.stringify({ type: errorType, message: errorMessage }))
      }

      if (data.success) {
        setGameInfo(data.data.gameInfo)
        console.log('Game state fetched:', data.data.gameState)
        
        // 初回読み込み時にゲームが既に終了している場合はリザルト画面を直接表示
        if (data.data.gameState.gamePhase === 'finished' && !previousGameStateRef.current) {
          setShowResult(true)
        }

        // 初回ロード時は直接設定、それ以外はアニメーション
        if (!previousGameStateRef.current) {
          previousGameStateRef.current = data.data.gameState
          gameStateRef.current = data.data.gameState
          setGameState(data.data.gameState)
          setPreviousGameState(data.data.gameState)
        } else {
          triggerPointAnimation(data.data.gameState)
        }
        
        // WebSocketルームへの参加は別のuseEffectで処理
        console.log('🏠 Game state fetched, will join room via separate effect')
      } else {
        throw new Error(JSON.stringify({ type: 'server', message: data.error?.message || 'ゲーム状態の取得に失敗しました' }))
      }
    } catch (error) {
      console.error('fetchGameState error:', error)
      
      // ネットワークエラーかどうかチェック
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setError(JSON.stringify({ type: 'network', message: 'ネットワークエラーです。インターネット接続を確認してください。', isRetryable: true }))
      } else if (error instanceof Error) {
        try {
          // JSONエラーメッセージをパース
          const errorData = JSON.parse(error.message)
          setError(JSON.stringify(errorData))
        } catch {
          // 通常の文字列エラー
          setError(error.message)
        }
      } else {
        setError('予期しないエラーが発生しました')
      }
    } finally {
      setIsLoading(false)
    }
  }, [gameId, triggerPointAnimation]) // triggerPointAnimationを依存配列から削除

  useEffect(() => {
    if (socket && user) {
      console.log('🔧 Setting up WebSocket listeners with socket ID:', socket.id)
      
      // 既存のゲーム状態を取得（関数を直接呼び出し）
      fetchGameState()

      // Socket events - 直接ここで処理
      socket.on('game_state', (state: GameState) => {
        console.log('🔌 WebSocket: game_state received', state)
        console.log('🏠 Received game_state after room join:', { gameId: state.gameId, playersCount: state.players?.length })
        triggerPointAnimation(state, true)
      })

      socket.on('score_updated', (data: any) => {
        console.log('🔌 WebSocket: score_updated received', data)
        if (data.gameState) {
          triggerPointAnimation(data.gameState, true)
        }
        setShowScoreInput(false)
        setActiveAction(null)
        setError('') // エラーをクリア
      })

      socket.on('riichi_declared', (data: any) => {
        console.log('🔌 WebSocket: riichi_declared received', data)
        console.log('🔌 Current user:', user?.playerId, 'Riichi player:', data.playerId)
        console.log('🔌 Current gameStateRef before trigger:', gameStateRef.current ? {
          players: gameStateRef.current.players.map(p => ({ name: p.name, points: p.points }))
        } : null)
        console.log('🔌 New gameState from WebSocket:', data.gameState ? {
          players: data.gameState.players.map((p: any) => ({ name: p.name, points: p.points }))
        } : null)
        
        if (data.gameState) {
          triggerPointAnimation(data.gameState, true)
        }
        setError('') // エラーをクリア
      })

      socket.on('ryukyoku', (data: any) => {
        console.log('🔌 WebSocket: ryukyoku received', data)
        if (data.gameState) {
          triggerPointAnimation(data.gameState, true)
        }
        setError('') // エラーをクリア
      })

      socket.on('player_connected', (data: any) => {
        console.log('🔌 WebSocket: player_connected received', data)
        if (data.gameState) {
          triggerPointAnimation(data.gameState, true)
        }
      })

      socket.on('player_disconnected', (data: any) => {
        console.log('🔌 WebSocket: player_disconnected received', data)
        if (data.gameState) {
          triggerPointAnimation(data.gameState, true)
        }
      })

      socket.on('game_ended', (data: any) => {
        console.log('🔌 WebSocket: game_ended received', data)
        
        // 終了理由を保存
        if (data.reason) {
          setGameEndReason(data.reason)
        }
        
        if (data.gameState) {
          triggerPointAnimation(data.gameState, true)
        }
        // WebSocketでのゲーム終了時は終了画面の表示はonAnimationCompleteで処理
        setError('') // エラーをクリア
      })

      socket.on('error', (error: any) => {
        console.error('WebSocket error:', error)
        setError(error.message)
      })

      // すべてのイベントをキャッチして確認
      socket.onAny((event, ...args) => {
        console.log('🔍 WebSocket event received:', event, args)
      })

      return () => {
        console.log('🔧 Cleaning up WebSocket listeners')
        socket.off('game_state')
        socket.off('score_updated')
        socket.off('riichi_declared')
        socket.off('ryukyoku')
        socket.off('player_connected')
        socket.off('player_disconnected')
        socket.off('game_ended')
        socket.off('error')
        socket.offAny()
      }
    }
  }, [fetchGameState, socket, triggerPointAnimation, user]) // gameStateとtriggerPointAnimationを削除、fetchGameStateも削除

  // WebSocketルーム参加の専用useEffect
  const roomCodeRef = useRef<string | null>(null)
  const hasJoinedRef = useRef<boolean>(false)
  
  useEffect(() => {
    const roomCode = gameInfo?.roomCode
    const playerId = user?.playerId
    
    if (socket && user && roomCode && isConnected) {
      // 同じルームに既に参加済みの場合はスキップ
      if (roomCodeRef.current === roomCode && hasJoinedRef.current) {
        console.log('🏠 Already joined room:', roomCode)
        return
      }
      
      console.log('🏠 All conditions met, joining WebSocket room:', roomCode, 'with player:', playerId)
      console.log('🏠 Socket connected:', socket.connected, 'Socket ID:', socket.id)
      
      if(playerId) {
        joinRoom(roomCode, playerId)
      }
      roomCodeRef.current = roomCode
      hasJoinedRef.current = true
    } else {
      console.log('🏠 Waiting for conditions - missing:', {
        socket: !!socket,
        user: !!user,
        roomCode: !!roomCode,
        isConnected
      })
      hasJoinedRef.current = false
    }
  }, [socket, user, gameInfo?.roomCode, isConnected, joinRoom]) // joinRoomを削除
  
  // Reset join status when socket disconnects
  useEffect(() => {
    if (!isConnected) {
      hasJoinedRef.current = false
    }
  }, [isConnected])

  // gameStateが更新されたらgameStateRefも更新
  useEffect(() => {
    if (gameState) {
      gameStateRef.current = gameState
    }
  }, [gameState])

  const handleTsumo = () => {
    setActiveAction('tsumo')
    setSelectedLoserId(null)
    setShowScoreInput(true)
  }

  const handleRon = () => {
    setActiveAction('ron')
    setSelectedLoserId(null)
    setShowScoreInput(true)
  }

  const handleReach = async (playerId: string) => {
    if (!socket) return

    try {
      const response = await fetch(`/api/game/${gameId}/riichi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId }),
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'リーチ宣言に失敗しました')
      }

      // リーチ宣言成功後、念のため最新状態を再取得
      setTimeout(() => fetchGameState(), 100)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'リーチ宣言に失敗しました')
    }
  }

  const openRyukyokuDialog = () => {
    setShowRyukyokuForm(true)
  }

  const handleRyukyokuSubmit = async (tenpaiPlayers: string[]) => {
    if (!socket) return

    try {
      const response = await fetch(`/api/game/${gameId}/ryukyoku`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: '流局', tenpaiPlayers }),
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || '流局処理に失敗しました')
      }

      setShowRyukyokuForm(false)

      // 流局処理成功後、念のため最新状態を再取得
      setTimeout(() => fetchGameState(), 100)
    } catch (error) {
      setError(error instanceof Error ? error.message : '流局処理に失敗しました')
    }
  }

  const handleScoreSubmit = async (scoreData: {
    winnerId: string
    han: number
    fu: number
    isTsumo: boolean
    loserId?: string
  }) => {
    try {
      const response = await fetch(`/api/game/${gameId}/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scoreData),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        let errorType: ErrorInfo['type'] = 'server'
        let errorMessage = data.error?.message || '点数計算に失敗しました'
        
        if (response.status === 400) {
          errorType = 'validation'
          errorMessage = '入力内容に誤りがあります'
        } else if (response.status >= 500) {
          errorType = 'server'
          errorMessage = 'サーバーエラーが発生しました'
        }
        
        throw new Error(JSON.stringify({ type: errorType, message: errorMessage, details: data.error?.details }))
      }

      // 点数計算成功後、念のため最新状態を再取得
      setTimeout(() => fetchGameState(), 100)
      setShowScoreInput(false)
      setActiveAction(null)
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setError(JSON.stringify({ type: 'network', message: 'ネットワークエラーです。インターネット接続を確認してください。', isRetryable: true }))
      } else if (error instanceof Error) {
        try {
          const errorData = JSON.parse(error.message)
          setError(JSON.stringify(errorData))
        } catch {
          setError(error.message)
        }
      } else {
        setError('点数計算に失敗しました')
      }
    }
  }

  const handleForceEnd = async () => {
    if (!confirm('ゲームを強制終了しますか？')) return

    try {
      console.log('🏁 Frontend: Starting force end game for gameId:', gameId)
      
      const response = await fetch(`/api/game/${gameId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: '強制終了' }),
        credentials: 'include'
      })

      console.log('🏁 Frontend: Force end response status:', response.status)

      if (!response.ok) {
        const data = await response.json()
        console.error('🏁 Frontend: Force end failed:', data)
        throw new Error(data.error?.message || 'ゲーム終了に失敗しました')
      }

      const data = await response.json()
      console.log('🏁 Frontend: Force end successful:', data)

      // 強制終了成功後、終了画面を表示
      setGameEndReason('強制終了')
      setShowGameEnd(true)
    } catch (error) {
      console.error('🏁 Frontend: Force end error:', error)
      setError(error instanceof Error ? error.message : 'ゲーム終了に失敗しました')
    }
  }

  const getCurrentPlayer = () => {
    return gameState?.players.find(p => p.playerId === user?.playerId)
  }

  const canDeclareReach = (player: GamePlayer) => {
    return player.points >= 1000 && !player.isReach && gameState?.gamePhase === 'playing'
  }

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

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-gray-600 mb-4">ゲームが見つかりません</div>
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

  const currentPlayer = getCurrentPlayer()

  // ゲーム終了画面の表示
  if (showGameEnd && gameState) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
          <div className="max-w-6xl mx-auto">
            {/* ゲーム情報 */}
            <GameInfo
              gameState={gameState}
              isConnected={isConnected}
              gameType={gameInfo?.settings?.gameType || 'HANCHAN'}
            />

            {/* プレイヤー状態 */}
            <PlayerStatus 
              gameState={gameState}
              currentPlayer={currentPlayer}
              onReach={handleReach}
              canDeclareReach={canDeclareReach}
            />
          </div>
        </div>
        
        <GameEndScreen
          gameType={gameInfo?.settings?.gameType || 'HANCHAN'}
          endReason={gameEndReason || '規定局数終了'}
          onShowResult={() => {
            setShowGameEnd(false)
            setShowResult(true)
          }}
        />
      </>
    )
  }

  // ゲーム終了時はリザルト画面を表示
  if (showResult) {
    return (
      <GameResult 
        gameId={gameId} 
        onBack={() => setShowResult(false)} 
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* ゲーム情報 */}
        <GameInfo
          gameState={gameState}
          isConnected={isConnected}
          gameType={gameInfo?.settings?.gameType || 'HANCHAN'}
        />
        
        {/* プレイヤー状態 */}
        <PlayerStatus 
          gameState={gameState}
          currentPlayer={currentPlayer}
          onReach={handleReach}
          canDeclareReach={canDeclareReach}
        />

        {/* WebSocketエラー表示 */}
        {socketError && (
          <ErrorDisplay
            error={{
              type: 'websocket',
              message: socketError,
              isRetryable: true
            }}
            onRetry={manualReconnect}
            onDismiss={() => {/* ソケットエラーは自動で管理 */}}
            isReconnecting={isReconnecting}
            reconnectTimeLeft={reconnectTimeLeft}
          />
        )}

        {/* 一般エラー表示 */}
        {error && (
          <ErrorDisplay
            error={(() => {
              try {
                return JSON.parse(error) as ErrorInfo
              } catch {
                return { type: 'general', message: error, autoHide: false }
              }
            })()}
            onRetry={() => {
              try {
                const errorData = JSON.parse(error) as ErrorInfo
                if (errorData.isRetryable) {
                  fetchGameState()
                }
              } catch {
                // 文字列エラーの場合は再試行しない
              }
            }}
            onDismiss={() => setError('')}
          />
        )}

        {/* アクションボタン */}
        {gameState.gamePhase === 'playing' && (
          <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">アクション</h2>
            <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4 sm:gap-4">
              <button
                onClick={handleTsumo}
                className="bg-green-600 text-white py-4 px-3 sm:py-3 sm:px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors font-semibold text-lg sm:text-base"
              >
                ツモ
              </button>
              <button
                onClick={handleRon}
                className="bg-red-600 text-white py-4 px-3 sm:py-3 sm:px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors font-semibold text-lg sm:text-base"
              >
                ロン
              </button>
              <button
                onClick={() => currentPlayer && handleReach(currentPlayer.playerId)}
                disabled={!currentPlayer || !canDeclareReach(currentPlayer)}
                className="bg-yellow-600 text-white py-4 px-3 sm:py-3 sm:px-4 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-lg sm:text-base"
              >
                リーチ
              </button>
              <button
                onClick={openRyukyokuDialog}
                className="bg-gray-600 text-white py-4 px-3 sm:py-3 sm:px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-semibold text-lg sm:text-base"
              >
                流局
              </button>
            </div>
            
            {/* 強制終了ボタン */}
            <div className="border-t pt-3 sm:pt-4">
              <button
                onClick={handleForceEnd}
                className="w-full bg-red-500 text-white py-3 px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors text-sm sm:py-2"
              >
                ゲーム強制終了
              </button>
            </div>
          </div>
        )}


        {/* 点数入力フォーム */}
        {showScoreInput && activeAction && (
          <ScoreInputForm
            gameState={gameState}
            currentPlayer={currentPlayer}
            actionType={activeAction}
            preselectedWinnerId={currentPlayer?.playerId}
            onSubmit={handleScoreSubmit}
            onCancel={() => {
              setShowScoreInput(false)
              setActiveAction(null)
              setSelectedLoserId(null)
            }}
          />
        )}

        {showRyukyokuForm && (
          <RyukyokuForm
            players={gameState.players}
            onSubmit={handleRyukyokuSubmit}
            onCancel={() => setShowRyukyokuForm(false)}
          />
        )}

        {/* 戻るボタン */}
        <div className="text-center space-x-4">
          {gameState.gamePhase === 'finished' && (
            <button
              onClick={() => setShowResult(true)}
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              結果を見る
            </button>
          )}
          <button
            onClick={() => router.push('/')}
            className="bg-gray-500 text-white py-2 px-6 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            ホームに戻る
          </button>
        </div>
      </div>

      <button
        onClick={() => setShowMenu(true)}
        className="fixed top-4 right-4 z-40 bg-white rounded-md shadow p-2"
        aria-label="メニューを開く"
      >
        ☰
      </button>
      <MenuDrawer
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onShowHistory={() => setShowHistoryModal(true)}
      />
      <SessionHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        sessionId={gameInfo?.sessionId || null}
      />

      {/* 点数変動アニメーション */}
      {showPointAnimation && gameState && (
        <PointAnimation
          players={gameState.players}
          pointChanges={pointChanges}
          dealerPosition={gameState.currentOya}
          onComplete={onAnimationComplete}
        />
      )}
    </div>
  )
}
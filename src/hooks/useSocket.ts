import { useEffect, useCallback, useState } from 'react'
import { socketClient } from '@/lib/socket-client'
import { Socket } from 'socket.io-client'
import type {
  SocketError,
  SocketIOError,
  PlayerConnectedData,
  PlayerJoinedData,
  ScoreUpdatedData,
  RiichiDeclaredData,
  RyukyokuData,
  SeatOrderUpdatedData,
} from '@/types/socket'

export interface GameState {
  gameId: string
  players: GamePlayer[]
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
  gamePhase: 'waiting' | 'playing' | 'finished'
}

export interface GamePlayer {
  playerId: string
  name: string
  position: number
  points: number
  isReach: boolean
  isConnected: boolean
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [reconnectTimeLeft, setReconnectTimeLeft] = useState(0)

  // 再接続ロジック
  const reconnect = useCallback(() => {
    const maxAttempts = 5
    const baseDelay = 2000 // 2秒
    
    if (connectionAttempts >= maxAttempts) {
      setError('接続に失敗しました。ページを再読み込みしてください。')
      setIsReconnecting(false)
      return
    }

    const delay = baseDelay * Math.pow(2, connectionAttempts) // 指数バックオフ
    setIsReconnecting(true)
    setReconnectTimeLeft(Math.ceil(delay / 1000))

    // カウントダウンタイマー
    const countdownTimer = setInterval(() => {
      setReconnectTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setTimeout(() => {
      clearInterval(countdownTimer)
      setConnectionAttempts(prev => prev + 1)
      
      // 新しいソケット接続を試行
      const newSocket = socketClient.connect()
      setSocket(newSocket)
      setupSocketHandlers(newSocket)
    }, delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionAttempts])

  const setupSocketHandlers = useCallback((socketInstance: Socket) => {
    const handleConnect = () => {
      console.log('WebSocket connected:', socketInstance.id)
      setIsConnected(true)
      setError(null)
      setConnectionAttempts(0)
      setIsReconnecting(false)
      setReconnectTimeLeft(0)
    }

    const handleDisconnect = (reason: string) => {
      console.log('WebSocket disconnected:', reason)
      setIsConnected(false)
      
      // 意図的な切断でない場合は再接続を試行
      if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
        setError('接続が切断されました。再接続を試行中...')
        reconnect()
      }
    }

    const handleConnectError = (error: SocketIOError) => {
      console.error('WebSocket connection error:', error)
      setIsConnected(false)
      setError('接続エラーが発生しました。再接続を試行中...')
      reconnect()
    }

    const handleError = (error: SocketError) => {
      console.error('WebSocket error:', error)
      setError(error.message || '通信エラーが発生しました')
    }

    const handleGameState = (state: GameState) => {
      console.log('Received game state in useSocket:', state)
      setGameState(state)
    }

    const handlePlayerConnected = (data: PlayerConnectedData) => {
      console.log('Player connected:', data)
      if (data.gameState) {
        setGameState(data.gameState)
      }
    }

    const handleScoreUpdated = (data: ScoreUpdatedData) => {
      console.log('Score updated in useSocket:', data)
      if (data.gameState) {
        setGameState(data.gameState)
      }
    }

    const handleRiichiDeclared = (data: RiichiDeclaredData) => {
      console.log('Riichi declared in useSocket:', data)
      if (data.gameState) {
        setGameState(data.gameState)
      }
    }

    const handleRyukyoku = (data: RyukyokuData) => {
      console.log('Ryukyoku in useSocket:', data)
      if (data.gameState) {
        setGameState(data.gameState)
      }
    }

    const handleSeatOrderUpdated = (data: SeatOrderUpdatedData) => {
      console.log('Seat order updated in useSocket:', data)
      if (data.gameState) {
        setGameState(data.gameState)
      }
    }

    socketInstance.on('connect', handleConnect)
    socketInstance.on('disconnect', handleDisconnect)
    socketInstance.on('connect_error', handleConnectError)
    socketInstance.on('error', handleError)
    socketClient.onGameState(handleGameState)
    socketClient.onPlayerConnected(handlePlayerConnected)
    socketClient.onPlayerJoined((data: PlayerJoinedData) => {
      console.log('Player joined event in useSocket:', data)
      if (data.gameState) {
        setGameState(data.gameState)
      }
    })
    socketClient.onScoreUpdated(handleScoreUpdated)
    socketClient.onRiichiDeclared(handleRiichiDeclared)
    socketClient.onRyukyoku(handleRyukyoku)
    socketClient.onSeatOrderUpdated(handleSeatOrderUpdated)
    socketClient.onError(handleError)

    return () => {
      socketInstance.off('connect', handleConnect)
      socketInstance.off('disconnect', handleDisconnect)
      socketInstance.off('connect_error', handleConnectError)
      socketInstance.off('error', handleError)
      socketClient.offGameState(handleGameState)
      socketClient.offPlayerConnected(handlePlayerConnected)
      socketClient.offPlayerJoined()
      socketClient.offScoreUpdated(handleScoreUpdated)
      socketClient.offRiichiDeclared(handleRiichiDeclared)
      socketClient.offRyukyoku(handleRyukyoku)
      socketClient.offSeatOrderUpdated(handleSeatOrderUpdated)
      socketClient.offError(handleError)
    }
  }, [reconnect])

  useEffect(() => {
    const socketInstance = socketClient.connect()
    setSocket(socketInstance)
    setupSocketHandlers(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [setupSocketHandlers])

  const joinRoom = useCallback((roomCode: string, playerId: string) => {
    console.log('🏠 joinRoom called:', { roomCode, playerId, isConnected, socketConnected: socket?.connected })
    if (!isConnected || !socket?.connected) {
      console.warn('🏠 Socket not connected, delaying join room')
      setTimeout(() => {
        if (socket?.connected) {
          console.log('🏠 Delayed joining room via WebSocket:', roomCode, playerId)
          socketClient.joinRoom(roomCode, playerId)
        } else {
          console.error('🏠 Socket still not connected after delay')
        }
      }, 1000)
    } else {
      console.log('🏠 Immediately joining room via WebSocket:', roomCode, playerId)
      socketClient.joinRoom(roomCode, playerId)
    }
  }, [isConnected, socket])

  const setReady = useCallback((gameId: string, playerId: string) => {
    socketClient.setReady(gameId, playerId)
  }, [])

  const calculateScore = useCallback((data: {
    gameId: string
    winnerId: string
    han: number
    fu: number
    isTsumo: boolean
    loserId?: string
  }) => {
    socketClient.calculateScore(data)
  }, [])

  const declareReach = useCallback((gameId: string, playerId: string) => {
    socketClient.declareReach(gameId, playerId)
  }, [])

  const declareRyukyoku = useCallback((gameId: string, reason: string, tenpaiPlayers: string[] = []) => {
    socketClient.declareRyukyoku(gameId, reason, tenpaiPlayers)
  }, [])

  // 手動再接続機能
  const manualReconnect = useCallback(() => {
    setConnectionAttempts(0)
    setError(null)
    setIsReconnecting(false)
    
    if (socket) {
      socket.disconnect()
    }
    
    const newSocket = socketClient.connect()
    setSocket(newSocket)
    setupSocketHandlers(newSocket)
  }, [socket, setupSocketHandlers])

  return {
    socket,
    isConnected,
    gameState,
    error,
    isReconnecting,
    reconnectTimeLeft,
    connectionAttempts,
    joinRoom,
    setReady,
    calculateScore,
    declareReach,
    declareRyukyoku,
    manualReconnect
  }
}

export function useGameEvents() {
  const [scoreUpdate, setScoreUpdate] = useState<ScoreUpdatedData | null>(null)
  const [gameStarted, setGameStarted] = useState(false)

  useEffect(() => {
    const handleScoreUpdated = (data: ScoreUpdatedData) => {
      setScoreUpdate(data)
    }

    const handleGameStart = () => {
      setGameStarted(true)
    }

    socketClient.onScoreUpdated(handleScoreUpdated)
    socketClient.onGameStart(handleGameStart)

    return () => {
      socketClient.offScoreUpdated(handleScoreUpdated)
      socketClient.offGameStart(handleGameStart)
    }
  }, [])

  return {
    scoreUpdate,
    gameStarted
  }
}
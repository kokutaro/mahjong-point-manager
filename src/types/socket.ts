// Socket関連の型定義

export interface SocketError {
  message: string
  type?: string
  description?: string
  context?: Record<string, unknown>
}

export interface PlayerConnectedData {
  playerId: string
  playerName: string
  gameState?: GameStateData
}

export interface PlayerJoinedData {
  playerId: string
  playerName: string
  position: number
  gameState?: GameStateData
}

export interface ScoreUpdatedData {
  gameId: string
  gameState: GameStateData
  scoreChange: {
    winnerId: string
    loserId?: string
    han: number
    fu: number
    isTsumo: boolean
    points: Record<string, number>
  }
}

export interface RiichiDeclaredData {
  gameId: string
  playerId: string
  gameState: GameStateData
}

export interface RyukyokuData {
  gameId: string
  reason: string
  tenpaiPlayers: string[]
  gameState: GameStateData
}

export interface SeatOrderUpdatedData {
  gameId: string
  gameState: GameStateData
  newSeatOrder: Array<{
    playerId: string
    position: number
  }>
}

export interface GameStateData {
  gameId: string
  players: Array<{
    playerId: string
    name: string
    position: number
    points: number
    isReach: boolean
    isConnected: boolean
  }>
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
  gamePhase: 'waiting' | 'playing' | 'finished'
}

// Socket.IO エラーイベントの型
export interface SocketIOError {
  message: string
  description?: string
  context?: unknown
  type?: string
}
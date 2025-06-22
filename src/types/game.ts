// ゲーム関連の型定義

export type GameType = 'TONPUU' | 'HANCHAN'
export type GameStatus = 'WAITING' | 'STARTING' | 'PLAYING' | 'FINISHED' | 'CANCELLED'
export type EventType = 'TSUMO' | 'RON' | 'REACH' | 'RYUKYOKU' | 'GAME_START' | 'GAME_END'

export interface Game {
  id: string
  roomCode: string
  gameType: GameType
  status: GameStatus
  currentRound: number
  honba: number
  kyotaku: number
  startingOya: number
  currentOya: number
  createdAt: Date
  updatedAt: Date
  endedAt?: Date
}

export interface GameParticipant {
  id: string
  gameId: string
  playerId: string
  position: number
  currentPoints: number
  isReach: boolean
  reachRound?: number
  finalPoints?: number
  finalRank?: number
  uma?: number
  oka?: number
  settlement?: number
  player: Player
}

export interface Player {
  id: string
  name: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface GameEvent {
  id: string
  gameId: string
  playerId?: string
  eventType: EventType
  round: number
  honba: number
  eventData: Record<string, any>
  createdAt: Date
}

export interface GameSettings {
  id: string
  gameId: string
  startingPoints: number
  umaSettings: UmaSettings
  hasOka: boolean
  hasTobi: boolean
  hasYakitori: boolean
  tobiPenalty: number
  yakitoriPenalty: number
}

export interface UmaSettings {
  first: number
  second: number
  third: number
  fourth: number
}

export interface ScorePattern {
  id: string
  han: number
  fu: number
  oyaPoints: number
  koPoints: number
  oyaTsumoAll: number
  koTsumoOya: number
  koTsumoKo: number
}
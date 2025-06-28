import { z } from 'zod'
import {
  BaseScoreCalculationSchema,
  BaseRyukyokuSchema,
  BaseGameStateSchema,
  BasePlayerStateSchema,
  GameModeSchema,
  PlayerPositionSchema,
  validateHanFu
} from './common'

// ===== マルチプレイ専用スキーマ =====

// プレイヤーIDスキーマ（UUID形式）
export const MultiPlayerIdSchema = z.string().uuid()
export type MultiPlayerId = z.infer<typeof MultiPlayerIdSchema>

// マルチプレイヤー状態拡張
export const MultiPlayerStateSchema = BasePlayerStateSchema.extend({
  playerId: MultiPlayerIdSchema,
  name: z.string().min(1),
  isConnected: z.boolean().default(true)
})
export type MultiPlayerState = z.infer<typeof MultiPlayerStateSchema>

// マルチゲーム状態拡張
export const MultiGameStateSchema = BaseGameStateSchema.extend({
  gameId: z.string().uuid(),
  roomCode: z.string().min(1),
  gameMode: z.literal('MULTIPLAYER'),
  players: z.array(MultiPlayerStateSchema).length(4),
  status: z.enum(['WAITING', 'STARTING', 'PLAYING', 'FINISHED', 'CANCELLED']),
  sessionId: z.string().uuid().optional().nullable(),
  hostPlayerId: z.string().uuid()
})
export type MultiGameState = z.infer<typeof MultiGameStateSchema>

// ===== マルチプレイ用バリデーションスキーマ =====

// 点数計算スキーマ（マルチプレイ）
export const MultiScoreCalculationSchema = BaseScoreCalculationSchema.extend({
  winnerId: MultiPlayerIdSchema,
  loserId: MultiPlayerIdSchema.optional(),
  // isOyaは実行時にwinnerId から計算するため除外
}).refine(
  (data) => validateHanFu(data.han, data.fu),
  {
    message: '無効な翻符の組み合わせです',
    path: ['han', 'fu']
  }
).refine(
  (data) => !data.isTsumo || data.loserId === undefined,
  {
    message: 'ツモの場合は敗者IDを指定できません',
    path: ['loserId']
  }
).refine(
  (data) => data.isTsumo || data.loserId !== undefined,
  {
    message: 'ロンの場合は敗者IDが必要です',
    path: ['loserId']
  }
).refine(
  (data) => data.isTsumo || data.winnerId !== data.loserId,
  {
    message: '勝者と敗者が同じです',
    path: ['winnerId', 'loserId']
  }
)

export type MultiScoreCalculationInput = z.infer<typeof MultiScoreCalculationSchema>

// 流局スキーマ（マルチプレイ）
export const MultiRyukyokuSchema = BaseRyukyokuSchema.extend({
  reason: z.string().min(1, '流局理由は必須です'),
  tenpaiPlayers: z.array(MultiPlayerIdSchema).default([]).refine(
    (players) => players.length <= 4,
    {
      message: 'テンパイ者は4人以下である必要があります'
    }
  )
})
export type MultiRyukyokuInput = z.infer<typeof MultiRyukyokuSchema>

// リーチ宣言スキーマ（マルチプレイ）
export const MultiRiichiSchema = z.object({
  playerId: MultiPlayerIdSchema
})
export type MultiRiichiInput = z.infer<typeof MultiRiichiSchema>

// ゲーム開始スキーマ（マルチプレイ）
export const MultiGameStartSchema = z.object({
  hostPlayerId: MultiPlayerIdSchema
})
export type MultiGameStartInput = z.infer<typeof MultiGameStartSchema>

// ゲーム終了スキーマ（マルチプレイ）
export const MultiGameEndSchema = z.object({
  hostPlayerId: MultiPlayerIdSchema,
  reason: z.string().min(1, '終了理由は必須です')
})
export type MultiGameEndInput = z.infer<typeof MultiGameEndSchema>

// 再戦作成スキーマ（マルチプレイ）
export const MultiRematchSchema = z.object({
  hostPlayerId: MultiPlayerIdSchema,
  sessionId: z.string().uuid().optional()
})
export type MultiRematchInput = z.infer<typeof MultiRematchSchema>

// セッション投票スキーマ（マルチプレイ）
export const MultiSessionVoteSchema = z.object({
  playerId: MultiPlayerIdSchema,
  voteType: z.enum(['END_SESSION', 'CONTINUE_SESSION'])
})
export type MultiSessionVoteInput = z.infer<typeof MultiSessionVoteSchema>

// ===== ルーム関連スキーマ =====

// ルーム作成スキーマ
export const RoomCreateSchema = z.object({
  hostPlayerId: MultiPlayerIdSchema,
  gameType: z.enum(['TONPUU', 'HANCHAN']).default('HANCHAN'),
  sessionId: z.string().uuid().optional()
})
export type RoomCreateInput = z.infer<typeof RoomCreateSchema>

// ルーム参加スキーマ
export const RoomJoinSchema = z.object({
  roomCode: z.string().min(1),
  playerId: MultiPlayerIdSchema,
  position: PlayerPositionSchema.optional()
})
export type RoomJoinInput = z.infer<typeof RoomJoinSchema>

// 座席順変更スキーマ
export const SeatOrderSchema = z.object({
  hostPlayerId: MultiPlayerIdSchema,
  playerOrder: z.array(MultiPlayerIdSchema).length(4).refine(
    (players) => new Set(players).size === 4,
    {
      message: '重複するプレイヤーIDがあります'
    }
  )
})
export type SeatOrderInput = z.infer<typeof SeatOrderSchema>

// ===== レスポンススキーマ =====

// マルチプレイゲーム状態レスポンス
export const MultiGameStateResponseSchema = z.object({
  success: z.literal(true),
  data: MultiGameStateSchema
})
export type MultiGameStateResponse = z.infer<typeof MultiGameStateResponseSchema>

// 点数計算結果レスポンス
export const MultiScoreResultResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    scoreResult: z.object({
      basePoints: z.number(),
      honbaPoints: z.number(),
      kyotakuPoints: z.number(),
      totalPoints: z.number(),
      distributions: z.array(z.object({
        playerId: z.string(),
        pointChange: z.number()
      }))
    }),
    gameState: MultiGameStateSchema,
    gameEnded: z.boolean().optional(),
    reason: z.string().optional()
  })
})
export type MultiScoreResultResponse = z.infer<typeof MultiScoreResultResponseSchema>

// ===== バリデーション関数 =====

/**
 * マルチプレイのプレイヤーIDが有効かチェック
 */
export function validateMultiPlayerId(playerId: string): boolean {
  return MultiPlayerIdSchema.safeParse(playerId).success
}

/**
 * ルームコードの形式をチェック
 */
export function validateRoomCode(roomCode: string): boolean {
  return /^[A-Z0-9]{6}$/.test(roomCode)
}

/**
 * セッション投票の妥当性チェック
 */
export function validateSessionVote(
  playerId: string, 
  currentVotes: Record<string, string>,
  requiredPlayers: string[]
): { isValid: boolean; reason?: string } {
  if (!requiredPlayers.includes(playerId)) {
    return { isValid: false, reason: 'プレイヤーがセッションに参加していません' }
  }
  
  if (playerId in currentVotes) {
    return { isValid: false, reason: '既に投票済みです' }
  }
  
  return { isValid: true }
}

// ===== 定数 =====

export const ROOM_CODE_LENGTH = 6
export const MAX_PLAYERS_PER_ROOM = 4
export const SESSION_VOTE_TIMEOUT_MS = 30000 // 30秒

// WebSocket イベント型
export const WEBSOCKET_EVENTS = {
  GAME_STATE_UPDATED: 'game_state_updated',
  SCORE_UPDATED: 'score_updated',
  RIICHI_DECLARED: 'riichi_declared',
  RYUKYOKU: 'ryukyoku',
  GAME_ENDED: 'game_ended',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  SESSION_VOTE_UPDATED: 'session_vote_updated'
} as const

export type WebSocketEvent = typeof WEBSOCKET_EVENTS[keyof typeof WEBSOCKET_EVENTS]
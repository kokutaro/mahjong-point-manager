import { z } from "zod"

// ===== 基底Enumスキーマ =====

export const GameTypeSchema = z.enum(["TONPUU", "HANCHAN"])
export type GameType = z.infer<typeof GameTypeSchema>

export const GameStatusSchema = z.enum([
  "WAITING",
  "STARTING",
  "PLAYING",
  "FINISHED",
  "CANCELLED",
])
export type GameStatus = z.infer<typeof GameStatusSchema>

export const EventTypeSchema = z.enum([
  "TSUMO",
  "RON",
  "REACH",
  "RYUKYOKU",
  "GAME_START",
  "GAME_END",
])
export type EventType = z.infer<typeof EventTypeSchema>

export const GameModeSchema = z.enum(["MULTIPLAYER", "SOLO"])
export type GameMode = z.infer<typeof GameModeSchema>

// ===== プレイヤー関連スキーマ =====

// プレイヤー位置（0-3）
export const PlayerPositionSchema = z.number().int().min(0).max(3)
export type PlayerPosition = z.infer<typeof PlayerPositionSchema>

// プレイヤー識別子（統一型）
export const PlayerIdentifierSchema = z.union([
  z.string().min(1).describe("マルチプレイ用プレイヤーID（CUID形式）"),
  z.number().int().min(0).max(3).describe("ソロプレイ用ポジション"),
])
export type PlayerIdentifier = z.infer<typeof PlayerIdentifierSchema>

// ===== ゲーム状態関連スキーマ =====

// 基底ゲーム状態
export const BaseGameStateSchema = z.object({
  currentRound: z.number().int().positive().default(1),
  currentOya: PlayerPositionSchema.default(0),
  honba: z.number().int().nonnegative().default(0),
  kyotaku: z.number().int().nonnegative().default(0),
})
export type BaseGameState = z.infer<typeof BaseGameStateSchema>

// 基底プレイヤー状態
export const BasePlayerStateSchema = z.object({
  position: PlayerPositionSchema,
  currentPoints: z.number().int().default(25000),
  isReach: z.boolean().default(false),
  reachRound: z.number().int().positive().optional().nullable(),
})
export type BasePlayerState = z.infer<typeof BasePlayerStateSchema>

// ===== 点数計算関連スキーマ =====

// 翻数・符数の基本制約
export const HanSchema = z.number().int().min(1).max(13)
export const FuSchema = z.number().int().min(20).max(110)

// 基底点数計算スキーマ
export const BaseScoreCalculationSchema = z.object({
  han: HanSchema,
  fu: FuSchema,
  isTsumo: z.boolean(),
  honba: z.number().int().nonnegative().default(0),
  kyotaku: z.number().int().nonnegative().default(0),
})
export type BaseScoreCalculation = z.infer<typeof BaseScoreCalculationSchema>

// ===== 流局関連スキーマ =====

export const RyukyokuTypeSchema = z.enum(["DRAW", "ABORTIVE_DRAW"])
export type RyukyokuType = z.infer<typeof RyukyokuTypeSchema>

// 基底流局スキーマ
export const BaseRyukyokuSchema = z.object({
  type: RyukyokuTypeSchema.default("DRAW"),
  reason: z.string().min(1).optional(),
})
export type BaseRyukyoku = z.infer<typeof BaseRyukyokuSchema>

// ===== バリデーション関数 =====

/**
 * 翻数・符数の組み合わせが有効かチェック
 */
export function validateHanFu(han: number, fu: number): boolean {
  // 20符は2翻以上
  if (fu === 20 && han < 2) return false
  // 25符は2翻以上
  if (fu === 25 && han < 2) return false
  // 一般的な符数範囲
  if (fu < 20 || fu > 110) return false
  // 符数は10の倍数（20符、25符除く）
  if (fu !== 20 && fu !== 25 && fu % 10 !== 0) return false
  // 翻数範囲
  if (han < 1 || han > 13) return false

  return true
}

/**
 * プレイヤー位置の配列が有効かチェック（重複なし、範囲内）
 */
export function validatePlayerPositions(positions: number[]): boolean {
  const uniquePositions = new Set(positions)
  return (
    uniquePositions.size === positions.length &&
    positions.every((pos) => pos >= 0 && pos <= 3)
  )
}

/**
 * プレイヤー識別子からポジション番号を取得
 */
export function getPlayerPosition(
  identifier: PlayerIdentifier,
  gameMode: GameMode
): number {
  if (gameMode === "SOLO") {
    return typeof identifier === "number" ? identifier : 0
  }
  // マルチプレイの場合はランタイムで解決が必要
  return 0 // プレースホルダー
}

/**
 * 位置から風牌への変換
 */
export function getPlayerWind(
  position: PlayerPosition,
  currentOya: PlayerPosition
): string {
  const winds = ["東", "南", "西", "北"]
  const windIndex = (position - currentOya + 4) % 4
  return winds[windIndex]
}

// ===== 定数 =====

export const DEFAULT_INITIAL_POINTS = 25000
export const DEFAULT_GAME_TYPE: GameType = "HANCHAN"
export const DEFAULT_PLAYER_NAMES = ["東家", "南家", "西家", "北家"]

// ウマ設定（デフォルト）
export const DEFAULT_UMA_SETTINGS = {
  first: 15000,
  second: 5000,
  third: -5000,
  fourth: -15000,
} as const

// ===== エラー型定義 =====

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "MISSING_GAME_ID",
  "GAME_NOT_FOUND",
  "GAME_NOT_STARTED",
  "GAME_NOT_PLAYING",
  "GAME_NOT_FINISHED",
  "PLAYER_NOT_FOUND",
  "INVALID_PLAYER_POSITION",
  "INVALID_HAN_FU",
  "MISSING_LOSER",
  "INVALID_PLAYERS",
  "INVALID_ACTION",
  "ALREADY_REACH",
  "INSUFFICIENT_POINTS",
  "REACH_PLAYER_NOT_TENPAI",
  "INVALID_TENPAI_COUNT",
  "SCORE_PATTERN_NOT_FOUND",
  "INTERNAL_ERROR",
])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.any().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: ApiErrorSchema.optional(),
})
export type ApiResponse = z.infer<typeof ApiResponseSchema>

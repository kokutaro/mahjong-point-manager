import { z } from "zod"
import {
  BaseScoreCalculationSchema,
  BaseRyukyokuSchema,
  BaseGameStateSchema,
  BasePlayerStateSchema,
  PlayerPositionSchema,
  GameTypeSchema,
  GameStatusSchema,
  validateHanFu,
  validatePlayerPositions,
  DEFAULT_PLAYER_NAMES,
  DEFAULT_INITIAL_POINTS,
  DEFAULT_GAME_TYPE,
  DEFAULT_UMA_SETTINGS,
} from "./common"

// ===== ソロプレイ専用スキーマ =====

// ソロプレイヤー状態拡張（位置ベース識別）
export const SoloPlayerStateSchema = BasePlayerStateSchema.extend({
  name: z.string().min(1, "名前は必須です").max(20, "名前は20文字以内です"),
  finalPoints: z.number().int().optional().nullable(),
  finalRank: z.number().int().min(1).max(4).optional().nullable(),
  uma: z.number().int().optional().nullable(),
  settlement: z.number().int().optional().nullable(),
})
export type SoloPlayerState = z.infer<typeof SoloPlayerStateSchema>

// ソロゲーム状態拡張
export const SoloGameStateSchema = BaseGameStateSchema.extend({
  gameId: z.string().uuid(),
  gameMode: z.literal("SOLO"),
  players: z.array(SoloPlayerStateSchema).length(4),
  status: GameStatusSchema,
  gameType: GameTypeSchema.default(DEFAULT_GAME_TYPE),
  initialPoints: z.number().int().positive().default(DEFAULT_INITIAL_POINTS),
  hostPlayerId: z.string().uuid(), // 作成者のプレイヤーID
})
export type SoloGameState = z.infer<typeof SoloGameStateSchema>

// ===== ソロプレイ用バリデーションスキーマ =====

// プレイヤー作成スキーマ
export const CreateSoloPlayerSchema = z.object({
  position: PlayerPositionSchema,
  name: z.string().min(1, "名前は必須です").max(20, "名前は20文字以内です"),
})
export type CreateSoloPlayerInput = z.infer<typeof CreateSoloPlayerSchema>

// ウマ設定スキーマ
export const UmaSettingsSchema = z
  .array(z.number().int())
  .length(4, "ウマは4つの値が必要です")
  .default([
    DEFAULT_UMA_SETTINGS.first,
    DEFAULT_UMA_SETTINGS.second,
    DEFAULT_UMA_SETTINGS.third,
    DEFAULT_UMA_SETTINGS.fourth,
  ])
export type UmaSettings = z.infer<typeof UmaSettingsSchema>

// ゲーム作成スキーマ
export const CreateSoloGameSchema = z
  .object({
    gameType: GameTypeSchema.default(DEFAULT_GAME_TYPE),
    initialPoints: z.number().int().positive().default(DEFAULT_INITIAL_POINTS),
    basePoints: z.number().int().positive().default(30000),
    uma: UmaSettingsSchema,
    players: z
      .array(CreateSoloPlayerSchema)
      .length(4, "4人のプレイヤーが必要です"),
  })
  .refine(
    (data) => validatePlayerNames(data.players.map((p) => ({ name: p.name }))),
    {
      message: "プレイヤー名に重複があります",
      path: ["players"],
    }
  )
  .refine(
    (data) => validatePlayerPositions(data.players.map((p) => p.position)),
    {
      message: "無効なプレイヤー位置があります",
      path: ["players"],
    }
  )
  .refine((data) => data.uma.reduce((sum, value) => sum + value, 0) === 0, {
    message: "ウマの合計は0である必要があります",
    path: ["uma"],
  })
export type CreateSoloGameInput = z.infer<typeof CreateSoloGameSchema>

// 点数計算スキーマ（ソロプレイ）
export const SoloScoreCalculationSchema = BaseScoreCalculationSchema.extend({
  winnerId: PlayerPositionSchema,
  loserId: PlayerPositionSchema.optional(),
})
  .refine((data) => validateHanFu(data.han, data.fu), {
    message: "無効な翻符の組み合わせです",
    path: ["han", "fu"],
  })
  .refine((data) => !data.isTsumo || data.loserId === undefined, {
    message: "ツモの場合は敗者を指定できません",
    path: ["loserId"],
  })
  .refine((data) => data.isTsumo || data.loserId !== undefined, {
    message: "ロンの場合は敗者の指定が必要です",
    path: ["loserId"],
  })
  .refine((data) => data.isTsumo || data.winnerId !== data.loserId, {
    message: "勝者と敗者が同じです",
    path: ["winnerId", "loserId"],
  })
export type SoloScoreCalculationInput = z.infer<
  typeof SoloScoreCalculationSchema
>

// 流局スキーマ（ソロプレイ）
export const SoloRyukyokuSchema = BaseRyukyokuSchema.extend({
  tenpaiPlayers: z
    .array(PlayerPositionSchema)
    .default([])
    .refine((players) => players.length <= 4, {
      message: "テンパイ者は4人以下である必要があります",
    })
    .refine((players) => validatePlayerPositions(players), {
      message: "無効なプレイヤー位置があります",
    }),
  reachPlayers: z.array(PlayerPositionSchema).default([]).optional(),
})
export type SoloRyukyokuInput = z.infer<typeof SoloRyukyokuSchema>

// リーチ宣言スキーマ（ソロプレイ）
export const SoloRiichiSchema = z.object({
  position: PlayerPositionSchema,
  round: z.number().int().positive(),
})
export type SoloRiichiInput = z.infer<typeof SoloRiichiSchema>

// ゲーム強制終了スキーマ（ソロプレイ）
export const SoloForceEndSchema = z.object({
  reason: z.string().min(1, "理由は必須です"),
})
export type SoloForceEndInput = z.infer<typeof SoloForceEndSchema>

// ゲーム更新スキーマ（ソロプレイ）
export const UpdateSoloGameSchema = z.object({
  action: z.enum(["start", "finish"]),
  status: GameStatusSchema.optional(),
  currentRound: z.number().int().positive().optional(),
  currentOya: PlayerPositionSchema.optional(),
  honba: z.number().int().nonnegative().optional(),
  kyotaku: z.number().int().nonnegative().optional(),
})
export type UpdateSoloGameInput = z.infer<typeof UpdateSoloGameSchema>

// プレイヤー更新スキーマ（ソロプレイ）
export const UpdateSoloPlayerSchema = z.object({
  currentPoints: z.number().int().optional(),
  isReach: z.boolean().optional(),
  reachRound: z.number().int().positive().optional().nullable(),
  finalPoints: z.number().int().optional().nullable(),
  finalRank: z.number().int().min(1).max(4).optional().nullable(),
  uma: z.number().int().optional().nullable(),
  settlement: z.number().int().optional().nullable(),
})
export type UpdateSoloPlayerInput = z.infer<typeof UpdateSoloPlayerSchema>

// ===== レスポンススキーマ =====

// ソロゲーム状態レスポンス
export const SoloGameStateResponseSchema = z.object({
  success: z.literal(true),
  data: SoloGameStateSchema,
})
export type SoloGameStateResponse = z.infer<typeof SoloGameStateResponseSchema>

// ソロ点数計算結果レスポンス
export const SoloScoreResultResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    gameState: SoloGameStateSchema,
    scoreResult: z.object({
      basePoints: z.number(),
      honbaPoints: z.number(),
      kyotakuPoints: z.number(),
      totalPoints: z.number(),
      distributions: z.array(
        z.object({
          position: z.number(),
          pointChange: z.number(),
        })
      ),
    }),
    gameEnded: z.boolean(),
    reason: z.string().optional(),
  }),
})
export type SoloScoreResultResponse = z.infer<
  typeof SoloScoreResultResponseSchema
>

// ソロゲーム結果レスポンス
export const SoloGameResultResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    gameId: z.string(),
    roomCode: z.string(),
    results: z.array(
      z.object({
        playerId: z.string(), // position.toString()
        name: z.string(),
        finalPoints: z.number(),
        rank: z.number(),
        uma: z.number(),
        settlement: z.number(),
      })
    ),
    gameType: GameTypeSchema,
    endReason: z.string(),
    endedAt: z.string(),
    basePoints: z.number(),
    // セッション関連は全てundefined（ソロプレイには不要）
    sessionId: z.undefined(),
    sessionCode: z.undefined(),
    sessionName: z.undefined(),
    hostPlayerId: z.undefined(),
    nextGame: z.null(),
  }),
})
export type SoloGameResultResponse = z.infer<
  typeof SoloGameResultResponseSchema
>

// ===== バリデーション関数 =====

/**
 * プレイヤー名の重複チェック
 */
export function validatePlayerNames(players: { name: string }[]): boolean {
  const names = players.map((p) => p.name.trim())
  const uniqueNames = new Set(names)
  return uniqueNames.size === names.length && !names.some((name) => name === "")
}

/**
 * リーチ者がテンパイ者に含まれているかチェック
 */
export function validateReachPlayersTenpai(
  reachPlayers: number[],
  tenpaiPlayers: number[]
): boolean {
  return reachPlayers.every((pos) => tenpaiPlayers.includes(pos))
}

/**
 * 順位計算
 */
export function calculateRanks(
  players: { position: number; currentPoints: number }[]
): { position: number; rank: number }[] {
  const sorted = [...players].sort((a, b) => b.currentPoints - a.currentPoints)

  return sorted.map((player, index) => ({
    position: player.position,
    rank: index + 1,
  }))
}

/**
 * ウマ計算（標準ルール）
 */
export function calculateUma(rank: number): number {
  const uma = [15000, 5000, -5000, -15000] // +15/+5/-5/-15
  return uma[rank - 1] || 0
}

/**
 * 精算計算
 */
export function calculateSettlement(
  finalPoints: number,
  basePoints: number,
  uma: number
): number {
  return finalPoints - basePoints + uma
}

/**
 * 位置から風牌への変換
 */
export function getPlayerWind(position: number, currentOya: number): string {
  const winds = ["東", "南", "西", "北"]
  const windIndex = (position - currentOya + 4) % 4
  return winds[windIndex]
}

/**
 * 流局理由の自動生成
 */
export function generateRyukyokuReason(
  type: "DRAW" | "ABORTIVE_DRAW",
  tenpaiCount: number
): string {
  if (type === "ABORTIVE_DRAW") {
    return "途中流局"
  }

  if (tenpaiCount === 0) {
    return "全員ノーテン流局"
  } else if (tenpaiCount === 4) {
    return "全員テンパイ流局"
  } else {
    return `${tenpaiCount}人テンパイ流局`
  }
}

// ===== 定数・デフォルト値 =====

export const PLAYER_POSITIONS = [0, 1, 2, 3] as const
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number]

// 標準ウマ設定（ソロプレイ）
export const SOLO_UMA_SETTINGS = {
  first: 15000,
  second: 5000,
  third: -5000,
  fourth: -15000,
} as const

// エクスポート（後方互換性のため）
export {
  DEFAULT_PLAYER_NAMES,
  DEFAULT_INITIAL_POINTS,
  DEFAULT_GAME_TYPE,
  validateHanFu,
  validatePlayerPositions,
}

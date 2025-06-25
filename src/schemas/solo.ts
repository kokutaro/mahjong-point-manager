import { z } from 'zod'

// プレイヤー位置の定義
export const PLAYER_POSITIONS = [0, 1, 2, 3] as const
export type PlayerPosition = typeof PLAYER_POSITIONS[number]

// ゲームタイプ
export const GameTypeSchema = z.enum(['TONPUU', 'HANCHAN'])
export type GameType = z.infer<typeof GameTypeSchema>

// ゲームステータス
export const GameStatusSchema = z.enum(['WAITING', 'PLAYING', 'FINISHED', 'CANCELLED'])
export type GameStatus = z.infer<typeof GameStatusSchema>

// イベントタイプ
export const EventTypeSchema = z.enum(['TSUMO', 'RON', 'REACH', 'RYUKYOKU', 'GAME_START', 'GAME_END'])
export type EventType = z.infer<typeof EventTypeSchema>

// ソロプレイヤー作成スキーマ
export const CreateSoloPlayerSchema = z.object({
  position: z.number().int().min(0).max(3),
  name: z.string().min(1, '名前は必須です').max(20, '名前は20文字以内です'),
})

export type CreateSoloPlayerInput = z.infer<typeof CreateSoloPlayerSchema>

// ソロゲーム作成スキーマ
export const CreateSoloGameSchema = z.object({
  gameType: GameTypeSchema.default('HANCHAN'),
  initialPoints: z.number().int().positive().default(25000),
  players: z.array(CreateSoloPlayerSchema).length(4, '4人のプレイヤーが必要です'),
})

export type CreateSoloGameInput = z.infer<typeof CreateSoloGameSchema>

// 点数計算スキーマ
export const SoloScoreCalculationSchema = z.object({
  han: z.number().int().min(1).max(13),
  fu: z.number().int().min(20),
  winnerId: z.number().int().min(0).max(3),
  isOya: z.boolean(),
  isTsumo: z.boolean(),
  loserId: z.number().int().min(0).max(3).optional(),
})

export type SoloScoreCalculationInput = z.infer<typeof SoloScoreCalculationSchema>

// リーチ宣言スキーマ
export const SoloReachSchema = z.object({
  position: z.number().int().min(0).max(3),
  round: z.number().int().positive(),
})

export type SoloReachInput = z.infer<typeof SoloReachSchema>

// 流局スキーマ
export const SoloRyukyokuSchema = z.object({
  type: z.enum(['DRAW', 'ABORTIVE_DRAW']),
  reachPlayers: z.array(z.number().int().min(0).max(3)).optional(),
  tenpaiPlayers: z.array(z.number().int().min(0).max(3)).optional(),
})

export type SoloRyukyokuInput = z.infer<typeof SoloRyukyokuSchema>

// ゲーム強制終了スキーマ
export const SoloForceEndSchema = z.object({
  reason: z.string().min(1, '理由は必須です'),
})

export type SoloForceEndInput = z.infer<typeof SoloForceEndSchema>

// ソロプレイヤー更新スキーマ
export const UpdateSoloPlayerSchema = z.object({
  currentPoints: z.number().int().optional(),
  isReach: z.boolean().optional(),
  reachRound: z.number().int().positive().optional().nullable(),
})

export type UpdateSoloPlayerInput = z.infer<typeof UpdateSoloPlayerSchema>

// ソロゲーム更新スキーマ
export const UpdateSoloGameSchema = z.object({
  status: GameStatusSchema.optional(),
  currentRound: z.number().int().positive().optional(),
  currentOya: z.number().int().min(0).max(3).optional(),
  honba: z.number().int().nonnegative().optional(),
  kyotaku: z.number().int().nonnegative().optional(),
})

export type UpdateSoloGameInput = z.infer<typeof UpdateSoloGameSchema>

// バリデーション関数
export function validatePlayerNames(players: CreateSoloPlayerInput[]): boolean {
  const names = players.map(p => p.name.trim())
  const uniqueNames = new Set(names)
  return uniqueNames.size === names.length && !names.some(name => name === '')
}

export function validatePlayerPositions(players: CreateSoloPlayerInput[]): boolean {
  const positions = players.map(p => p.position)
  const uniquePositions = new Set(positions)
  return uniquePositions.size === 4 && positions.every(pos => PLAYER_POSITIONS.includes(pos as PlayerPosition))
}

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

// デフォルト値
export const DEFAULT_PLAYER_NAMES = ['東家', '南家', '西家', '北家']
export const DEFAULT_INITIAL_POINTS = 25000
export const DEFAULT_GAME_TYPE: GameType = 'HANCHAN'

// 位置から風牌への変換
export function getPlayerWind(position: PlayerPosition, currentOya: PlayerPosition): string {
  const winds = ['東', '南', '西', '北']
  const windIndex = (position - currentOya + 4) % 4
  return winds[windIndex]
}

// 順位計算用のユーティリティ
export function calculateRanks(players: { position: number; currentPoints: number }[]): { position: number; rank: number }[] {
  const sorted = [...players].sort((a, b) => b.currentPoints - a.currentPoints)
  
  return sorted.map((player, index) => ({
    position: player.position,
    rank: index + 1
  }))
}
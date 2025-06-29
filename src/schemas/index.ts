/**
 * 統一バリデーションスキーマ
 *
 * DRY原則に基づき、マルチプレイとソロプレイのバリデーションを統一。
 * 共通基底スキーマから派生した型安全な設計。
 */

// ===== 共通基底スキーマ =====
export * from "./common"

// ===== マルチプレイ拡張スキーマ =====
export * from "./multi"

// ===== ソロプレイ拡張スキーマ =====
export {
  // ソロプレイ専用のエクスポート（重複回避）
  SoloPlayerStateSchema,
  SoloGameStateSchema,
  CreateSoloPlayerSchema,
  CreateSoloGameSchema,
  SoloScoreCalculationSchema,
  SoloRyukyokuSchema,
  SoloRiichiSchema,
  SoloForceEndSchema,
  UpdateSoloGameSchema,
  UpdateSoloPlayerSchema,
  SoloGameStateResponseSchema,
  SoloScoreResultResponseSchema,
  SoloGameResultResponseSchema,
  validatePlayerNames,
  validateReachPlayersTenpai,
  calculateRanks,
  calculateUma,
  calculateSettlement,
  generateRyukyokuReason,
  PLAYER_POSITIONS,
  SOLO_UMA_SETTINGS,
  // 関数のみエクスポート（型は別途）
} from "./solo"

// 型のエクスポート（isolatedModules対応）
export type {
  SoloPlayerState,
  SoloGameState,
  CreateSoloPlayerInput,
  CreateSoloGameInput,
  SoloScoreCalculationInput,
  SoloRyukyokuInput,
  SoloRiichiInput,
  SoloForceEndInput,
  UpdateSoloGameInput,
  UpdateSoloPlayerInput,
  SoloGameStateResponse,
  SoloScoreResultResponse,
  SoloGameResultResponse,
} from "./solo"

// ===== 統一バリデーション関数 =====
import { z } from "zod"
import {
  GameMode,
  PlayerIdentifier,
  validateHanFu as commonValidateHanFu,
  validatePlayerPositions as commonValidatePlayerPositions,
} from "./common"
import {
  MultiScoreCalculationSchema,
  MultiRyukyokuSchema,
  MultiRiichiSchema,
} from "./multi"
import {
  SoloScoreCalculationSchema,
  SoloRyukyokuSchema,
  SoloRiichiSchema,
} from "./solo"

// ===== 統一スキーマファクトリー =====

/**
 * ゲームモードに応じた点数計算スキーマを取得
 */
export function getScoreCalculationSchema(gameMode: GameMode) {
  return gameMode === "MULTIPLAYER"
    ? MultiScoreCalculationSchema
    : SoloScoreCalculationSchema
}

/**
 * ゲームモードに応じた流局スキーマを取得
 */
export function getRyukyokuSchema(gameMode: GameMode) {
  return gameMode === "MULTIPLAYER" ? MultiRyukyokuSchema : SoloRyukyokuSchema
}

/**
 * ゲームモードに応じたリーチスキーマを取得
 */
export function getRiichiSchema(gameMode: GameMode) {
  return gameMode === "MULTIPLAYER" ? MultiRiichiSchema : SoloRiichiSchema
}

// ===== 統一バリデーション関数 =====

/**
 * ゲームモードに関係なく点数計算データをバリデーション
 */
export function validateScoreCalculation(data: unknown, gameMode: GameMode) {
  const schema = getScoreCalculationSchema(gameMode)
  return schema.parse(data)
}

/**
 * ゲームモードに関係なく流局データをバリデーション
 */
export function validateRyukyoku(data: unknown, gameMode: GameMode) {
  const schema = getRyukyokuSchema(gameMode)
  return schema.parse(data)
}

/**
 * ゲームモードに関係なくリーチデータをバリデーション
 */
export function validateRiichi(data: unknown, gameMode: GameMode) {
  const schema = getRiichiSchema(gameMode)
  return schema.parse(data)
}

/**
 * 翻符バリデーション（統一関数）
 */
export const validateHanFu = commonValidateHanFu

/**
 * プレイヤー位置バリデーション（統一関数）
 */
export const validatePlayerPositions = commonValidatePlayerPositions

// ===== 型ガード関数 =====

/**
 * プレイヤー識別子がマルチプレイ形式（UUID）かチェック
 */
export function isMultiPlayerIdentifier(
  identifier: PlayerIdentifier
): identifier is string {
  return typeof identifier === "string"
}

/**
 * プレイヤー識別子がソロプレイ形式（位置番号）かチェック
 */
export function isSoloPlayerIdentifier(
  identifier: PlayerIdentifier
): identifier is number {
  return typeof identifier === "number"
}

/**
 * ゲームモードを判定
 */
export function determineGameMode(gameData: { gameMode?: string }): GameMode {
  return gameData.gameMode === "SOLO" ? "SOLO" : "MULTIPLAYER"
}

// ===== ユーティリティ型 =====

/**
 * 統一点数計算入力型（モード自動判定）
 */
export type UnifiedScoreCalculationInput =
  | ({ gameMode: "MULTIPLAYER" } & z.infer<typeof MultiScoreCalculationSchema>)
  | ({ gameMode: "SOLO" } & z.infer<typeof SoloScoreCalculationSchema>)

/**
 * 統一流局入力型（モード自動判定）
 */
export type UnifiedRyukyokuInput =
  | ({ gameMode: "MULTIPLAYER" } & z.infer<typeof MultiRyukyokuSchema>)
  | ({ gameMode: "SOLO" } & z.infer<typeof SoloRyukyokuSchema>)

/**
 * 統一リーチ入力型（モード自動判定）
 */
export type UnifiedRiichiInput =
  | ({ gameMode: "MULTIPLAYER" } & z.infer<typeof MultiRiichiSchema>)
  | ({ gameMode: "SOLO" } & z.infer<typeof SoloRiichiSchema>)

// ===== レガシー互換性エイリアス =====

/**
 * @deprecated 新しい統一スキーマを使用してください
 * レガシー互換性のため残しています
 */
// レガシー互換性エイリアス（後方互換性のため）
export {
  // ソロプレイ（レガシー）
  SoloScoreCalculationSchema as SoloScoreCalculationSchemaLegacy,
  SoloRyukyokuSchema as SoloRyukyokuSchemaLegacy,
  SoloRiichiSchema as SoloReachSchemaLegacy,
} from "./solo"

export {
  // 共通（レガシー）
  GameTypeSchema as GameTypeSchemaLegacy,
  GameStatusSchema as GameStatusSchemaLegacy,
} from "./common"

// ===== 型推論ヘルパー =====

/**
 * スキーマから型を推論するヘルパー型
 */
export type InferSchema<T extends z.ZodSchema> = z.infer<T>

/**
 * モード固有スキーマ型マップ
 */
export type SchemaByMode = {
  MULTIPLAYER: {
    scoreCalculation: typeof MultiScoreCalculationSchema
    ryukyoku: typeof MultiRyukyokuSchema
    riichi: typeof MultiRiichiSchema
  }
  SOLO: {
    scoreCalculation: typeof SoloScoreCalculationSchema
    ryukyoku: typeof SoloRyukyokuSchema
    riichi: typeof SoloRiichiSchema
  }
}

// ===== デバッグ・開発支援 =====

/**
 * 開発時のスキーマ情報表示
 */
export function getSchemaInfo(gameMode: GameMode) {
  const schemas =
    gameMode === "MULTIPLAYER"
      ? {
          scoreCalculation: MultiScoreCalculationSchema,
          ryukyoku: MultiRyukyokuSchema,
          riichi: MultiRiichiSchema,
        }
      : {
          scoreCalculation: SoloScoreCalculationSchema,
          ryukyoku: SoloRyukyokuSchema,
          riichi: SoloRiichiSchema,
        }

  return {
    gameMode,
    schemas,
    schemaNames: Object.keys(schemas),
    isUnified: true,
    version: "1.0.0",
  }
}

// ===== メタデータ =====

export const UNIFIED_SCHEMA_METADATA = {
  version: "1.0.0",
  createdAt: new Date().toISOString(),
  description: "マルチプレイとソロプレイの統一バリデーションスキーマ",
  features: [
    "DRY原則に基づく重複排除",
    "型安全性の向上",
    "共通基底スキーマからの派生",
    "レガシー互換性の維持",
    "統一エラーハンドリング",
  ],
  supportedGameModes: ["MULTIPLAYER", "SOLO"] as const,
}

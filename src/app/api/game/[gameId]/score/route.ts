import { NextRequest } from 'next/server'
import { z } from 'zod'
import { PointManager } from '@/lib/point-manager'
import { SoloPointManager } from '@/lib/solo/solo-point-manager'
import { calculateScore } from '@/lib/score'
import { prisma } from '@/lib/prisma'
import { PlayerIdentifierSchema } from '@/schemas/common'
import { 
  withErrorHandler, 
  createSuccessResponse, 
  validateSchema,
  validatePlayerExists,
  validateHanFuCombination,
  AppError
} from '@/lib/error-handler'

// WebSocket 型定義
interface SocketIOInstance {
  to(room: string): {
    emit(event: string, data: unknown): void
  }
}

// スコアデータ型

type MultiplayerScoreData = {
  winnerId: string
  han: number
  fu: number
  isTsumo: boolean
  loserId?: string
  honba: number
  kyotaku: number
}

type SoloScoreData = {
  winnerId: number
  han: number
  fu: number
  isTsumo: boolean
  loserId?: number
  honba: number
  kyotaku: number
}

// プロセスの型拡張
declare global {
  interface Process {
    __socketio?: SocketIOInstance
  }
}

// WebSocketインスタンスを直接プロセスから取得
function getIO(): SocketIOInstance | null {
  if (process.__socketio) {
    console.log('🔌 API: Found WebSocket instance in process')
    return process.__socketio
  }
  console.log('🔌 API: No WebSocket instance found in process')
  return null
}

// 統合版スコア計算スキーマ
const unifiedScoreRequestSchema = z.object({
  winnerId: PlayerIdentifierSchema,
  han: z.number().int().min(1).max(13),
  fu: z.number().int().min(20).max(110),
  isTsumo: z.boolean(),
  loserId: PlayerIdentifierSchema.optional(),
  honba: z.number().int().min(0).default(0),
  kyotaku: z.number().int().min(0).default(0)
}).refine(
  (data) => !data.isTsumo || data.loserId === undefined,
  {
    message: 'ツモの場合は敗者を指定できません',
    path: ['loserId']
  }
).refine(
  (data) => data.isTsumo || data.loserId !== undefined,
  {
    message: 'ロンの場合は敗者の指定が必要です',
    path: ['loserId']
  }
).refine(
  (data) => data.isTsumo || data.winnerId !== data.loserId,
  {
    message: '勝者と敗者が同じです',
    path: ['winnerId', 'loserId']
  }
)

/**
 * 統合版点数計算エンドポイント
 * マルチプレイとソロプレイの両方に対応
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) => {
  const body = await request.json()
  const validatedData = validateSchema(unifiedScoreRequestSchema, body)
  const { gameId } = await params

  console.log('Processing unified score calculation for gameId:', gameId)

  // まずマルチプレイゲームかどうか確認
  const multiGame = await prisma.game.findUnique({
    where: { id: gameId }
  })

  if (multiGame) {
    console.log('Processing as multiplayer game')
    // マルチプレイ用に型変換
    const multiData: MultiplayerScoreData = {
      winnerId: String(validatedData.winnerId),
      han: validatedData.han,
      fu: validatedData.fu,
      isTsumo: validatedData.isTsumo,
      loserId: validatedData.loserId ? String(validatedData.loserId) : undefined,
      honba: validatedData.honba || 0,
      kyotaku: validatedData.kyotaku || 0
    }
    return await processMultiplayerScore(gameId, multiData)
  }

  // ソロプレイゲームかどうか確認
  const soloGame = await prisma.soloGame.findUnique({
    where: { id: gameId }
  })

  if (soloGame) {
    console.log('Processing as solo game')
    // ソロプレイ用に型変換
    const soloData: SoloScoreData = {
      winnerId: typeof validatedData.winnerId === 'number' ? validatedData.winnerId : parseInt(String(validatedData.winnerId)),
      han: validatedData.han,
      fu: validatedData.fu,
      isTsumo: validatedData.isTsumo,
      loserId: validatedData.loserId ? (typeof validatedData.loserId === 'number' ? validatedData.loserId : parseInt(String(validatedData.loserId))) : undefined,
      honba: validatedData.honba || 0,
      kyotaku: validatedData.kyotaku || 0
    }
    
    // 位置の妥当性チェック
    if (isNaN(soloData.winnerId) || soloData.winnerId < 0 || soloData.winnerId > 3) {
      throw new AppError('INVALID_PLAYER_POSITION', `無効な勝者位置: ${validatedData.winnerId}`, {}, 400)
    }
    if (soloData.loserId !== undefined && (isNaN(soloData.loserId) || soloData.loserId < 0 || soloData.loserId > 3)) {
      throw new AppError('INVALID_PLAYER_POSITION', `無効な敗者位置: ${validatedData.loserId}`, {}, 400)
    }
    
    return await processSoloScore(gameId, soloData)
  }

  throw new Error('ゲームが見つかりません')
}, '点数処理に失敗しました')

/**
 * マルチプレイゲームの点数計算処理
 */
async function processMultiplayerScore(gameId: string, validatedData: MultiplayerScoreData) {
  const pointManager = new PointManager(gameId)
  

  // 現在のゲーム状態を取得
  const gameState = await pointManager.getGameState()
  
  // ゲーム状態の妥当性チェック
  if (gameState.gamePhase !== 'playing') {
    throw new Error(`ゲーム状態が無効です。期待: playing, 現在: ${gameState.gamePhase}`)
  }
  
  const winner = gameState.players.find(p => p.playerId === validatedData.winnerId)
  validatePlayerExists(winner, validatedData.winnerId)

  // 翻符の組み合わせチェック
  validateHanFuCombination(validatedData.han, validatedData.fu)

  const isOya = winner.position === gameState.currentOya

  // 点数計算
  const scoreResult = await calculateScore({
    han: validatedData.han,
    fu: validatedData.fu,
    isOya,
    isTsumo: validatedData.isTsumo,
    honba: validatedData.honba || gameState.honba,
    kyotaku: validatedData.kyotaku || gameState.kyotaku
  })

  // 点数分配（内部で親ローテーションとゲーム終了判定も実行）
  const gameEndResult = await pointManager.distributeWinPoints(
    validatedData.winnerId,
    scoreResult,
    validatedData.isTsumo,
    validatedData.loserId
  )

  // 更新されたゲーム状態
  const updatedGameState = await pointManager.getGameState()

  // ルームコードを取得してWebSocket通知
  const game = await pointManager.getGameInfo()
  const io = getIO()
  if (io && game?.roomCode) {
    if (gameEndResult.gameEnded) {
      console.log(`Multiplayer game ended: ${gameEndResult.reason}`)
      io.to(game.roomCode).emit('game_ended', {
        gameState: updatedGameState,
        reason: gameEndResult.reason,
        finalResults: true
      })
    } else {
      console.log(`Emitting score_updated to room ${game.roomCode}`)
      io.to(game.roomCode).emit('score_updated', {
        gameState: updatedGameState,
        scoreResult,
        winner: validatedData.winnerId
      })
    }
  }

  return createSuccessResponse({
    gameMode: 'MULTIPLAYER',
    scoreResult,
    gameState: updatedGameState
  })
}

/**
 * ソロプレイゲームの点数計算処理
 */
async function processSoloScore(gameId: string, validatedData: SoloScoreData) {
  // プレイヤー位置の妥当性チェック（既にメイン関数で実行済み）

  const pointManager = new SoloPointManager(gameId)
  
  // 現在のゲーム状態を取得
  const gameState = await pointManager.getGameState()
  
  // 勝者の位置を検証
  const winner = gameState.players.find(p => p.position === validatedData.winnerId)
  validatePlayerExists(winner, validatedData.winnerId.toString())

  // 翻符の組み合わせチェック
  validateHanFuCombination(validatedData.han, validatedData.fu)

  const isOya = validatedData.winnerId === gameState.currentOya

  // 点数計算（既存のマルチプレイと同じロジックを使用）
  const scoreResult = await calculateScore({
    han: validatedData.han,
    fu: validatedData.fu,
    isOya,
    isTsumo: validatedData.isTsumo,
    honba: gameState.honba,
    kyotaku: gameState.kyotaku
  })

  // 点数分配（内部で親ローテーションとゲーム終了判定も実行）
  const gameEndResult = await pointManager.distributeWinPoints(
    validatedData.winnerId,
    scoreResult,
    validatedData.isTsumo,
    validatedData.loserId
  )

  // 更新されたゲーム状態
  const updatedGameState = await pointManager.getGameState()

  return createSuccessResponse({
    gameMode: 'SOLO',
    gameState: updatedGameState,
    scoreResult,
    gameEnded: gameEndResult.gameEnded,
    reason: gameEndResult.reason
  })
}
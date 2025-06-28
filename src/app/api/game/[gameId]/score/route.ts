import { NextRequest, NextResponse } from 'next/server'
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
  validateGameState,
  validatePlayerExists,
  validateHanFuCombination,
  validatePlayerPosition
} from '@/lib/error-handler'

// WebSocketインスタンスを直接プロセスから取得
function getIO() {
  if ((process as any).__socketio) {
    console.log('🔌 API: Found WebSocket instance in process')
    return (process as any).__socketio
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
    return await processMultiplayerScore(gameId, validatedData)
  }

  // ソロプレイゲームかどうか確認
  const soloGame = await prisma.soloGame.findUnique({
    where: { id: gameId }
  })

  if (soloGame) {
    console.log('Processing as solo game')
    return await processSoloScore(gameId, validatedData)
  }

  throw new Error('ゲームが見つかりません')
}, '点数処理に失敗しました')

/**
 * マルチプレイゲームの点数計算処理
 */
async function processMultiplayerScore(gameId: string, validatedData: any) {
  const pointManager = new PointManager(gameId)
  
  // プレイヤーIDが文字列であることを確認
  if (typeof validatedData.winnerId !== 'string') {
    throw new Error('マルチプレイゲームではプレイヤーIDは文字列である必要があります')
  }
  if (validatedData.loserId && typeof validatedData.loserId !== 'string') {
    throw new Error('マルチプレイゲームではプレイヤーIDは文字列である必要があります')
  }

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
async function processSoloScore(gameId: string, validatedData: any) {
  // プレイヤーIDが数値（位置）であることを確認
  if (typeof validatedData.winnerId !== 'number') {
    throw new Error('ソロプレイゲームではプレイヤーIDは位置番号（数値）である必要があります')
  }
  if (validatedData.loserId && typeof validatedData.loserId !== 'number') {
    throw new Error('ソロプレイゲームではプレイヤーIDは位置番号（数値）である必要があります')
  }

  // プレイヤー位置の妥当性チェック
  validatePlayerPosition(validatedData.winnerId)
  if (validatedData.loserId !== undefined) {
    validatePlayerPosition(validatedData.loserId)
  }

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
import { NextRequest, NextResponse } from 'next/server'
import { SoloPointManager } from '@/lib/solo/solo-point-manager'
import { calculateScore } from '@/lib/score'
import { SoloScoreCalculationSchema, validateHanFu } from '@/schemas/solo'
import { 
  withErrorHandler, 
  createSuccessResponse, 
  validateSchema,
  validateGameState,
  validatePlayerExists,
  validateHanFuCombination,
  validatePlayerPosition
} from '@/lib/error-handler'

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await params
  const body = await request.json()

  // バリデーション
  const scoreInput = validateSchema(SoloScoreCalculationSchema, body)

  // 翻符の組み合わせチェック
  validateHanFuCombination(scoreInput.han, scoreInput.fu)

  // プレイヤー位置の妥当性チェック
  validatePlayerPosition(scoreInput.winnerId)
  if (scoreInput.loserId !== undefined) {
    validatePlayerPosition(scoreInput.loserId)
  }

  // ロンの場合は敗者が必須
  if (!scoreInput.isTsumo && scoreInput.loserId === undefined) {
    throw new Error('ロンの場合は敗者の指定が必要です')
  }

  // 勝者と敗者が同じ場合はエラー
  if (!scoreInput.isTsumo && scoreInput.winnerId === scoreInput.loserId) {
    throw new Error('勝者と敗者が同じです')
  }

  const pointManager = new SoloPointManager(gameId)
  
  // 現在のゲーム状態を取得
  const gameState = await pointManager.getGameState()
  
  // ゲーム状態の妥当性チェック（SoloPointManagerは内部で状態をチェック）
  
  // 勝者の位置を検証
  const winner = gameState.players.find(p => p.position === scoreInput.winnerId)
  validatePlayerExists(winner, scoreInput.winnerId.toString())

  const isOya = scoreInput.winnerId === gameState.currentOya

  // 点数計算（既存のマルチプレイと同じロジックを使用）
  const scoreResult = await calculateScore({
    han: scoreInput.han,
    fu: scoreInput.fu,
    isOya,
    isTsumo: scoreInput.isTsumo,
    honba: gameState.honba,
    kyotaku: gameState.kyotaku
  })

  // 点数分配（内部で親ローテーションとゲーム終了判定も実行）
  const gameEndResult = await pointManager.distributeWinPoints(
    scoreInput.winnerId,
    scoreResult,
    scoreInput.isTsumo,
    scoreInput.loserId
  )

  // 更新されたゲーム状態
  const updatedGameState = await pointManager.getGameState()

  return createSuccessResponse({
    gameState: updatedGameState,
    scoreResult,
    gameEnded: gameEndResult.gameEnded,
    reason: gameEndResult.reason
  })
}, 'ソロ点数計算に失敗しました')
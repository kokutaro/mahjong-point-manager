import { NextRequest, NextResponse } from 'next/server'
import { SoloPointManager } from '@/lib/solo/solo-point-manager'
import { calculateScore } from '@/lib/score'
import { SoloScoreCalculationSchema, validateHanFu } from '@/schemas/solo'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params
    const body = await request.json()

    if (!gameId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_GAME_ID',
          message: 'ゲームIDが必要です'
        }
      }, { status: 400 })
    }

    // バリデーション
    const validation = SoloScoreCalculationSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力データが無効です',
          details: validation.error.errors
        }
      }, { status: 400 })
    }

    const scoreInput = validation.data

    // 翻符の組み合わせチェック
    if (!validateHanFu(scoreInput.han, scoreInput.fu)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_HAN_FU',
          message: '無効な翻符の組み合わせです'
        }
      }, { status: 400 })
    }

    // ロンの場合は敗者が必須
    if (!scoreInput.isTsumo && scoreInput.loserId === undefined) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_LOSER',
          message: 'ロンの場合は敗者の指定が必要です'
        }
      }, { status: 400 })
    }

    // 勝者と敗者が同じ場合はエラー
    if (!scoreInput.isTsumo && scoreInput.winnerId === scoreInput.loserId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PLAYERS',
          message: '勝者と敗者が同じです'
        }
      }, { status: 400 })
    }

    const pointManager = new SoloPointManager(gameId)
    
    // 現在のゲーム状態を取得
    const gameState = await pointManager.getGameState()
    
    // 勝者の位置を検証
    const winner = gameState.players.find(p => p.position === scoreInput.winnerId)
    if (!winner) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: 'プレイヤーが見つかりません'
        }
      }, { status: 404 })
    }

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

    return NextResponse.json({
      success: true,
      data: {
        gameState: updatedGameState,
        scoreResult,
        gameEnded: gameEndResult.gameEnded,
        reason: gameEndResult.reason
      }
    })

  } catch (error) {
    console.error('Solo score calculation error:', error)
    
    if (error instanceof Error) {
      if (error.message === 'ゲームが見つかりません') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'GAME_NOT_FOUND',
            message: 'ゲームが見つかりません'
          }
        }, { status: 404 })
      }
      
      if (error.message === 'ゲームが開始されていません') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'GAME_NOT_STARTED',
            message: 'ゲームが開始されていません'
          }
        }, { status: 400 })
      }

      if (error.message.includes('点数パターンが見つかりません')) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'SCORE_PATTERN_NOT_FOUND',
            message: '指定された翻符の点数パターンが見つかりません'
          }
        }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '点数計算に失敗しました'
      }
    }, { status: 500 })
  }
}
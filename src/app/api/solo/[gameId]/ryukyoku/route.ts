import { NextRequest, NextResponse } from 'next/server'
import { SoloPointManager } from '@/lib/solo/solo-point-manager'
import { SoloRyukyokuSchema } from '@/schemas/solo'

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
    const validation = SoloRyukyokuSchema.safeParse(body)
    
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

    const { type, tenpaiPlayers = [], reachPlayers = [] } = validation.data

    // ゲーム状態を事前チェック
    const { prisma } = await import('@/lib/prisma')
    const game = await prisma.soloGame.findUnique({
      where: { id: gameId },
      include: { players: true }
    })

    if (!game) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'GAME_NOT_FOUND',
          message: 'ゲームが見つかりません'
        }
      }, { status: 404 })
    }

    if (game.status !== 'PLAYING') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'GAME_NOT_PLAYING',
          message: 'ゲームが進行中ではありません'
        }
      }, { status: 400 })
    }

    // テンパイ者数の妥当性チェック
    if (tenpaiPlayers.length > 4) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_TENPAI_COUNT',
          message: 'テンパイ者数が無効です'
        }
      }, { status: 400 })
    }

    // プレイヤー位置の妥当性チェック
    const invalidTenpaiPlayers = tenpaiPlayers.filter(pos => pos < 0 || pos > 3)
    if (invalidTenpaiPlayers.length > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PLAYER_POSITION',
          message: '無効なプレイヤー位置が指定されています'
        }
      }, { status: 400 })
    }

    // リーチ者がテンパイ者に含まれているかチェック
    const currentReachPlayers = game.players
      .filter(p => p.isReach)
      .map(p => p.position)
    
    const missingReachPlayers = currentReachPlayers.filter(pos => !tenpaiPlayers.includes(pos))
    if (missingReachPlayers.length > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'REACH_PLAYER_NOT_TENPAI',
          message: 'リーチしているプレイヤーはテンパイしている必要があります'
        }
      }, { status: 400 })
    }

    // 流局処理
    const pointManager = new SoloPointManager(gameId)
    
    // 流局の理由を生成
    let reason = '流局'
    if (type === 'ABORTIVE_DRAW') {
      reason = '途中流局'
    } else {
      const tenpaiCount = tenpaiPlayers.length
      if (tenpaiCount === 0) {
        reason = '全員ノーテン流局'
      } else if (tenpaiCount === 4) {
        reason = '全員テンパイ流局'
      } else {
        reason = `${tenpaiCount}人テンパイ流局`
      }
    }

    // 流局処理（内部で親ローテーションとゲーム終了判定も実行）
    const gameEndResult = await pointManager.handleRyukyoku(reason, tenpaiPlayers)

    // 更新されたゲーム状態
    const updatedGameState = await pointManager.getGameState()

    return NextResponse.json({
      success: true,
      data: {
        gameState: updatedGameState,
        tenpaiPlayers,
        reachPlayers: currentReachPlayers,
        message: reason,
        gameEnded: gameEndResult.gameEnded,
        reason: gameEndResult.reason
      }
    })

  } catch (error) {
    console.error('Solo ryukyoku processing error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '流局処理に失敗しました'
      }
    }, { status: 500 })
  }
}
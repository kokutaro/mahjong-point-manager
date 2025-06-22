import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PointManager } from '@/lib/point-manager'
import { calculateScore } from '@/lib/score'
// WebSocketインスタンスを直接プロセスから取得
function getIO() {
  if ((process as any).__socketio) {
    console.log('🔌 API: Found WebSocket instance in process')
    return (process as any).__socketio
  }
  console.log('🔌 API: No WebSocket instance found in process')
  return null
}

const scoreRequestSchema = z.object({
  winnerId: z.string(),
  han: z.number().int().min(1).max(13),
  fu: z.number().int().min(20).max(110),
  isTsumo: z.boolean(),
  loserId: z.string().optional(),
  honba: z.number().int().min(0).default(0),
  kyotaku: z.number().int().min(0).default(0)
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const body = await request.json()
    const validatedData = scoreRequestSchema.parse(body)
    const { gameId } = await params

    const pointManager = new PointManager(gameId)
    
    // 現在のゲーム状態を取得
    const gameState = await pointManager.getGameState()
    const winner = gameState.players.find(p => p.playerId === validatedData.winnerId)
    
    if (!winner) {
      return NextResponse.json({
        success: false,
        error: { message: 'プレイヤーが見つかりません' }
      }, { status: 404 })
    }

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
        console.log(`Game ended: ${gameEndResult.reason}`)
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

    return NextResponse.json({
      success: true,
      data: {
        scoreResult,
        gameState: updatedGameState
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'バリデーションエラー',
          details: error.errors
        }
      }, { status: 400 })
    }

    console.error('Score processing failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: '点数処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
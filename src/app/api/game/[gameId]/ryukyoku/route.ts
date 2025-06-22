import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PointManager } from '@/lib/point-manager'
// WebSocketインスタンスを直接プロセスから取得
function getIO() {
  if ((process as any).__socketio) {
    console.log('🔌 API: Found WebSocket instance in process')
    return (process as any).__socketio
  }
  console.log('🔌 API: No WebSocket instance found in process')
  return null
}

const ryukyokuRequestSchema = z.object({
  reason: z.string().min(1),
  tenpaiPlayers: z.array(z.string()).optional().default([])
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const body = await request.json()
    const validatedData = ryukyokuRequestSchema.parse(body)
    const { gameId } = await params

    const pointManager = new PointManager(gameId)
    
    // 流局処理（内部で親ローテーションとゲーム終了判定も実行）
    const gameEndResult = await pointManager.handleRyukyoku(validatedData.reason, validatedData.tenpaiPlayers)

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
        console.log(`Emitting ryukyoku to room ${game.roomCode}`)
        io.to(game.roomCode).emit('ryukyoku', {
          gameState: updatedGameState,
          reason: validatedData.reason
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        gameState: updatedGameState,
        message: `流局: ${validatedData.reason}`
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

    console.error('Ryukyoku processing failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: '流局処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
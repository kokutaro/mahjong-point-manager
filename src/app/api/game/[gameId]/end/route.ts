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

const endGameRequestSchema = z.object({
  reason: z.string().optional().default('強制終了')
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const body = await request.json()
    const validatedData = endGameRequestSchema.parse(body)
    const { gameId } = await params

    const pointManager = new PointManager(gameId)
    
    console.log('🏁 API: Starting force end game for gameId:', gameId, 'reason:', validatedData.reason)
    
    // 強制終了処理
    await pointManager.forceEndGame(validatedData.reason)
    
    console.log('🏁 API: Force end game completed')

    // 更新されたゲーム状態
    const updatedGameState = await pointManager.getGameState()

    // ルームコードを取得してWebSocket通知
    const game = await pointManager.getGameInfo()
    const io = getIO()
    if (io && game?.roomCode) {
      console.log(`Game force ended: ${validatedData.reason}`)
      io.to(game.roomCode).emit('game_ended', {
        gameState: updatedGameState,
        reason: validatedData.reason,
        finalResults: true,
        forced: true
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        gameState: updatedGameState,
        message: `ゲームを終了しました: ${validatedData.reason}`
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

    console.error('Force end game failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'ゲーム終了処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
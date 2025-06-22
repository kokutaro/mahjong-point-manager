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

const riichiRequestSchema = z.object({
  playerId: z.string()
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const body = await request.json()
    const validatedData = riichiRequestSchema.parse(body)
    const { gameId } = await params

    const pointManager = new PointManager(gameId)
    
    // リーチ宣言処理
    await pointManager.declareReach(validatedData.playerId)

    // 更新されたゲーム状態
    const updatedGameState = await pointManager.getGameState()

    // ルームコードを取得してWebSocket通知
    const game = await pointManager.getGameInfo()
    console.log('🔌 API: Checking process for WebSocket instance...')
    console.log('🔌 API: Process has __socketio property:', '__socketio' in process)
    console.log('🔌 API: Process.__socketio value:', !!(process as any).__socketio)
    console.log('🔌 API: Process object keys with socket:', Object.keys(process).filter(key => key.toLowerCase().includes('socket')))
    
    const io = getIO()
    console.log('🔌 Server: WebSocket IO instance:', !!io)
    console.log('🔌 Server: Game room code:', game?.roomCode)
    
    if (io && game?.roomCode) {
      console.log(`🔌 Server: Emitting riichi_declared to room ${game.roomCode}`)
      console.log('🔌 Server: Rooms in IO:', io.sockets.adapter.rooms.keys())
      io.to(game.roomCode).emit('riichi_declared', {
        gameState: updatedGameState,
        playerId: validatedData.playerId
      })
      console.log('🔌 Server: riichi_declared event sent')
    } else {
      console.error('🔌 Server: Cannot emit riichi_declared - IO or roomCode missing:', {
        io: !!io,
        roomCode: game?.roomCode
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        gameState: updatedGameState,
        message: `${validatedData.playerId} がリーチしました`
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

    console.error('Riichi declaration failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'リーチ宣言に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
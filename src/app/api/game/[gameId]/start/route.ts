import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket'

const startGameSchema = z.object({
  hostPlayerId: z.string()
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const body = await request.json()
    const validatedData = startGameSchema.parse(body)
    const { gameId } = await params

    console.log('Game start request:', { gameId, body: validatedData })

    // ゲーム存在確認
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: 'asc' }
        }
      }
    })

    console.log('Found game:', game ? { id: game.id, status: game.status, participantsCount: game.participants.length } : 'null')

    if (!game) {
      return NextResponse.json({
        success: false,
        error: { message: 'ゲームが見つかりません' }
      }, { status: 404 })
    }

    // ホスト権限確認
    if (game.hostPlayerId !== validatedData.hostPlayerId) {
      return NextResponse.json({
        success: false,
        error: { message: 'ゲーム開始権限がありません' }
      }, { status: 403 })
    }

    // 参加者数確認
    if (game.participants.length !== 4) {
      return NextResponse.json({
        success: false,
        error: { message: '4人揃ってからゲームを開始してください' }
      }, { status: 400 })
    }

    // ゲーム状態確認
    if (game.status !== 'WAITING') {
      return NextResponse.json({
        success: false,
        error: { message: 'ゲームは既に開始されているか終了しています' }
      }, { status: 400 })
    }

    // 起家は座席順0の人に固定
    const startingOya = 0

    // ゲーム開始
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'PLAYING',
        currentOya: startingOya,
        startingOya: startingOya,
        startedAt: new Date()
      },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: 'asc' }
        }
      }
    })

    // ゲーム開始イベント記録
    await prisma.gameEvent.create({
      data: {
        gameId,
        eventType: 'GAME_START',
        eventData: { startingOya },
        round: 1,
        honba: 0
      }
    })

    // WebSocketで全員にゲーム開始通知
    const io = getIO()
    if (io) {
      io.to(game.roomCode).emit('game_started', {
        gameState: {
          gameId: updatedGame.id,
          players: updatedGame.participants.map(p => ({
            playerId: p.playerId,
            name: p.player.name,
            position: p.position,
            points: p.currentPoints,
            isReach: p.isReach,
            isConnected: true
          })),
          currentRound: updatedGame.currentRound,
          currentOya: updatedGame.currentOya,
          honba: updatedGame.honba,
          kyotaku: updatedGame.kyotaku,
          gamePhase: 'playing' as const
        },
        startingOya
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        gameId: updatedGame.id,
        status: updatedGame.status,
        startingOya,
        gameState: {
          gameId: updatedGame.id,
          players: updatedGame.participants.map(p => ({
            playerId: p.playerId,
            name: p.player.name,
            position: p.position,
            points: p.currentPoints,
            isReach: p.isReach,
            isConnected: true
          })),
          currentRound: updatedGame.currentRound,
          currentOya: updatedGame.currentOya,
          honba: updatedGame.honba,
          kyotaku: updatedGame.kyotaku,
          gamePhase: 'playing' as const
        }
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

    console.error('Game start failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'ゲーム開始に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
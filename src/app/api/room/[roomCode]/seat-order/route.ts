import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket'

const seatOrderSchema = z.object({
  positions: z.array(z.object({
    playerId: z.string(),
    position: z.number().int().min(0).max(3)
  })).min(1).max(4)
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const body = await request.json()
    const validated = seatOrderSchema.parse(body)
    const { roomCode } = await params

    const game = await prisma.game.findFirst({
      where: { roomCode: roomCode.toUpperCase(), status: 'WAITING' },
      include: { participants: true }
    })

    if (!game) {
      return NextResponse.json({
        success: false,
        error: { message: 'ルームが見つかりません' }
      }, { status: 404 })
    }

    if (game.participants.length !== validated.positions.length) {
      return NextResponse.json({
        success: false,
        error: { message: '参加人数が一致しません' }
      }, { status: 400 })
    }

    const participantIds = game.participants.map(p => p.playerId)
    for (const pos of validated.positions) {
      if (!participantIds.includes(pos.playerId)) {
        return NextResponse.json({
          success: false,
          error: { message: '無効なプレイヤーIDがあります' }
        }, { status: 400 })
      }
    }

    await prisma.$transaction(async (tx) => {
      // 一時的に位置をずらして衝突を避ける
      for (const p of validated.positions) {
        await tx.gameParticipant.update({
          where: { gameId_playerId: { gameId: game.id, playerId: p.playerId } },
          data: { position: p.position + 10 }
        })
      }
      for (const p of validated.positions) {
        await tx.gameParticipant.update({
          where: { gameId_playerId: { gameId: game.id, playerId: p.playerId } },
          data: { position: p.position }
        })
      }
    })

    const updatedGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: 'asc' }
        }
      }
    })

    const io = getIO()
    if (io && updatedGame) {
      io.to(updatedGame.roomCode).emit('seat_order_updated', {
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
          gamePhase: 'waiting' as const
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: { message: 'バリデーションエラー', details: error.errors }
      }, { status: 400 })
    }
    console.error('Seat order update failed:', error)
    return NextResponse.json({
      success: false,
      error: {
        message: '席順の更新に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

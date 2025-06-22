import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function generateRoomCode(): string {
  return Math.random().toString(36).substr(2, 6).toUpperCase()
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: true,
        settings: true,
        hostPlayer: true
      }
    })

    if (!game) {
      return NextResponse.json({ success: false, error: { message: 'ゲームが見つかりません' } }, { status: 404 })
    }

    let roomCode: string
    let existing
    do {
      roomCode = generateRoomCode()
      existing = await prisma.game.findFirst({ where: { roomCode } })
    } while (existing)

    const newGame = await prisma.game.create({
      data: {
        roomCode,
        hostPlayerId: game.hostPlayerId,
        settingsId: game.settingsId!,
        status: 'WAITING',
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0
      }
    })

    await Promise.all(game.participants.map(p =>
      prisma.gameParticipant.create({
        data: {
          gameId: newGame.id,
          playerId: p.playerId,
          position: p.position,
          currentPoints: game.settings?.initialPoints || 25000,
          isReach: false
        }
      })
    ))

    return NextResponse.json({ success: true, data: { gameId: newGame.id, roomCode } })
  } catch (err) {
    console.error('Rematch creation failed:', err)
    return NextResponse.json({ success: false, error: { message: '再戦作成に失敗しました' } }, { status: 500 })
  }
}

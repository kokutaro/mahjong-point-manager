import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params

    // ゲーム情報取得
    const game = await prisma.game.findFirst({
      where: {
        roomCode: roomCode.toUpperCase(),
        status: { in: ['WAITING', 'PLAYING'] }
      },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: 'asc' }
        },
        settings: true,
        hostPlayer: true
      }
    })

    if (!game) {
      return NextResponse.json({
        success: false,
        error: { message: 'ルームが見つかりません' }
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        gameId: game.id,
        roomCode: game.roomCode,
        status: game.status,
        hostPlayer: {
          id: game.hostPlayer.id,
          name: game.hostPlayer.name
        },
        players: game.participants.map(p => ({
          playerId: p.playerId,
          name: p.player.name,
          position: p.position,
          points: p.currentPoints,
          isReach: p.isReach,
          isConnected: true // TODO: 実際のセッション管理
        })),
        currentRound: game.currentRound,
        currentOya: game.currentOya,
        honba: game.honba,
        kyotaku: game.kyotaku,
        gamePhase: game.status.toLowerCase() as 'waiting' | 'playing' | 'finished',
        settings: {
          gameType: game.settings?.gameType,
          initialPoints: game.settings?.initialPoints,
          hasTobi: game.settings?.hasTobi,
          uma: game.settings?.uma,
          oka: game.settings?.oka
        }
      }
    })

  } catch (error) {
    console.error('Room info retrieval failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'ルーム情報の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
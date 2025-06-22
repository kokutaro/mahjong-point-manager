import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params

    console.log('Fetching game state for gameId:', gameId)

    // ゲーム情報を取得
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: 'asc' }
        },
        settings: true
      }
    })

    if (!game) {
      return NextResponse.json({
        success: false,
        error: { message: 'ゲームが見つかりません' }
      }, { status: 404 })
    }

    console.log('Found game:', { id: game.id, status: game.status, participantsCount: game.participants.length })

    // ゲーム状態を構築
    const gameState = {
      gameId: game.id,
      players: game.participants.map(p => ({
        playerId: p.playerId,
        name: p.player.name,
        position: p.position,
        points: p.currentPoints,
        isReach: p.isReach,
        isConnected: true // WebSocket接続状態は別途管理
      })),
      currentRound: game.currentRound,
      currentOya: game.currentOya,
      honba: game.honba,
      kyotaku: game.kyotaku,
      gamePhase: game.status === 'PLAYING' ? 'playing' as const : 
                 game.status === 'FINISHED' ? 'finished' as const : 'waiting' as const
    }

    return NextResponse.json({
      success: true,
      data: {
        gameState,
        gameInfo: {
          id: game.id,
          roomCode: game.roomCode,
          status: game.status,
          createdAt: game.createdAt,
          startedAt: game.startedAt,
          endedAt: game.endedAt,
          settings: game.settings
        }
      }
    })

  } catch (error) {
    console.error('Game state fetch failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'ゲーム状態の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
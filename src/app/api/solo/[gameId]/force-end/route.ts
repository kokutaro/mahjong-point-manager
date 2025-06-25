import { NextRequest, NextResponse } from 'next/server'
import { SoloForceEndSchema } from '@/schemas/solo'

export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const { gameId } = params
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
    const validation = SoloForceEndSchema.safeParse(body)
    
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

    const { reason } = validation.data

    // ゲーム存在確認と強制終了処理
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

    if (game.status === 'FINISHED' || game.status === 'CANCELLED') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'GAME_ALREADY_ENDED',
          message: 'ゲームは既に終了しています'
        }
      }, { status: 400 })
    }

    // 強制終了処理
    await prisma.$transaction(async (tx) => {
      // ゲームステータスを中止に変更
      await tx.soloGame.update({
        where: { id: gameId },
        data: { 
          status: 'CANCELLED',
          endedAt: new Date()
        }
      })

      // 強制終了イベントを記録
      await tx.soloGameEvent.create({
        data: {
          soloGameId: gameId,
          eventType: 'GAME_END',
          round: game.currentRound,
          honba: game.honba,
          eventData: {
            type: 'FORCE_END',
            reason: reason,
            endedAt: new Date(),
            playersAtEnd: game.players.map(p => ({
              position: p.position,
              name: p.name,
              points: p.currentPoints,
              isReach: p.isReach
            }))
          }
        }
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        gameId,
        status: 'CANCELLED',
        reason,
        message: 'ゲームを強制終了しました'
      }
    })

  } catch (error) {
    console.error('Solo game force end error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'ゲーム強制終了に失敗しました'
      }
    }, { status: 500 })
  }
}